import { getTheme, getDrawContext } from './draw.mjs';
import { Pattern } from '@strudel/core';

export function textbox({ haps, ctx, id, margin = 10, fontsize = 24 } = {}) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const color = getTheme().foreground;
  const centerX = w / 2;
  const centerY = h / 2;

  if (id) {
    haps = haps.filter((hap) => hap.hasTag(id));
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  haps.forEach((hap) => {
    if (hap.hasOnset()) {
      const hapColor = hap.value.color || color;
      ctx.strokeStyle = hapColor;
      ctx.fillStyle = hapColor;
      const { velocity = 1, gain = 1 } = hap.value || {};
      const alpha = velocity * gain;
      ctx.globalAlpha = alpha;
      ctx.font = `${fontsize}px sans-serif`;
      ctx.fillText(hap.value, 0, fontsize);
    }
  });

  return;
}

Pattern.prototype.textbox = function (options = {}) {
  let { ctx = getDrawContext(), id = 1 } = options;
  return this.tag(id).onPaint((_, time, haps) =>
    textbox({
      ...options,
      time,
      ctx,
      haps: haps.filter((hap) => hap.isActive(time)),
      id,
    }),
  );
};
