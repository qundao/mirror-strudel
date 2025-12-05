/*
nodePools.mjs - Helper functions related to pooling and re-using audio nodes

Copyright (C) 2025 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/packages/superdough/nodePools.mjs>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const nodePools = new Map();
const POOL_KEY = Symbol('nodePoolKey');
const IS_WORKLET_DEAD = Symbol('nodePoolIsWorkletDead');
const MAX_POOL_SIZE = 64;

export const isPoolable = (node) => !!node[POOL_KEY];

export const releaseNodeToPool = (node) => {
  node.disconnect();
  if (node instanceof AudioScheduledSourceNode) {
    // not reusable
    return;
  }
  if (node[IS_WORKLET_DEAD]) {
    // Worklet already terminated, don't pool it
    return;
  }
  const key = node[POOL_KEY];
  if (key == null) return;
  const pool = nodePools.get(key) ?? [];
  if (pool.length < MAX_POOL_SIZE) {
    pool.push(new WeakRef(node));
    nodePools.set(key, pool);
  }
};

export const markWorkletAsDead = (worklet) => (worklet[IS_WORKLET_DEAD] = true);

// Attempt to get node from the pool. If this fails, fall back
// to building it with the factory
export const getNodeFromPool = (key, factory, params = {}) => {
  const pool = nodePools.get(key) ?? [];
  let node;
  while (pool.length) {
    const ref = pool.pop();
    node = ref?.deref();
    if (node != null && !node[IS_WORKLET_DEAD]) break;
  }
  if (node == null || node[IS_WORKLET_DEAD]) {
    node = factory();
  }
  node[POOL_KEY] = key;
  const paramMap = new Map();
  if (node instanceof AudioWorkletNode) {
    for (const [name, param] of node.parameters.entries()) {
      paramMap.set(name, param);
    }
  } else {
    for (const name of Object.getOwnPropertyNames(node)) {
      const value = node[name];
      if (value instanceof AudioParam) {
        paramMap.set(name, value);
      }
    }
  }
  const now = node.context?.currentTime ?? 0;
  paramMap.forEach((param, name) => {
    param.cancelScheduledValues(now);
    // Set values from `params` or restore defaults
    const target = params[name] !== undefined ? params[name] : param.defaultValue;
    param.setValueAtTime(target, now);
  });
  return node;
};
