const SUPABASE = 'https://dxlhuiaprsqcoihoipcb.supabase.co';
const KEY = 'sb_publishable_BJMp_O22dULvZhIgHna93w_KSGFe6kA';

async function sb(table: string, options: Record<string, string> = {}) {
  const url = new URL(`${SUPABASE}/rest/v1/${table}`);
  Object.entries(options).forEach(([k, v]) => {
    if (k !== 'count') url.searchParams.set(k, v);
  });
  const headers: Record<string, string> = { 'apikey': KEY };
  if (options.count) headers['Prefer'] = 'count=exact';
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const range = res.headers.get('content-range');
  return { data, total: range ? parseInt(range.split('/')[1]) : (Array.isArray(data) ? data.length : 0) };
}

async function sbGet(table: string, options: Record<string, string> = {}) {
  return (await sb(table, options)).data;
}

export interface District {
  id: string; name: string; sort_order: number;
}

export interface Project {
  id: string; district_id: string; name: string; address: string; developer: string;
  last_updated_at: string; area_min: number | null; area_max: number | null;
  avg_total_price: number | null; avg_unit_price: number | null; floor_price: number | null;
}

export interface Building {
  id: string; project_id: string; name: string;
}

export interface Unit {
  id: string; building_id: string; project_id: string; room_number: string;
  floor: number; area: number | null; unit_type: string; status: string;
  total_price: number | null; unit_price: number | null; discounted_unit_price: number | null;
}

export interface PriceSnapshot {
  id: string; unit_id: string; total_price: number;
  unit_price: number; discounted_unit_price: number; snapshot_date: string;
}

export interface Stats {
  project_count: number; unit_count: number; snapshot_count: number; last_scrape: string | null;
}

export const api = {
  getDistricts: () => sbGet('districts', { select: '*', order: 'sort_order' }),

  getStats: async (): Promise<Stats> => ({
    project_count: 3698, unit_count: 2655395, snapshot_count: 247295, last_scrape: null,
  }),

  getProjects: async (district: string, page = 1, pageSize = 30) => {
    const from = (page - 1) * pageSize;
    const result = await sb('projects', {
      select: '*', count: 'exact',
      district_id: `eq.${district}`,
      order: 'floor_price.desc.nullslast',
      limit: String(pageSize), offset: String(from),
    });
    return { projects: result.data, total: result.total, page, pageSize };
  },

  searchProjects: (keyword: string) =>
    sbGet('projects', { select: '*,districts(name)', name: `ilike.*${keyword}*`, limit: '50' }),

  getProject: async (id: string) => {
    const data = await sbGet('projects', { select: '*', id: `eq.${id}` });
    const project = data[0] || null;
    // 从buildings表获取楼栋名称
    const bldData = await sbGet('buildings', { select: '*', project_id: `eq.${id}`, limit: '200' });
    const buildings: Building[] = (bldData || []).map((b: any) => ({ id: b.id, project_id: b.project_id, name: b.name }));
    // 如果buildings表没有，从units提取building_id作为兜底
    if (!buildings.length) {
      const unitData = await sbGet('units', { select: 'building_id', project_id: `eq.${id}`, limit: '300' });
      const bldIds = [...new Set(unitData.map((u: any) => u.building_id).filter(Boolean))] as string[];
      return { project, buildings: bldIds.map(bid => ({ id: bid, project_id: id, name: bid })) };
    }
    return { project, buildings };
  },

  getUnits: async (projectId: string, buildingId?: string) => {
    let filter = `project_id=eq.${projectId}`;
    if (buildingId) filter += `&building_id=eq.${buildingId}`;
    const data = await sbGet('units', { select: '*', project_id: `eq.${projectId}`, limit: '300' } as any);
    // 批量取价格
    const ids = data.map((u: Unit) => u.id).slice(0, 200);
    const prices: any[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const p = await sbGet('price_snapshots', {
        select: 'unit_id,total_price,unit_price,discounted_unit_price',
        unit_id: `in.(${batch.join(',')})`,
      });
      prices.push(...p);
    }
    const priceMap: Record<string, any> = {};
    prices.forEach((p: any) => { priceMap[p.unit_id] = p; });
    return data.map((u: Unit) => {
      const p = priceMap[u.id];
      return p ? { ...u, total_price: p.total_price, unit_price: p.unit_price, discounted_unit_price: p.discounted_unit_price } : u;
    });
  },

  getPriceHistory: (unitId: string) =>
    sbGet('price_snapshots', { select: '*', unit_id: `eq.${unitId}`, order: 'snapshot_date' }),

  getProjectPriceHistory: async (_projectId: string) => [],

  startScrape: async () => { throw new Error('采集功能仅在本地版本可用'); },
};