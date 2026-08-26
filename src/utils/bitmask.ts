/**
 * 羁绊位掩码工具。
 * 为每个 general 羁绊分配一个 BigInt 位，英雄的羁绊集合压缩为一个 BigInt，
 * 便于快速做并集/交集/补集与 popcount 统计（用于剪枝与对称性判断）。
 */

export type TraitMask = bigint;

export function maskOf(index: number): TraitMask {
  return 1n << BigInt(index);
}

export function encodeTraits(indices: number[]): TraitMask {
  let mask = 0n;
  for (const i of indices) mask |= maskOf(i);
  return mask;
}

export function hasTrait(mask: TraitMask, index: number): boolean {
  return (mask & maskOf(index)) !== 0n;
}

export function union(a: TraitMask, b: TraitMask): TraitMask {
  return a | b;
}

export function andNot(mask: TraitMask, exclude: TraitMask): TraitMask {
  return mask & ~exclude;
}

/** BigInt popcount（汉明重量） */
export function popcount(mask: TraitMask): number {
  let m = mask;
  let count = 0;
  while (m !== 0n) {
    m &= m - 1n;
    count += 1;
  }
  return count;
}

export function decodeTraits(mask: TraitMask, indexToName: Map<number, string>): string[] {
  const result: string[] = [];
  let m = mask;
  let bit = 0;
  while (m !== 0n) {
    if ((m & 1n) !== 0n) {
      const name = indexToName.get(bit);
      if (name) result.push(name);
    }
    m >>= 1n;
    bit += 1;
  }
  return result;
}
