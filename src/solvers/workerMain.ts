import type { SolverProgress, SolverResult, WorkerRequest } from '../data/types';
import { solveMaxTraits } from './backtrackA';
import { solveMaxQuality } from './backtrackB';
import { prepareSolverData } from './common';

/**
 * Worker 内执行入口：预处理数据后按模式分发到对应求解器。
 * 注意：这里返回 Promise，求解过程中通过 onProgress 持续回传进度与当前最优解。
 */
export async function runSolver(
  request: WorkerRequest,
  onProgress: (p: SolverProgress) => void,
  isCancelled: () => boolean,
): Promise<SolverResult> {
  const data = prepareSolverData(request.champions, request.traits, request.config, request.mode);

  // 锁定英雄总人口超限时直接报错，由主线程展示。
  if (data.remainingPopulation < 0) {
    throw new Error('锁定英雄总人口超过人口上限，请调整配置');
  }
  if (data.candidates.length === 0 && data.lockedHeroes.length === 0) {
    throw new Error('没有可用英雄（排除/锁定配置后候选为空）');
  }

  if (request.mode === 'maxQuality') {
    return solveMaxQuality(data, onProgress, isCancelled, request.timeLimitMs);
  }
  return solveMaxTraits(data, onProgress, isCancelled, request.timeLimitMs);
}
