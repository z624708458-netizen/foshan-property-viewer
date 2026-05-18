const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { saveDb } = require('./database');
const {
  upsertProject,
  upsertBuilding,
  upsertUnit,
  insertPriceSnapshot,
  setLastScrapeTime,
  updateProjectAggregates,
} = require('./queries');

const BASE_URL = 'https://fsfc.fszj.foshan.gov.cn';

// 区域代码映射
const DISTRICTS = [
  { code: 'c4', id: 'chancheng', name: '禅城区' },
  { code: 'c7', id: 'nanhai', name: '南海区' },
  { code: 'c10', id: 'shunde', name: '顺德区' },
  { code: 'c13', id: 'sanshui', name: '三水区' },
  { code: 'c19', id: 'gaoming', name: '高明区' },
];

// 请求频率控制
let lastRequestTime = 0;
const MIN_INTERVAL = 500; // 500ms between requests

async function rateLimit() {
  const now = Date.now();
  const diff = now - lastRequestTime;
  if (diff < MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - diff));
  }
  lastRequestTime = Date.now();
}

async function fetchPage(url) {
  await rateLimit();
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
    },
    timeout: 30000,
  });
  return response.data;
}

// 解析项目列表页
function parseProjectList(html, districtId) {
  const projects = [];
  // 匹配每个 <tr> 行中的项目名称和ID
  const rowRegex = /<td[^>]*title="([^"]*)"[^>]*onclick="window\.open\('\/loupan\/(\d+)\.html'/g;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const name = match[1].trim();
    const id = match[2];
    // 避免重复（一个项目行有多个td有onclick，只取第一个即项目名称td）
    if (!projects.find(p => p.id === id)) {
      projects.push({ id, districtId, name, address: name });
    }
  }

  return projects;
}

// 浏览器 escape() 函数，Node.js 需要手动实现
function escapeJs(str) {
  return str.replace(/[^\w@\-\*\+\_\.\/]/g, function(ch) {
    const code = ch.charCodeAt(0);
    if (code < 256) return '%' + ('0' + code.toString(16)).slice(-2).toUpperCase();
    return '%u' + ('000' + code.toString(16)).slice(-4).toUpperCase();
  });
}

// 解析项目详情页——获取楼栋列表（含 projectId 和 licenceId）
function parseBuildings(html) {
  const buildings = [];
  const regex = /onclick="openUrl\((\d+),'([^']*)',(\d+)\)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    buildings.push({
      projectId: match[1],
      name: match[2],
      licenceId: match[3],
      id: match[3], // 用 licenceId 作为楼栋ID
    });
  }
  return buildings;
}

// 通过AJAX获取指定楼栋的房源数据
async function fetchBuildingUnits(projectId, buildingName, licenceId) {
  const buildingNo = escapeJs(escapeJs(buildingName + '_' + licenceId));
  const params = new URLSearchParams();
  params.append('floorId', projectId);
  params.append('buildingNo', buildingNo);

  const response = await axios.post(
    `${BASE_URL}/pc/floor/house/ajaxToGetHouseModel.do`,
    params.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 30000,
      responseType: 'text',
    }
  );

  const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  if (!data.model || data.model.includes('noresult')) return [];
  return parseUnits(data.model, projectId, licenceId);
}

// 解析房源数据
// house_popup 参数 (18个): 房号,户型,预售证,用途,类型,属性,空,面积,隐藏价,套内面积,空2,公摊面积,空3,楼层,空4,状态,总价(元),地址
function parseUnits(html, projectId, buildingId) {
  const units = [];
  const regex = /house_popup\('([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'\)/g;

  let match;
  while ((match = regex.exec(html)) !== null) {
    const roomNumber = match[1];
    const unitType = match[2];
    const usage = match[4]; // 用途: 住宅/商业/办公/其他
    const area = match[8];
    const status = match[16];
    const totalPriceStr = match[17]; // 总价(元), 可售房源有值, 否则'-'

    const areaVal = area === '-' || area === '' ? null : parseFloat(area);
    const totalPriceYuan = totalPriceStr === '-' || totalPriceStr === '' ? null : parseFloat(totalPriceStr);

    // 单价: 总价(元) / 面积(㎡)
    let unitPriceVal = null;
    if (totalPriceYuan && areaVal && areaVal > 0) {
      unitPriceVal = Math.round(totalPriceYuan / areaVal * 100) / 100;
    }

    const unitId = `${projectId}_${buildingId}_${roomNumber}`;

    // 计算9折后单价
    let discountedUnitPrice = null;
    if (unitPriceVal) {
      discountedUnitPrice = Math.round(unitPriceVal * 0.9 * 100) / 100;
    }

    units.push({
      id: unitId,
      buildingId: String(buildingId),
      projectId: String(projectId),
      roomNumber: roomNumber,
      area: areaVal,
      unitType: unitType,
      usage: usage,
      status: status,
      totalPrice: totalPriceYuan,
      unitPrice: unitPriceVal,
      discountedUnitPrice: discountedUnitPrice,
    });
  }

  return units;
}

