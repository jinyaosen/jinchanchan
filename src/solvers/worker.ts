/// <reference lib="webworker" />
import type { SolverProgress, WorkerRequest, WorkerResponse } from '../data/types';
import { runSolver } from './workerMain';

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

  if (msg?.type === 'solve') {
    cancelRequested = false;
    const request = event.data as WorkerRequest;

    const onProgress = (progress: SolverProgress): void => {
      const response: WorkerResponse = {
        type: 'progress',
        requestId: request.requestId,
        payload: progress,
      };
      ctx.postMessage(response);
    };

    runSolver(request, onProgress, () => cancelRequested)
      .then((result) => {
        const response: WorkerResponse = {
          type: 'result',
          requestId: request.requestId,
          payload: result,
        };
        ctx.postMessage(response);
      })
      .catch((err: unknown) => {
        const response: WorkerResponse = {
          type: 'error',
          requestId: request.requestId,
          payload: { message: err instanceof Error ? err.message : String(err) },
        };
        ctx.postMessage(response);
      });
  }
};
