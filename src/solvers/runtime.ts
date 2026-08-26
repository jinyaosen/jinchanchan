import type { SolverProgress, SolverResult } from '../data/types';

/**
 * 求解运行时控制器：统一管理超时、取消与进度上报，
 * 并在回溯过程中周期性让出事件循环，使 Worker 能及时处理 cancel 消息。
 */
export class Runtime {
  private startedAt = Date.now();
  private nodes = 0;

  constructor(
    private timeLimitMs: number,
    private isCancelledFn: () => boolean,
    private onProgress: (p: SolverProgress) => void,
  ) {}

  isCancelled(): boolean {
    return this.isCancelledFn();
  }

  timedOut(): boolean {
    return Date.now() - this.startedAt > this.timeLimitMs;
  }

  shouldStop(): boolean {
    return this.isCancelled() || this.timedOut();
  }

  async tick(): Promise<void> {
    this.nodes += 1;
    if (this.nodes % 1500 === 0) {
      // 让出事件循环，允许 Worker 处理 cancel / 保持 UI 可响应。
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  report(
    phase: SolverProgress['phase'],
    progress: number,
    message?: string,
    result?: SolverResult,
  ): void {
    this.onProgress({ phase, progress, message, result });
  }
}
