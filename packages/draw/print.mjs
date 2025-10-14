import { getTheme, getDrawContext } from './draw.mjs';
import { Pattern } from '@strudel/core';

export function print({ haps, ctx, id, margin = 10, fontsize = 24 } = {}) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const color = getTheme().foreground;

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

Pattern.prototype.print = function (options = {}) {
  let { ctx = getDrawContext(), id = 1 } = options;
  this.draw(
    (haps, time) => {
      print({
        ...options,
        time,
        ctx,
        haps: haps.filter((hap) => hap.isActive(time)),
      });
    },
    {
      lookbehind: 0,
      lookahead: 0,
      id,
    },
  );

  return this;
};
