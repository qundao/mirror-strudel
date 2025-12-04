/*
worklets-common.mjs - Common worklet code

Copyright (C) 2025 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/packages/superdough/worklets-common.mjs>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// Mixin to make class "reusable" (i.e. have a begin and end and properly handle `initialize` messages)
export const makeReusable = (Base) =>
  class extends Base {
    static get parameterDescriptors() {
      return [
        ...(super.parameterDescriptors ?? []),
        {
          name: 'begin',
          defaultValue: 0,
          min: 0,
          max: Number.POSITIVE_INFINITY,
          automationRate: 'k-rate',
        },
        {
          name: 'end',
          defaultValue: 0,
          min: 0,
          max: Number.POSITIVE_INFINITY,
          automationRate: 'k-rate',
        },
      ];
    }

    constructor(options) {
      super(options);
      this.isAlive = true;
      this.graceSeconds = options?.processorOptions?.graceSeconds ?? 0.5;

      this.port.onmessage = (e) => {
        const { type, payload } = e.data || {};
        if (type === 'initialize') {
          this.initialize(payload);
        } else if (this.handlePortMessage) {
          this.handlePortMessage(type, payload, e);
        }
      };
      this.initialize();
    }

    initialize(_options) {
      // defined on subclasses
    }

    processActive(_inputs, _outputs, _params) {
      // processing subclasses should do when we're between begin/end
      return true;
    }

    process(inputs, outputs, params) {
      const begin = params.begin[0];
      const end = params.end[0];
      if (currentTime >= end + this.graceSeconds) {
        if (this.isAlive) {
          this.port.postMessage({ type: 'died' });
          this.isAlive = false;
        }
        return false;
      }
      if (currentTime < begin || currentTime >= end) {
        return true;
      }
      return this.processActive(inputs, outputs, params);
    }
  };
