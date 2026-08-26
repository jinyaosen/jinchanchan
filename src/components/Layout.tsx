import InputPanel from './InputPanel';
import ResultPanel from './ResultPanel';
import DetailPanel from './DetailPanel';

/** 三栏响应式布局：左侧输入、中间结果、右侧详情。移动端折叠为单栏。 */
export default function Layout() {
  return (
    <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
        <InputPanel />
        <ResultPanel />
        <DetailPanel />
      </div>
    </main>
  );
}
