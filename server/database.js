const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'foshan.db');
let db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS districts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    district_id TEXT NOT NULL REFERENCES districts(id),
    name TEXT NOT NULL,
    address TEXT,
    developer TEXT,
    total_buildings INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    area_min REAL,
    area_max REAL,
    avg_total_price REAL,
    avg_unit_price REAL,
    floor_price REAL,
    first_seen_at TEXT DEFAULT (datetime('now', 'localtime')),
    last_updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_projects_district ON projects(district_id);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

CREATE TABLE IF NOT EXISTS buildings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    floor_count INTEGER,
    unit_count INTEGER,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_buildings_project ON buildings(project_id);

CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    room_number TEXT NOT NULL,
    floor INTEGER,
    area REAL,
    unit_type TEXT,
    orientation TEXT,
    usage TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT '可售',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    last_seen_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_units_building ON units(building_id);
CREATE INDEX IF NOT EXISTS idx_units_project ON units(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_units_room ON units(project_id, building_id, room_number);

CREATE TABLE IF NOT EXISTS price_snapshots (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL REFERENCES units(id),
    total_price REAL,
    unit_price REAL,
    discounted_unit_price REAL,
    snapshot_date TEXT NOT NULL,
    scraped_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_snapshots_unit ON price_snapshots(unit_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON price_snapshots(snapshot_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_dedup ON price_snapshots(unit_id, snapshot_date);

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'insert',
    synced INTEGER DEFAULT 0,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
`;

const DEFAULT_DISTRICTS = [
  { id: 'chancheng', name: '禅城区', sort_order: 1 },
  { id: 'nanhai', name: '南海区', sort_order: 2 },
  { id: 'shunde', name: '顺德区', sort_order: 3 },
  { id: 'sanshui', name: '三水区', sort_order: 4 },
  { id: 'gaoming', name: '高明区', sort_order: 5 },
];

async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
  db.run(SCHEMA);

  const existing = db.exec("SELECT COUNT(*) as c FROM districts")[0].values[0][0];
  if (existing === 0) {
    const stmt = db.prepare("INSERT INTO districts (id, name, sort_order) VALUES (?, ?, ?)");
    for (const d of DEFAULT_DISTRICTS) {
      stmt.run([d.id, d.name, d.sort_order]);
    }
    stmt.free();
  }

  return db;
}

function getDb() {
  if (!db) throw new Error('数据库未初始化，请先调用 initDb()');
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, buffer);
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { initDb, getDb, saveDb, closeDb, DB_PATH };