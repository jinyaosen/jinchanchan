import { useEffect } from 'react';
import { Gauge, Image as ImageIcon, Layers, Share2 } from 'lucide-react';
import Layout from './components/Layout';
import { DEFAULT_CHAMPIONS, DEFAULT_TRAITS } from './data/defaultData';
import { useGameStore } from './store/gameStore';
import { exportResultAsPng } from './utils/exportImage';
import { copyShareUrl, parseShareHash } from './utils/share';

export default function App() {
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);
  const config = useGameStore((s) => s.config);
  const result = useGameStore((s) => s.result);

  useEffect(() => {
    const state = useGameStore.getState();
    if (state.champions.length === 0) {
      state.setData(DEFAULT_CHAMPIONS, DEFAULT_TRAITS);
    }

    // 从 URL hash 恢复分享配置
    const shared = parseShareHash(window.location.hash);
    if (shared) {
      state.setMode(shared.mode);
      state.updateConfig(shared.config);
    }
  }, []);

  const handleShare = async () => {
    try {
      await copyShareUrl(mode, config);
      window.alert('分享链接已复制到剪贴板');
    } catch {
      window.alert('复制失败，请手动复制地址栏链接');
    }
  };

  return (
    <div className="min-h-screen bg-ink text-primary">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔶</span>
            <h1 className="text-sm font-bold text-primary sm:text-base">
              金铲铲 S18 拼羁绊海克斯辅助
            </h1>
          </div>

          <div className="flex rounded-lg border border-line bg-panel p-1">
            <button
              onClick={() => setMode('maxTraits')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mode === 'maxTraits' ? 'bg-gold text-ink' : 'text-secondary hover:text-primary'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              羁绊最多
            </button>
            <button
              onClick={() => setMode('maxQuality')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mode === 'maxQuality' ? 'bg-gold text-ink' : 'text-secondary hover:text-primary'
              }`}
            >
              <Gauge className="h-3.5 w-3.5" />
              质量最强
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-secondary hover:border-gold hover:text-gold"
            >
              <Share2 className="h-3.5 w-3.5" />
              分享
            </button>
            <button
              onClick={() => result && exportResultAsPng(result, mode)}
              disabled={!result}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-secondary hover:border-gold hover:text-gold disabled:opacity-40"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              导出图片
            </button>
          </div>
        </div>
      </header>

      <Layout />
    </div>
  );
}
