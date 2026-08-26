import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Champion, GameConfig, SolverMode, SolverResult, Trait } from '../data/types';

interface GameStore {
  champions: Champion[];
  traits: Trait[];
  mode: SolverMode;
  config: GameConfig;
  result: SolverResult | null;
  isComputing: boolean;
  progress: number;
  progressMessage: string;
  error: string | null;

  setData: (champions: Champion[], traits: Trait[]) => void;
  setMode: (mode: SolverMode) => void;
  updateConfig: (partial: Partial<GameConfig>) => void;
  setComputing: (value: boolean) => void;
  setProgress: (progress: number, message: string) => void;
  setResult: (result: SolverResult | null) => void;
  setError: (error: string | null) => void;
}

export const DEFAULT_CONFIG: GameConfig = {
  population: 10,
  emblemCount: 2,
  luxDoubleTrait: null, // null = 自动最优，'' = 不触发，其它 = 指定羁绊名
  lockedHeroIds: [],
  emblemChoices: {},
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      champions: [],
      traits: [],
      mode: 'maxTraits',
      config: { ...DEFAULT_CONFIG },
      result: null,
      isComputing: false,
      progress: 0,
      progressMessage: '',
      error: null,

      setData: (champions, traits) => set({ champions, traits }),

      setMode: (mode) => set({ mode, result: null, error: null }),

      updateConfig: (partial) =>
        set((state) => ({ config: { ...state.config, ...partial }, error: null })),

      setComputing: (value) => set({ isComputing: value }),

      setProgress: (progress, message) => set({ progress, progressMessage: message }),

      setResult: (result) => set({ result }),

      setError: (error) => set({ error, isComputing: false }),
    }),
    {
      name: 'jinchanchan-s18-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        champions: state.champions,
        traits: state.traits,
        mode: state.mode,
        config: state.config,
      }),
    },
  ),
);
