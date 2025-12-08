/*
audioGraph.mjs - Shadow web audio graph used for managing connections
Copyright (C) 2025 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/packages/superdough/audioGraph.mjs>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { logger } from './logger.mjs';

// This helper should be used instead of the `node.onended = callback` pattern
// It adds a mechanism to help minimize gc retention
export const onceEnded = (node, callback) => {
  const onended = callback;
  node.onended = function cleanup() {
    onended && onended();
    this.onended = null;
  };
};

export const releaseAudioNode = (node) => {
  if (node == null) return;

  // check we received an AudioNode
  if (!(node instanceof AudioNode)) {
    throw new Error('releaseAudioNode can only release an AudioNode');
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/disconnect
  node.disconnect();

  // make sure all AudioScheduledSourceNodes are in a stopped state
  // https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode
  if (node instanceof AudioScheduledSourceNode) {
    if (node.onended && node.onended.name !== 'cleanup') {
      logger(
        `[superdough] Deprecation warning: it seems your code path is setting 'node.onended = callback' instead of using the onceEnded helper`,
      );
    }
    try {
      node.stop();
    } catch (e) {
      // At the stage, `start` was not called on the node
      // but an `onended` callback releasing resources may exist
      // and we want it to fire :
      // - we force a start/stop cycle so that `onended` gets called
      // - we `lock` the node so that no-one can start it
      node.start(node.context.currentTime + 5); // will never happen
      node.stop();
    }
  }

  // https://www.w3.org/TR/webaudio-1.1/#AudioNode-actively-processing
  // An AudioWorkletNode is actively processing when its AudioWorkletProcessor's [[callable process]]
  // returns true and either its active source flag is true or
  // any AudioNode connected to one of its inputs is actively processing.
  if (node instanceof AudioWorkletNode) {
    // while `end` is not native to the web audio API, it is common practice in superdough
    // to use that param in the worklets to trigger returning false from the processor
    node.parameters.get('end')?.setValueAtTime(0, 0);
  }
};

// Once the `anchor` node has ended, release all nodes in `toCleanup`
export const cleanupOnEnd = (anchor, toCleanup) => {
  onceEnded(anchor, () => toCleanup.forEach((n) => releaseAudioNode(n)));
};

class Edge {
  constructor(from, to) {
    this.from = new WeakRef(from);
    this.to = new WeakRef(to);
    this.subGraphs = new Set();
  }
}

class SubGraph {
  constructor(id) {
    this.id = id;
    this.edges = [];
  }
  disconnect() {
    for (const edge of this.edges) {
      const from = edge.from.deref();
      const to = edge.to.deref();
      from && to && from.disconnect(to);
    }
    this.edges = null;
  }
  release() {
    for (const edge of this.edges) {
      const from = edge.from.deref();
      if (from instanceof AudioNode) {
        releaseAudioNode(from);
      }
    }
    this.edges = null;
  }
}

let audioGraph;
class AudioGraph {
  constructor() {
    this.activeSubGraphs = [];
    this.subGraphs = {};
    this.id = 0;
  }

  connect(from, to) {
    const edge = new Edge(from, to);
    for (const subGraph of this.activeSubGraphs) {
      edge.subGraphs.add(subGraph.name);
      subGraph.edges.add(edge);
    }
    return from.connect(to);
  }

  asSubGraph(fn) {
    const subGraph = new SubGraph(this.id);
    this.id++;
    this.subGraphs[this.id] = subGraph;
    this.activeSubGraphs.push(subGraph);
    try {
      return { subGraph, output: fn() };
    } finally {
      this.activeSubGraphs.pop();
    }
  }
}

export const getAudioGraph = () => {
  if (audioGraph === undefined) {
    audioGraph = new AudioGraph();
  }
  return audioGraph;
};
