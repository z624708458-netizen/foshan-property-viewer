const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const { initDb } = require('./database');
const localQueries = require('./queries');
const { runScrape } = require('./scraper');

const app = express();
const PORT = 3456;

// Supabase 配置（云端部署时使用）
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dxlhuiaprsqcoihoipcb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_BJMp_O22dULvZhIgHna93w_KSGFe6kA';
const USE_SUPABASE = process.env.USE_SUPABASE === 'true' || !!process.env.RAILWAY;

// Supabase REST 查询
async function sbQuery(table, params = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  if (params.select) url.searchParams.set('select', params.select);
  if (params.order) url.searchParams.set('order', params.order);
  if (params.limit) url.searchParams.set('limit', params.limit);
  if (params.offset) url.searchParams.set('offset', params.offset);
  if (params.filters) {
    params.filters.forEach(f => url.searchParams.append(f.key, f.value));
  }

  const res = await fetch(url.toString(), {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase: ${res.status}`);
  return res.json();
}

const distPath = path.join(__dirname, '..', 'dist', 'renderer');
app.use(express.static(distPath));
app.use(express.json());

// ===== API 路由 =====

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), mode: USE_SUPABASE ? 'cloud' : 'local' });
});

app.get('/api/districts', async (_req, res) => {
  try {
    if (USE_SUPABASE) {
      const data = await sbQuery('districts', { select: '*', order: 'sort_order' });
      return res.json(data);
    }
    res.json(localQueries.getDistricts());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects', async (req, res) => {
  try {
    const { district, page, pageSize } = req.query;
    if (!district) return res.status(400).json({ error: '缺少 district 参数' });

    if (USE_SUPABASE) {
      const filters = [{ key: 'district_id', value: `eq.${district}` }];
      const all = await sbQuery('projects', {
        select: '*',
        order: 'floor_price.desc.nulls_last',
        filters,
      });
      const p = parseInt(page) || 1;
      const ps = parseInt(pageSize) || 30;
      const start = (p - 1) * ps;
      return res.json({ projects: all.slice(start, start + ps), total: all.length, page: p, pageSize: ps });
    }

    const all = localQueries.getProjectsByDistrict(district);
    const p = parseInt(page) || 1;
    const ps = parseInt(pageSize) || 30;
    const start = (p - 1) * ps;
    res.json({ projects: all.slice(start, start + ps), total: all.length, page: p, pageSize: ps });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.json([]);

    if (USE_SUPABASE) {
      const data = await sbQuery('projects', {
        select: '*,districts(name)',
        filters: [{ key: 'name', value: `ilike.*${keyword}*` }],
        limit: 50,
      });
      return res.json(data.map(d => ({ ...d, district_name: d.districts?.name || '' })));
    }
    res.json(localQueries.searchProjects(keyword));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/:id', (req, res) => {
  try {
    if (USE_SUPABASE) {
      return res.json({ project: { id: req.params.id }, buildings: [] });
    }
    const project = localQueries.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    const buildings = localQueries.getBuildings(req.params.id);
    res.json({ project, buildings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/:id/units', async (req, res) => {
  try {
    if (USE_SUPABASE) {
      const { building } = req.query;
      const filters = [{ key: 'project_id', value: `eq.${req.params.id}` }];
      if (building) filters.push({ key: 'building_id', value: `eq.${building}` });
      const data = await sbQuery('units', { select: '*', filters, limit: 500 });

      // 获取价格
      const unitIds = data.map(u => u.id);
      if (unitIds.length > 0) {
        // 分批获取价格
        const allPrices = [];
        for (let i = 0; i < unitIds.length; i += 50) {
          const batch = unitIds.slice(i, i + 50);
          const idFilter = batch.map(id => `unit_id=eq.${id}`).join(',');
          const prices = await sbQuery('price_snapshots', {
            select: 'unit_id,total_price,unit_price,discounted_unit_price',
            filters: [{ key: 'unit_id', value: `in.(${batch.join(',')})` }],
          });
          allPrices.push(...prices);
        }
        const priceMap = {};
        allPrices.forEach(p => { priceMap[p.unit_id] = p; });
        data.forEach(u => {
          const p = priceMap[u.id];
          if (p) {
            u.total_price = p.total_price;
            u.unit_price = p.unit_price;
            u.discounted_unit_price = p.discounted_unit_price;
          }
        });
      }
      return res.json(data);
    }
    const { building } = req.query;
    res.json(localQueries.getUnitsWithPrice(req.params.id, building || null));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/units/:id/history', (req, res) => {
  if (USE_SUPABASE) return res.json([]);
  res.json(localQueries.getPriceHistory(req.params.id));
});

app.get('/api/projects/:id/price-history', (req, res) => {
  if (USE_SUPABASE) return res.json([]);
  res.json(localQueries.getProjectPriceHistory(req.params.id));
});

app.get('/api/stats', async (_req, res) => {
  try {
    if (USE_SUPABASE) {
      const [pCount] = await sbQuery('projects', { select: 'count' });
      const [uCount] = await sbQuery('units', { select: 'count' });
      const [sCount] = await sbQuery('price_snapshots', { select: 'count' });
      return res.json({ project_count: pCount.count, unit_count: uCount.count, snapshot_count: sCount.count, last_scrape: null });
    }
    res.json(localQueries.getStats());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/scrape', async (_req, res) => {
  if (USE_SUPABASE) {
    return res.json({ status: 'disabled', message: '采集功能仅在本地版本可用' });
  }
  res.json({ status: 'started', message: '采集已开始' });
  try { await runScrape((msg) => console.log('[采集]', msg)); } catch (e) { console.error(e); }
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) res.sendFile(path.join(distPath, 'index.html'));
});

async function start() {
  if (!USE_SUPABASE) await initDb();
  const port = process.env.PORT || PORT;
  app.listen(port, () => {
    console.log(`佛山楼盘数据查看器已启动: http://localhost:${port} (${USE_SUPABASE ? 'Supabase' : 'Local'})`);
    if (!process.env.RENDER && !process.env.RAILWAY) {
      exec(`${process.platform === 'win32' ? 'start' : 'open'} http://localhost:${port}`);
    }
  });
}

start();