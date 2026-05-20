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
let USE_SUPABASE = process.env.USE_SUPABASE === 'true';

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

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };
  if (params.count) headers['Prefer'] = 'count=exact';

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`Supabase: ${res.status}`);

  const result = { data: await res.json() };
  const range = res.headers.get('content-range');
  if (range) {
    // Content-Range: 0-29/3698
    result.total = parseInt(range.split('/')[1]) || 0;
  }
  return result;
}

const distPath = path.join(__dirname, '..', 'dist', 'renderer');
app.use(express.static(distPath));
app.use(express.json());

// ===== API 路由 =====

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), mode: USE_SUPABASE ? 'cloud' : 'local' });
});

app.get('/api/debug/supabase', async (_req, res) => {
  try {
    const test = await sbQuery('projects', { select: 'id,name', limit: 3 });
    res.json({ ok: true, first_3: test.data, supabase_url: SUPABASE_URL });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get('/api/districts', async (_req, res) => {
  try {
    if (USE_SUPABASE) {
      const result = await sbQuery('districts', { select: '*', order: 'sort_order' });
      return res.json(result.data);
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
      const ps = parseInt(pageSize) || 30;
      const p = parseInt(page) || 1;
      const raw = await sbQuery('projects', {
        select: '*',
        order: 'floor_price.desc.nullslast',
        filters,
        limit: ps,
        offset: (p - 1) * ps,
        count: true,
      });
      return res.json({ projects: raw.data, total: raw.total, page: p, pageSize: ps });
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
      const result = await sbQuery('projects', {
        select: '*,districts(name)',
        filters: [{ key: 'name', value: `ilike.*${keyword}*` }],
        limit: 50,
      });
      return res.json(result.data.map(d => ({ ...d, district_name: d.districts?.name || '' })));
    }
    res.json(localQueries.searchProjects(keyword));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    if (USE_SUPABASE) {
      const projList = await sbQuery('projects', { select: '*', filters: [{ key: 'id', value: `eq.${req.params.id}` }] });
      const project = projList.data?.[0] || { id: req.params.id, name: '', district_id: '' };
      // 从units获取楼栋列表（distinct building_id）
      const unitRes = await sbQuery('units', { select: 'building_id', filters: [{ key: 'project_id', value: `eq.${req.params.id}` }], limit: 500 });
      const bldIds = [...new Set((unitRes.data || []).map(u => u.building_id).filter(Boolean))];
      const buildings = bldIds.map(id => ({ id, project_id: req.params.id, name: id }));
      return res.json({ project, buildings });
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
      const result = await sbQuery('units', { select: '*', filters, limit: 300 });
      const data = result.data;

      // 获取价格（限10批避免超时）
      const unitIds = data.map(u => u.id);
      if (unitIds.length > 0) {
        const allPrices = [];
        for (let i = 0; i < Math.min(unitIds.length, 300); i += 50) {
          const batch = unitIds.slice(i, i + 50);
          try {
            const priceRes = await sbQuery('price_snapshots', {
              select: 'unit_id,total_price,unit_price,discounted_unit_price',
              filters: [{ key: 'unit_id', value: `in.(${batch.join(',')})` }],
            });
            allPrices.push(...priceRes.data);
          } catch (e) {
            // 价格查询失败不阻塞
          }
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

// 缓存统计数据
let cachedStats = null;
app.get('/api/stats', async (_req, res) => {
  try {
    if (USE_SUPABASE) {
      if (cachedStats) return res.json(cachedStats);
      try {
        const pRes = await sbQuery('projects', { select: '*', limit: 1, count: true });
        const uRes = await sbQuery('units', { select: '*', limit: 1, count: true });
        const sRes = await sbQuery('price_snapshots', { select: '*', limit: 1, count: true });
        cachedStats = { project_count: pRes.total, unit_count: uRes.total, snapshot_count: sRes.total, last_scrape: null };
      } catch (e) {
        // Supabase计数失败时返回缓存或默认值
        cachedStats = cachedStats || { project_count: 3698, unit_count: 2655395, snapshot_count: 247295, last_scrape: null };
      }
      return res.json(cachedStats);
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
  // 尝试检测Supabase可用性
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/districts?select=count`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (r.ok) {
      USE_SUPABASE = true;
      console.log('检测到Supabase, 使用云端模式');
    }
  } catch (e) {
    console.log('Supabase不可用, 使用本地模式');
  }

  if (!USE_SUPABASE) await initDb();
  const port = process.env.PORT || PORT;
  app.listen(port, () => {
    console.log(`佛山楼盘数据查看器已启动: http://localhost:${port} (${USE_SUPABASE ? 'Supabase' : 'Local'})`);
    if (!process.env.RAILWAY && !process.env.RENDER) {
      exec(`${process.platform === 'win32' ? 'start' : 'open'} http://localhost:${port}`);
    }
  });
}

start();