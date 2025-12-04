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

const getParams = (node) => {
  const params = new Set();
  node.parameters?.forEach((param) => params.add(param));
  const visited = new Set(); // prioritize deepest definition
  let proto = node;
  // Move up the prototype chain
  while (proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (visited.has(key)) continue;
      visited.add(key);
      const value = node[key];
      if (value instanceof AudioParam) {
        params.add(value);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }
  return params;
};

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
  const now = node.context?.currentTime ?? 0;
  getParams(node).forEach((param) => param.cancelScheduledValues(now));
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
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      if (node instanceof AudioWorkletNode) {
        node.parameters.get(key).value = value;
      } else {
        node.get(key).value = value;
      }
    }
  });
  return node;
};
