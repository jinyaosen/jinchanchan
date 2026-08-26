import type { SolverMode, SolverResult } from '../data/types';
import { costColor } from './theme';

/**
 * 将当前阵容导出为 PNG。使用原生 Canvas 绘制，避免引入 html2canvas 依赖。
 */
export function exportResultAsPng(result: SolverResult, mode: SolverMode): void {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 背景
  ctx.fillStyle = '#0B0E14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 标题
  ctx.fillStyle = '#E8EAED';
  ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
  ctx.fillText(mode === 'maxTraits' ? '羁绊数量最大化阵容' : '阵容质量最强阵容', 48, 70);

  ctx.fillStyle = '#8B92A8';
  ctx.font = '20px "Microsoft YaHei", sans-serif';
  ctx.fillText(`人口占用 ${result.usedPopulation}`, 48, 110);
  if (mode === 'maxQuality' && result.qualityScore != null) {
    ctx.fillStyle = '#C9A96E';
    ctx.fillText(`质量分 ${result.qualityScore}`, 240, 110);
  }

  // 英雄卡片
  const heroY = 170;
  const startX = 48;
  const gap = 108;
  result.heroes.forEach((hero, i) => {
    const x = startX + i * gap;
    const color = costColor(hero.cost);
    ctx.fillStyle = '#151A24';
    ctx.beginPath();
    ctx.arc(x + 42, heroY + 42, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hero.name, x + 42, heroY + 52);
    ctx.font = '16px sans-serif';
    ctx.fillText(`${hero.cost}费`, x + 42, heroY + 82);
  });
  ctx.textAlign = 'left';

  // 激活羁绊
  ctx.fillStyle = '#C9A96E';
  ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
  ctx.fillText('激活羁绊', 48, 300);

  ctx.fillStyle = '#E8EAED';
  ctx.font = '20px "Microsoft YaHei", sans-serif';
  let line = 0;
  for (const trait of result.activeTraits) {
    const col = Math.floor(line / 8);
    const row = line % 8;
    ctx.fillText(trait, 48 + col * 300, 345 + row * 34);
    line += 1;
  }

  // 转职与拉克丝标注
  const emblems = Object.entries(result.emblemAllocations).map(([name, count]) => `${name}×${count}`);
  ctx.fillStyle = '#8B92A8';
  ctx.font = '18px "Microsoft YaHei", sans-serif';
  ctx.fillText(`转职分配：${emblems.length ? emblems.join('、') : '无'}`, 48, 700);
  if (result.luxDoubleTrait) {
    ctx.fillStyle = '#FF6B6B';
    ctx.fillText(`拉克丝双倍：${result.luxDoubleTrait}`, 48, 736);
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `金铲铲S18阵容-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
