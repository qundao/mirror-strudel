import * as ugens from '@kabelsalat/lib/src/ugens.js';

const blockSize = 128;

const UGENS = new Map(Object.entries(ugens));

class GenericProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.playPos = 0;
    const channels = 16;
    this.outputs = new Array(channels).fill(0);
    this.sources = new Array(channels).fill(0);
    this.gateEnded = false;
    this.started = false;
    this.port.onmessage = (event) => {
      let {
        src,
        schema: { ugens, registers },
        start,
        gateEnd,
        end,
      } = event.data;
      this.start = start;
      this.gateEnd = gateEnd;
      this.end = end;
      this.registers = new Array(registers).fill(0);
      this.src = `o.fill(0); // reset outputs\n${src}`;
      this.nodes = [];
      for (let i = 0; i < ugens.length; i++) {
        const ugen = ugens[i];
        const nodeClass = UGENS.get(ugen.type);
        const node = new nodeClass(i, ugen, sampleRate);
        if (node.type === 'cc' && ugen.inputs?.[0]?.includes('strudel-gate')) {
          node.setValue(1);
          this.gateNode = node;
        }
        this.nodes[i] = node;
      }
      this.genSample = new Function(
        'time',
        'nodes',
        'input',
        'r', // registers
        'o', // outputs
        's', // sources
        this.src,
      );
    };
  }
  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (currentTime >= this.end) {
      return false;
    } else if (this.genSample === undefined || currentTime < this.start) {
      // pending
      return true;
    }
    this.started = true;
    if (!this.gateEnded && currentTime > this.gateEnd) {
      this.gateNode?.setValue(0);
      this.gateEnded = true;
    }
    const output = outputs[0];
    const outL = output[0];
    const outR = output[1];
    for (let n = 0; n < blockSize; n++) {
      this.genSample(this.playPos, this.nodes, input ? input[n] : 0, this.registers, this.outputs, this.sources);
      const left = this.outputs[0];
      const right = this.outputs[1];
      // Spread to stereo if possible; else mixdown to mono
      if (outR) {
        outL[n] = left;
        outR[n] = right;
      } else {
        outL[n] = 0.5 * (left + right);
      }
      this.playPos += 1 / sampleRate;
    }
    return true;
  }
}
registerProcessor('generic-processor', GenericProcessor);
