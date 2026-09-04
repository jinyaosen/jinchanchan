import { useGameStore } from '../store/gameStore';
import { KHAZIX_EVOLVE_TRAITS, findKhazix } from '../utils/khazix';

export default function KhazixConfig() {
  const champions = useGameStore((s) => s.champions);
  const traits = useGameStore((s) => s.traits);
  const config = useGameStore((s) => s.config);
  const updateConfig = useGameStore((s) => s.updateConfig);

  const khazix = findKhazix(champions);
  if (!khazix) return null;

  const traitByName = new Map(traits.map((t) => [t.name, t]));
  const include = config.includeKhazix;
  const selected = config.khazixEvolvedTraits ?? [];

  const toggleTrait = (name: string) => {
    const next = selected.includes(name)
      ? selected.filter((n) => n !== name)
      : [...selected, name];
    updateConfig({ khazixEvolvedTraits: next });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-primary">卡兹克 · 宿敌</span>
        <span className="text-[10px] text-secondary">击杀进化额外羁绊</span>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-secondary">
        <input
          type="checkbox"
          checked={include}
          onChange={(e) => updateConfig({ includeKhazix: e.target.checked })}
          className="accent-[#C9A96E]"
        />
        启用卡兹克（强制上场）
      </label>

      {include && (
        <div className="grid grid-cols-2 gap-1.5">
          {KHAZIX_EVOLVE_TRAITS.map((name) => {
            const trait = traitByName.get(name);
            const thresholds = trait ? trait.thresholds.join('/') : '';
            const active = selected.includes(name);
            return (
              <button
                key={name}
                onClick={() => toggleTrait(name)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] transition ${
                  active ? 'border-gold bg-gold/10 text-gold' : 'border-line bg-ink text-secondary'
                }`}
              >
                {name}{thresholds ? `（${thresholds}）` : ''}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-disabled">
        启用后卡兹克固定上场，自带「宿敌」计入羁绊数；击杀数越多，可依次勾选解锁多个进化羁绊，最多同时拥有裁决使/迅捷射手/狂战士/法师四个。
      </p>
      <p className="text-[10px] text-disabled">
        运营规划模块启用卡兹克后会自主解锁进化羁绊，请勿重复勾选。
      </p>
    </div>
  );
}
