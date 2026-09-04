/// <reference lib="webworker" />
import type {
  PlanProgress,
  SolverProgress,
  WorkerRequest,
  WorkerResponse,
} from '../data/types';
import { runPlanner, runSolver } from './workerMain';

/**
 * Web Worker 入口与通信协议。
 * 主线程消息：
 *  - { type: 'solve', ...WorkerRequest }：开始求解
 *  - { type: 'cancel' }：请求取消当前求解
 * Worker 回传：
 *  - { type: 'progress', requestId, payload: SolverProgress }
 *  - { type: 'result', requestId, payload: SolverResult }
 *  - { type: 'error', requestId, payload: { message } }
 */
const ctx = self as unknown as DedicatedWorkerGlobalScope;

let cancelRequested = false;

ctx.onmessage = (event: MessageEvent) => {
  const msg = event.data as { type?: string };

  if (msg?.type === 'cancel') {
    cancelRequested = true;
    return;
  }

  if (msg?.type !== 'solve' && msg?.type !== 'plan') return;

  cancelRequested = false;
  const request = event.data as WorkerRequest;
  const isCancelled = () => cancelRequested;

  const post = (type: WorkerResponse['type'], payload: WorkerResponse['payload']): void => {
    const response: WorkerResponse = { type, requestId: request.requestId, payload };
    ctx.postMessage(response);
  };

  const onError = (err: unknown): void => {
    post('error', { message: err instanceof Error ? err.message : String(err) });
  };

  if (request.type === 'plan') {
    runPlanner(request, (progress: PlanProgress) => post('progress', progress), isCancelled)
      .then((result) => post('result', result))
      .catch(onError);
  } else {
    runSolver(request, (progress: SolverProgress) => post('progress', progress), isCancelled)
      .then((result) => post('result', result))
      .catch(onError);
  }
};
