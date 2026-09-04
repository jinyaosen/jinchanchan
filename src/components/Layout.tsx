import { useState } from 'react';
import InputPanel from './InputPanel';
import ResultPanel from './ResultPanel';
import DetailPanel from './DetailPanel';
import PlanPanel from './PlanPanel';

type ResultTab = 'single' | 'plan';

/** 三栏响应式布局：左侧输入、中间结果、右侧详情。移动端折叠为单栏。 */
export default function Layout() {
  const [tab, setTab] = useState<ResultTab>('single');

  return (
    <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
        <InputPanel />
        <div className="space-y-3">
          <div className="flex rounded-lg border border-line bg-panel p-1">
            <button
              type="button"
              onClick={() => setTab('single')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                tab === 'single' ? 'bg-gold text-ink' : 'text-secondary hover:text-primary'
              }`}
            >
              单局最优
            </button>
            <button
              type="button"
              onClick={() => setTab('plan')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                tab === 'plan' ? 'bg-gold text-ink' : 'text-secondary hover:text-primary'
              }`}
            >
              运营规划
            </button>
          </div>
          {tab === 'single' ? <ResultPanel /> : <PlanPanel />}
        </div>
        <DetailPanel />
      </div>
    </main>
  );
}
