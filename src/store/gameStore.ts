import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Champion,
  GameConfig,
  PopulationPlan,
  SolverResult,
  Trait,
} from '../data/types';

interface GameStore {
  champions: Champion[];
  traits: Trait[];
  config: GameConfig;
  result: SolverResult | null;
  isComputing: boolean;
  progress: number;
  progressMessage: string;
  plan: PopulationPlan | null;
  isPlanning: boolean;
  planProgress: number;
  planProgressMessage: string;
  error: string | null;

  setData: (champions: Champion[], traits: Trait[]) => void;
  updateConfig: (partial: Partial<GameConfig>) => void;
  setComputing: (value: boolean) => void;
  setProgress: (progress: number, message: string) => void;
  setResult: (result: SolverResult | null) => void;
  setPlan: (plan: PopulationPlan | null) => void;
  setPlanning: (value: boolean) => void;
  setPlanProgress: (progress: number, message: string) => void;
  setError: (error: string | null) => void;
}

export const DEFAULT_CONFIG: GameConfig = {
  population: 10,
  emblemCount: 2,
  luxDoubleTrait: null, // null = 自动最优，'' = 不触发，其它 = 指定羁绊名
  includeKhazix: false,
  khazixEvolvedTraits: [], // 可多选：裁决使/迅捷射手/狂战士/法师
  lockedHeroIds: [],
  emblemChoices: {},
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      champions: [],
      traits: [],
      config: { ...DEFAULT_CONFIG },
      result: null,
      isComputing: false,
      progress: 0,
      progressMessage: '',
      plan: null,
      isPlanning: false,
      planProgress: 0,
      planProgressMessage: '',
      error: null,

      setData: (champions, traits) => set({ champions, traits }),

      updateConfig: (partial) =>
        set((state) => ({ config: { ...state.config, ...partial }, error: null })),

      setComputing: (value) => set({ isComputing: value }),

      setProgress: (progress, message) => set({ progress, progressMessage: message }),

      setResult: (result) => set({ result }),

      setPlan: (plan) => set({ plan }),

      setPlanning: (value) => set({ isPlanning: value }),

      setPlanProgress: (progress, message) => set({ planProgress: progress, planProgressMessage: message }),

      setError: (error) => set({ error, isComputing: false }),
    }),
    {
      name: 'jinchanchan-s18-store-v7',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        champions: state.champions,
        traits: state.traits,
        config: state.config,
      }),
    },
  ),
);
