import { create } from 'zustand';

export type PageType = 'dashboard' | 'district' | 'project' | 'search' | 'history';

interface AppState {
  currentPage: PageType;
  selectedDistrict: string | null;
  selectedProject: string | null;
  searchKeyword: string;
  historyUnitId: string | null;

  setPage: (page: PageType) => void;
  selectDistrict: (id: string) => void;
  selectProject: (id: string) => void;
  setSearchKeyword: (keyword: string) => void;
  viewPriceHistory: (unitId: string) => void;
  goBack: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'dashboard',
  selectedDistrict: null,
  selectedProject: null,
  searchKeyword: '',
  historyUnitId: null,

  setPage: (page) => set({
    currentPage: page,
    selectedDistrict: null,
    selectedProject: null,
    historyUnitId: null,
  }),

  selectDistrict: (id) => set({
    currentPage: 'district',
    selectedDistrict: id,
    selectedProject: null,
  }),

  selectProject: (id) => set({
    currentPage: 'project',
    selectedProject: id,
  }),

  setSearchKeyword: (keyword) => set({
    currentPage: 'search',
    searchKeyword: keyword,
  }),

  viewPriceHistory: (unitId) => set({
    currentPage: 'history',
    historyUnitId: unitId,
  }),

  goBack: () => {
    const state = get();
    if (state.currentPage === 'project') {
      set({ currentPage: 'district', selectedProject: null });
    } else if (state.currentPage === 'district') {
      set({ currentPage: 'dashboard', selectedDistrict: null });
    } else if (state.currentPage === 'history') {
      set({ currentPage: 'project', historyUnitId: null });
    } else {
      set({ currentPage: 'dashboard', searchKeyword: '' });
    }
  },
}));