// 采集单个区域（住宅类型 _t1，分页 _pN）
async function scrapeDistrict(district, onProgress) {
  onProgress(`正在采集${district.name}(住宅)...`);

  const allProjectsMap = new Map();
  let totalPages = 1;

  // 先获取第1页，同时解析总页数
  const firstUrl = `${BASE_URL}/loupan/s/${district.code}_t1/`;
  const firstHtml = await fetchPage(firstUrl);

  // 解析总页数 (data-max属性)
  const maxMatch = firstHtml.match(/data-max="(\d+)"/);
  if (maxMatch) {
    totalPages = parseInt(maxMatch[1]);
    onProgress(`${district.name}: 共 ${totalPages} 页`);
  }

  // 采集第一页
  const firstProjects = parseProjectList(firstHtml, district.id);
  for (const p of firstProjects) {
    allProjectsMap.set(p.id, p);
  }

  // 采集剩余页
  for (let page = 2; page <= totalPages; page++) {
    const url = `${BASE_URL}/loupan/s/${district.code}_t1_p${page}/`;
    const html = await fetchPage(url);
    const pageProjects = parseProjectList(html, district.id);

    for (const p of pageProjects) {
      if (!allProjectsMap.has(p.id)) {
        allProjectsMap.set(p.id, p);
      }
    }

    if (page % 10 === 0) {
      onProgress(`${district.name}: ${page}/${totalPages} 页, 已发现 ${allProjectsMap.size} 个项目`);
    }

    await new Promise(resolve => setTimeout(resolve, 400));
  }

  const projects = [...allProjectsMap.values()];
  onProgress(`${district.name}: 找到 ${projects.length} 个项目 (${totalPages} 页)`);

  // 逐个采集项目详情（跳过已有数据的项目）
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];

    // 检查是否已有房源数据，有则跳过
    const existingUnits = queries.getUnits(project.id);
    if (existingUnits && existingUnits.length > 0) {
      if (i % 50 === 0) {
        onProgress(`${district.name}: [${i + 1}/${projects.length}] (跳过已采集的) ${project.name}`);
      }
      continue;
    }

    try {
      const html = await fetchPage(`${BASE_URL}/loupan/${project.id}.html`);

      upsertProject(project);

      const buildings = parseBuildings(html);
      for (const building of buildings) {
        building.projectId = project.id;
        upsertBuilding(building);
      }

      // 逐个楼栋通过AJAX获取房源
      let totalUnits = 0;
      for (const building of buildings) {
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
          const buildingUnits = await fetchBuildingUnits(project.id, building.name, building.licenceId);
          for (const unit of buildingUnits) {
            upsertUnit(unit);
            if (unit.totalPrice || unit.unitPrice) {
              insertPriceSnapshot({
                id: uuidv4(),
                unitId: unit.id,
                totalPrice: unit.totalPrice || 0,
                unitPrice: unit.unitPrice || 0,
                discountedUnitPrice: unit.discountedUnitPrice || 0,
              });
            }
          }
          totalUnits += buildingUnits.length;
        } catch (e) {
          // 单楼栋失败不影响整体
        }
      }

      saveDb();
      updateProjectAggregates(project.id);
      if (i % 5 === 0 || totalUnits > 50) {
        onProgress(`${district.name}: [${i + 1}/${projects.length}] ${project.name} — ${totalUnits}套`);
      }
    } catch (err) {
      onProgress(`${district.name}: ${project.name} 采集失败: ${err.message}`);
      try { saveDb(); } catch (e) { /* ignore */ }
    }

    // 项目间间隔
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  return projects.length;
}

// 主采集函数
async function runScrape(onProgress) {
  onProgress('开始采集佛山楼盘数据...');

  let totalProjects = 0;

  for (const district of DISTRICTS) {
    try {
      const count = await scrapeDistrict(district, onProgress);
      totalProjects += count;
    } catch (err) {
      onProgress(`${district.name} 采集失败: ${err.message}`);
    }

    // 区域间间隔5秒
    if (DISTRICTS.indexOf(district) < DISTRICTS.length - 1) {
      onProgress(`等待5秒后采集下一个区域...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  setLastScrapeTime();
  saveDb();
  onProgress(`采集完成! 共 ${totalProjects} 个项目`);

  return totalProjects;
}

module.exports = { runScrape, parseProjectList, parseBuildings, parseUnits, scrapeDistrict, fetchBuildingUnits };