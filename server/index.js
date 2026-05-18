const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const { initDb } = require('./database');
const queries = require('./queries');
const { runScrape } = require('./scraper');

const app = express();
const PORT = 3456;

const distPath = path.join(__dirname, '..', 'dist', 'renderer');
app.use(express.static(distPath));
app.use(express.json());

// ===== API 路由 =====

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 统计信息
app.get('/api/stats', (_req, res) => {
  res.json(queries.getStats());
});

// 获取所有区域
app.get('/api/districts', (_req, res) => {
  res.json(queries.getDistricts());
});

// 获取某区域的项目（按单价降序，分页）
app.get('/api/projects', (req, res) => {
  const { district, page = '1', pageSize = '30' } = req.query;
  if (!district) {
    return res.status(400).json({ error: '缺少 district 参数' });
  }
  const all = queries.getProjectsByDistrict(district);
  const p = parseInt(page);
  const ps = parseInt(pageSize);
  const start = (p - 1) * ps;
  res.json({
    projects: all.slice(start, start + ps),
    total: all.length,
    page: p,
    pageSize: ps,
  });
});

// 搜索项目
app.get('/api/projects/search', (req, res) => {
  const { keyword } = req.query;
  if (!keyword) {
    return res.json([]);
  }
  res.json(queries.searchProjects(keyword));
});

// 项目详情
app.get('/api/projects/:id', (req, res) => {
  const project = queries.getProject(req.params.id);
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  const buildings = queries.getBuildings(req.params.id);
  res.json({ project, buildings });
});

// 项目房源（含价格）
app.get('/api/projects/:id/units', (req, res) => {
  const { building } = req.query;
  const units = queries.getUnitsWithPrice(req.params.id, building || null);
  res.json(units);
});

// 房源价格历史
app.get('/api/units/:id/history', (req, res) => {
  const history = queries.getPriceHistory(req.params.id);
  res.json(history);
});

// 项目价格历史（均价走势）
app.get('/api/projects/:id/price-history', (req, res) => {
  const history = queries.getProjectPriceHistory(req.params.id);
  res.json(history);
});

// 启动采集
app.post('/api/scrape', async (_req, res) => {
  res.json({ status: 'started', message: '采集已开始' });

  try {
    await runScrape((msg) => {
      console.log('[采集]', msg);
    });
    console.log('[采集] 完成');
  } catch (err) {
    console.error('[采集] 错误:', err.message);
  }
});

// 采集进度（SSE 或轮询，先返回简单状态）
app.get('/api/scrape/status', (_req, res) => {
  res.json({
    lastScrape: queries.getLastScrapeTime(),
    stats: queries.getStats(),
  });
});

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

async function start() {
  await initDb();
  const port = process.env.PORT || PORT;
  app.listen(port, () => {
    console.log(`佛山楼盘数据查看器已启动: http://localhost:${port}`);
    if (!process.env.RENDER && !process.env.RAILWAY) {
      const startCmd = process.platform === 'win32' ? 'start' : 'open';
      exec(`${startCmd} http://localhost:${port}`);
    }
  });
}

start();