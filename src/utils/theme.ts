/** 费用颜色（1~5 费） */
export const COST_COLORS: Record<number, string> = {
  1: '#7A7A7A',
  2: '#2ECC71',
  3: '#3498DB',
  4: '#9B59B6',
  5: '#F1C40F',
};

export function costColor(cost: number): string {
  return COST_COLORS[cost] ?? '#8B92A8';
}
