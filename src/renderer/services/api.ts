const BASE = '/api';

async function request<T>(url: string): Promise<T> {
  const res = await fetch(BASE + url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface District {
  id: string;
  name: string;
  sort_order: number;
}

export interface Project {
  id: string;
  district_id: string;
  name: string;
  address: string;
  developer: string;
  last_updated_at: string;
  area_min: number | null;
  area_max: number | null;
  avg_total_price: number | null;
  avg_unit_price: number | null;
  floor_price: number | null;
}

export interface Building {
  id: string;
  project_id: string;
  name: string;
  floor_count: number;
  unit_count: number;
}

export interface Unit {
  id: string;
  building_id: string;
  project_id: string;
  room_number: string;
  floor: number;
  area: number | null;
  unit_type: string;
  orientation: string;
  status: string;
  total_price: number | null;
  unit_price: number | null;
  discounted_unit_price: number | null;
  snapshot_date: string | null;
}

export interface PriceSnapshot {
  id: string;
  unit_id: string;
  total_price: number;
  unit_price: number;
  discounted_unit_price: number;
  snapshot_date: string;
  scraped_at: string;
}

export interface ProjectPricePoint {
  snapshot_date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  unit_count: number;
}

export interface Stats {
  project_count: number;
  unit_count: number;
  snapshot_count: number;
  last_scrape: string | null;
}

export const api = {
  getDistricts: () => request<District[]>('/districts'),
  getStats: () => request<Stats>('/stats'),
  getProjects: (district: string, page = 1, pageSize = 30) =>
    request<{ projects: Project[]; total: number; page: number; pageSize: number }>(
      `/projects?district=${district}&page=${page}&pageSize=${pageSize}`
    ),
  searchProjects: (keyword: string) => request<Project[]>(`/projects/search?keyword=${encodeURIComponent(keyword)}`),
  getProject: (id: string) => request<{ project: Project; buildings: Building[] }>(`/projects/${id}`),
  getUnits: (projectId: string, buildingId?: string) => {
    const url = buildingId
      ? `/projects/${projectId}/units?building=${buildingId}`
      : `/projects/${projectId}/units`;
    return request<Unit[]>(url);
  },
  getPriceHistory: (unitId: string) => request<PriceSnapshot[]>(`/units/${unitId}/history`),
  getProjectPriceHistory: (projectId: string) => request<ProjectPricePoint[]>(`/projects/${projectId}/price-history`),
  startScrape: () => fetch(`${BASE}/scrape`, { method: 'POST' }),
};