// 将本地 SQLite 数据上传到 Supabase
const { initDb, getDb } = require('./database');
const queries = require('./queries');

const SUPABASE_URL = 'https://dxlhuiaprsqcoihoipcb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BJMp_O22dULvZhIgHna93w_KSGFe6kA';

async function supabasePost(table, rows) {
  if (!rows.length) return 0;

  // 分批上传，每批500条
  const batchSize = 500;
  let uploaded = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  上传${table}失败 (${i}-${i + batchSize}): ${res.status} ${err.substring(0, 200)}`);
      // 尝试单条上传
      for (const row of batch) {
        try {
          const r2 = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify(row),
          });
          if (r2.ok) uploaded++;
          else console.error(`  单条失败: ${row.id}`);
        } catch (e) {
          console.error(`  网络错误: ${e.message}`);
        }
      }
    } else {
      uploaded += batch.length;
    }

    process.stdout.write(`\r  ${table}: ${uploaded}/${rows.length}`);
    if (i + batchSize < rows.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  console.log('');
  return uploaded;
}

async function syncData() {
  console.log('连接本地数据库...');
  await initDb();
  const db = getDb();

  console.log('读取数据...');

  // 1. 上传项目数据（聚合字段）
  console.log('\n=== 上传项目 ===');
  const projects = queries.getProjectsByDistrict('chancheng');
  const nanhai = queries.getProjectsByDistrict('nanhai');
  const shunde = queries.getProjectsByDistrict('shunde');
  const sanshui = queries.getProjectsByDistrict('sanshui');
  const gaoming = queries.getProjectsByDistrict('gaoming');
  const allProjects = [...projects, ...nanhai, ...shunde, ...sanshui, ...gaoming];

  // 去重
  const uniqueProjects = [];
  const seen = new Set();
  for (const p of allProjects) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      uniqueProjects.push({
        id: p.id,
        district_id: p.district_id || '',
        name: p.name,
        address: p.address || p.name,
        developer: p.developer || '',
        area_min: p.area_min,
        area_max: p.area_max,
        avg_total_price: p.avg_total_price,
        avg_unit_price: p.avg_unit_price,
        floor_price: p.floor_price,
        last_updated_at: p.last_updated_at || new Date().toISOString(),
      });
    }
  }

  console.log(`  项目总数: ${uniqueProjects.length}`);
  const pCount = await supabasePost('projects', uniqueProjects);
  console.log(`  上传: ${pCount} 个项目`);

  // 2. 上传房源汇总（只上传有价格的住宅）
  console.log('\n=== 上传房源 ===');
  const allUnits = [];
  for (const p of uniqueProjects) {
    const units = queries.getUnits(p.id);
    if (units) {
      for (const u of units) {
        if (u.unit_price) {
          allUnits.push({
            id: u.id,
            building_id: u.building_id || '',
            project_id: u.project_id,
            room_number: u.room_number,
            area: u.area,
            unit_type: u.unit_type || '',
            usage: u.usage || '住宅',
            status: u.status || '可售',
            created_at: new Date().toISOString(),
          });
        }
      }
    }
    if (allUnits.length % 10000 === 0) {
      process.stdout.write(`\r  已读取 ${allUnits.length} 套...`);
    }
  }

  console.log(`\n  有价房源: ${allUnits.length}`);
  if (allUnits.length > 0) {
    const uCount = await supabasePost('units', allUnits.slice(0, 50000)); // 先传5万条
    console.log(`  上传: ${uCount} 套房源`);
  }

  // 3. 上传价格快照
  console.log('\n=== 上传价格快照 ===');
  const snapshots = [];
  const psResult = db.exec("SELECT id, unit_id, total_price, unit_price, discounted_unit_price, snapshot_date FROM price_snapshots LIMIT 100000");
  if (psResult.length && psResult[0].values) {
    for (const row of psResult[0].values) {
      snapshots.push({
        id: row[0],
        unit_id: row[1],
        total_price: row[2],
        unit_price: row[3],
        discounted_unit_price: row[4],
        snapshot_date: row[5],
      });
    }
  }

  console.log(`  快照: ${snapshots.length}`);
  const sCount = await supabasePost('price_snapshots', snapshots.slice(0, 50000));
  console.log(`  上传: ${sCount} 条快照`);

  console.log('\n===== 同步完成 =====');
  process.exit(0);
}

syncData().catch(err => {
  console.error('同步失败:', err.message);
  process.exit(1);
});