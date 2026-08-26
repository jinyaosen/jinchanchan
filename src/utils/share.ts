import type { GameConfig, SolverMode } from '../data/types';

interface SharePayload {
  mode: SolverMode;
  config: GameConfig;
}

/** 生成包含全部输入配置的分享 URL（放在 hash 中，刷新可恢复） */
export function buildShareUrl(mode: SolverMode, config: GameConfig): string {
  const payload = encodeURIComponent(JSON.stringify({ mode, config } satisfies SharePayload));
  return `${window.location.origin}${window.location.pathname}#${payload}`;
}

/** 从 URL hash 恢复配置 */
export function parseShareHash(hash: string): SharePayload | null {
  if (!hash || !hash.startsWith('#')) return null;
  try {
    const data = JSON.parse(decodeURIComponent(hash.slice(1))) as SharePayload;
    if (typeof data.mode !== 'string' || typeof data.config !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function copyShareUrl(mode: SolverMode, config: GameConfig): Promise<void> {
  const url = buildShareUrl(mode, config);
  return navigator.clipboard.writeText(url);
}
