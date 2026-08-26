import type { SolverProgress, SolverResult, WorkerRequest, WorkerResponse } from '../data/types';
import { useGameStore } from '../store/gameStore';

/**
 * 主线程侧 Worker 管理：创建单例 Worker，封装 startSolve / cancelSolve。
 */

const SOLVE_TIME_LIMIT_MS = 3000;

let worker: Worker | null = null;
let currentRequestId: string | null = null;

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    if (!msg || msg.requestId !== currentRequestId) return;

    const store = useGameStore.getState();
    if (msg.type === 'progress') {
      const progress = msg.payload as SolverProgress;
      store.setProgress(progress.progress, progress.message ?? '');
      if (progress.result) store.setResult(progress.result);
    } else if (msg.type === 'result') {
      const result = msg.payload as SolverResult;
      store.setResult(result);
      store.setComputing(false);
      store.setProgress(1, result.approximate ? '计算完成（近似最优）' : '计算完成');
    } else if (msg.type === 'error') {
      const error = msg.payload as { message: string };
      store.setError(error.message);
    }
  };

  return worker;
}

export function startSolve(): void {
  const state = useGameStore.getState();
  if (state.isComputing) return;

  const { champions, traits, mode, config } = state;

  // 校验：锁定英雄总人口超限
  const lockedSlots = champions
    .filter((c) => config.lockedHeroIds.includes(c.id))
    .reduce((s, c) => s + c.slots, 0);
  if (lockedSlots > config.population) {
    state.setError('锁定英雄总人口超过人口上限，请调整配置');
    return;
  }

  const requestId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  currentRequestId = requestId;

  const request: WorkerRequest = {
    type: 'solve',
    requestId,
    mode,
    champions,
    traits,
    config,
    timeLimitMs: SOLVE_TIME_LIMIT_MS,
  };

  state.setComputing(true);
  state.setProgress(0, '正在计算最优组合...');
  state.setResult(null);

  getWorker().postMessage(request);
}

export function cancelSolve(): void {
  const state = useGameStore.getState();
  if (!state.isComputing) return;

  currentRequestId = null;
  getWorker().postMessage({ type: 'cancel' });
  state.setComputing(false);
  state.setProgress(0, '已取消计算');
}
