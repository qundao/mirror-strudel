import { registerChainEffect, getFrequencyFromValue, getWorklet, logger, registerWorklet } from 'superdough';
import workletUrl from './worklet.mjs?audioworklet';

let kabel;
async function initKabelsalat() {
  const { SalatRepl } = await import('@kabelsalat/web');
  logger('[kabelsalat] ready');
  kabel = new SalatRepl({ localScope: true });
  return kabel;
}

initKabelsalat().catch((err) => {
  logger(`kabelsalat init failed: ${err}`);
});

const compileKabel = (code) => {
  if (!kabel) {
    throw new Error('kabelsalat still loading');
  }
  const node = kabel.evaluate(code);
  return node.compile({ log: false });
};

registerWorklet(workletUrl);

registerChainEffect('workletSrc', ({ audioContext, fx, value, chainID, start, gateEnd, releaseEnd }) => {
  const workletSrc = fx.workletSrc
    .replace(/\bpat\[(\d+)\]/g, (_, i) => fx.workletInputs[i])
    .replaceAll('sFreq', getFrequencyFromValue(value))
    .replaceAll('sGate', `cc('strudel-gate-${chainID}')`);
  const { src, ugens, registers } = compileKabel(workletSrc);
  const workletNode = getWorklet(audioContext, 'generic-processor', {}, { outputChannelCount: [2] });
  workletNode.port.postMessage({
    src,
    schema: { ugens, registers },
    start,
    gateEnd,
    end: releaseEnd,
  });
  return workletNode;
});
