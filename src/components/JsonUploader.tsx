import { useState } from 'react';
import { Upload } from 'lucide-react';
import type { Champion, Trait } from '../data/types';
import { normalizeDataset, parseChampions, parseTraits } from '../data/loader';
import { useGameStore } from '../store/gameStore';

export default function JsonUploader() {
  const setData = useGameStore((s) => s.setData);
  const storeChampions = useGameStore((s) => s.champions);
  const storeTraits = useGameStore((s) => s.traits);
  const [message, setMessage] = useState<string | null>(null);

  function readFile(file: File): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result)));
        } catch (err) {
          reject(new Error(`文件 ${file.name} 不是合法 JSON`));
        }
      };
      reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`));
      reader.readAsText(file);
    });
  }

  function apply(champions: Champion[], traits: Trait[]): void {
    try {
      const normalized = normalizeDataset(champions, traits);
      setData(normalized.champions, normalized.traits);
      setMessage('数据导入成功');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function onChampionsFile(file: File | undefined) {
    if (!file) return;
    try {
      const raw = await readFile(file);
      const champions = parseChampions(raw);
      apply(champions, storeTraits);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function onTraitsFile(file: File | undefined) {
    if (!file) return;
    try {
      const raw = await readFile(file);
      const traits = parseTraits(raw, storeChampions);
      apply(storeChampions, traits);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-secondary">
        <Upload className="h-4 w-4" />
        导入数据
      </div>
      <div className="flex gap-2">
        <label className="flex-1 cursor-pointer rounded-lg border border-line bg-ink px-3 py-2 text-center text-xs text-secondary hover:border-gold">
          上传 champions.json
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => onChampionsFile(e.target.files?.[0])}
          />
        </label>
        <label className="flex-1 cursor-pointer rounded-lg border border-line bg-ink px-3 py-2 text-center text-xs text-secondary hover:border-gold">
          上传 traits.json
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => onTraitsFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {message && <p className="text-[10px] text-secondary">{message}</p>}
    </div>
  );
}
