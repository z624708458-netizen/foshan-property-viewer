const { getDb, saveDb } = require('./database');

function run(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  // 不在每次操作后自动保存，由调用方在合适时机调用 saveDb()
}

function getOne(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function getAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// 区域
function getDistricts() {
  return getAll("SELECT id, name, sort_order FROM districts ORDER BY sort_order");
}

// 项目（按区域，按单价降序）
// 计算并更新项目聚合数据（面积段、均价等）
function updateProjectAggregates(projectId) {
  run(`
    UPDATE projects SET
      area_min = (SELECT MIN(area) FROM units WHERE project_id = ? AND area > 0),
      area_max = (SELECT MAX(area) FROM units WHERE project_id = ? AND area > 0),
      avg_total_price = (SELECT AVG(ps.total_price) FROM price_snapshots ps JOIN units u ON ps.unit_id = u.id WHERE u.project_id = ? AND u.area > 0 AND ps.total_price > 0),
      avg_unit_price = (SELECT AVG(ps.unit_price) FROM price_snapshots ps JOIN units u ON ps.unit_id = u.id WHERE u.project_id = ? AND u.area > 0 AND ps.unit_price > 0),
      floor_price = (SELECT AVG(ps.unit_price) * 0.9 FROM price_snapshots ps JOIN units u ON ps.unit_id = u.id WHERE u.project_id = ? AND u.area > 0 AND ps.unit_price > 0)
    WHERE id = ?
  `, [projectId, projectId, projectId, projectId, projectId, projectId]);
}

function getProjectsByDistrict(districtId) {
  return getAll(`
    SELECT p.id, p.district_id, p.name, p.address, p.developer, p.last_updated_at,
      p.area_min, p.area_max, p.avg_total_price, p.avg_unit_price, p.floor_price
    FROM projects p
    WHERE p.district_id = ?
    ORDER BY p.floor_price DESC
  `, [districtId]);
}

function getProjectCounts(projectId) {
  return getOne(`
    SELECT
      (SELECT COUNT(*) FROM buildings WHERE project_id = ?) as building_count,
      (SELECT COUNT(*) FROM units WHERE project_id = ?) as unit_count
  `, [projectId, projectId]);
}

// 搜索项目
function searchProjects(keyword) {
  return getAll(`
    SELECT p.*, d.name as district_name
    FROM projects p
    JOIN districts d ON p.district_id = d.id
    WHERE p.name LIKE ? OR p.address LIKE ? OR p.developer LIKE ?
    ORDER BY p.last_updated_at DESC
    LIMIT 50
  `, [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]);
}

// 项目详情
function getProject(projectId) {
  return getOne("SELECT * FROM projects WHERE id = ?", [projectId]);
}

// 楼栋
function getBuildings(projectId) {
  return getAll("SELECT * FROM buildings WHERE project_id = ? ORDER BY name", [projectId]);
}

// 房源（按楼栋）
function getUnits(projectId, buildingId) {
  let sql = "SELECT * FROM units WHERE project_id = ?";
  const params = [projectId];
  if (buildingId) {
    sql += " AND building_id = ?";
    params.push(buildingId);
  }
  sql += " ORDER BY building_id, room_number";
  return getAll(sql, params);
}

// 房源价格（含最新价格快照）
function getUnitsWithPrice(projectId, buildingId) {
  let sql = `
    SELECT u.*,
      ps.total_price, ps.unit_price, ps.discounted_unit_price, ps.snapshot_date
    FROM units u
    LEFT JOIN price_snapshots ps ON u.id = ps.unit_id
      AND ps.snapshot_date = (SELECT MAX(snapshot_date) FROM price_snapshots WHERE unit_id = u.id)
    WHERE u.project_id = ?
  `;
  const params = [projectId];
  if (buildingId) {
    sql += " AND u.building_id = ?";
    params.push(buildingId);
  }
  sql += " ORDER BY u.building_id, u.room_number";
  return getAll(sql, params);
}

// 价格历史
function getPriceHistory(unitId) {
  return getAll(`
    SELECT * FROM price_snapshots
    WHERE unit_id = ?
    ORDER BY snapshot_date ASC
  `, [unitId]);
}

// 项目均价历史
function getProjectPriceHistory(projectId) {
  return getAll(`
    SELECT snapshot_date,
      AVG(unit_price) as avg_price,
      MIN(unit_price) as min_price,
      MAX(unit_price) as max_price,
      COUNT(*) as unit_count
    FROM price_snapshots ps
    JOIN units u ON ps.unit_id = u.id
    WHERE u.project_id = ?
    GROUP BY snapshot_date
    ORDER BY snapshot_date ASC
  `, [projectId]);
}

// 插入/更新项目
function upsertProject(project) {
  run(`
    INSERT INTO projects (id, district_id, name, address, developer, last_updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      developer = excluded.developer,
      last_updated_at = datetime('now','localtime')
  `, [project.id, project.districtId, project.name, project.address || '', project.developer || '']);
}

// 插入/更新楼栋
function upsertBuilding(building) {
  run(`
    INSERT INTO buildings (id, project_id, name, floor_count, unit_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      floor_count = excluded.floor_count,
      unit_count = excluded.unit_count
  `, [building.id, building.projectId, building.name, building.floorCount || 0, building.unitCount || 0]);
}

// 插入/更新房源
function upsertUnit(unit) {
  run(`
    INSERT INTO units (id, building_id, project_id, room_number, floor, area, unit_type, usage, orientation, status, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(project_id, building_id, room_number) DO UPDATE SET
      area = excluded.area,
      unit_type = excluded.unit_type,
      usage = excluded.usage,
      orientation = excluded.orientation,
      status = excluded.status,
      last_seen_at = datetime('now','localtime')
  `, [unit.id, unit.buildingId, unit.projectId, unit.roomNumber, unit.floor || 0, unit.area || 0, unit.unitType || '', unit.usage || '', unit.orientation || '', unit.status || '可售']);
}

// 插入价格快照
function insertPriceSnapshot(snapshot) {
  run(`
    INSERT INTO price_snapshots (id, unit_id, total_price, unit_price, discounted_unit_price, snapshot_date)
    VALUES (?, ?, ?, ?, ?, date('now','localtime'))
    ON CONFLICT(unit_id, snapshot_date) DO UPDATE SET
      total_price = excluded.total_price,
      unit_price = excluded.unit_price,
      discounted_unit_price = excluded.discounted_unit_price,
      scraped_at = datetime('now','localtime')
  `, [snapshot.id, snapshot.unitId, snapshot.totalPrice, snapshot.unitPrice, snapshot.discountedUnitPrice]);
}

// 获取最后采集时间
function getLastScrapeTime() {
  const row = getOne("SELECT value FROM app_settings WHERE key = 'last_scrape_time'");
  return row ? row.value : null;
}

// 更新最后采集时间
function setLastScrapeTime() {
  run(`
    INSERT INTO app_settings (key, value, updated_at) VALUES ('last_scrape_time', datetime('now','localtime'), datetime('now','localtime'))
    ON CONFLICT(key) DO UPDATE SET value = datetime('now','localtime'), updated_at = datetime('now','localtime')
  `);
}

// 统计
function getStats() {
  return getOne(`
    SELECT
      (SELECT COUNT(*) FROM projects) as project_count,
      (SELECT COUNT(*) FROM units) as unit_count,
      (SELECT COUNT(*) FROM price_snapshots) as snapshot_count,
      (SELECT value FROM app_settings WHERE key = 'last_scrape_time') as last_scrape
  `);
}

module.exports = {
  getDistricts,
  getProjectsByDistrict,
  getProjectCounts,
  updateProjectAggregates,
  searchProjects,
  getProject,
  getBuildings,
  getUnits,
  getUnitsWithPrice,
  getPriceHistory,
  getProjectPriceHistory,
  upsertProject,
  upsertBuilding,
  upsertUnit,
  insertPriceSnapshot,
  getLastScrapeTime,
  setLastScrapeTime,
  getStats,
};