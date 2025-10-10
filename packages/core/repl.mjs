import { NeoCyclist } from './neocyclist.mjs';
import { Cyclist } from './cyclist.mjs';
import { evaluate as _evaluate } from './evaluate.mjs';
import { errorLogger, logger } from './logger.mjs';
import { setTime } from './time.mjs';
import { evalScope } from './evaluate.mjs';
import { register, Pattern, isPattern, silence, stack } from './pattern.mjs';

export function repl({
  defaultOutput,
  onEvalError,
  beforeEval,
  beforeStart,
  afterEval,
  getTime,
  transpiler,
  onToggle,
  editPattern,
  onUpdateState,
  sync = false,
  setInterval,
  clearInterval,
  id,
  mondo = false,
}) {
  const state = {
    schedulerError: undefined,
    evalError: undefined,
    code: '// LOADING',
    activeCode: '// LOADING',
    pattern: undefined,
    miniLocations: [],
    widgets: [],
    pending: false,
    started: false,
  };

  const transpilerOptions = {
    id,
  };

  const updateState = (update) => {
    Object.assign(state, update);
    state.isDirty = state.code !== state.activeCode;
    state.error = state.evalError || state.schedulerError;
    onUpdateState?.(state);
  };

  const TIMELINES = {
    currentOffsets: {},
    previousOffsets: {},
  };
  const schedulerOptions = {
    onTrigger: getTrigger({ defaultOutput, getTime }),
    getTime,
    onToggle: (started) => {
      updateState({ started });
      onToggle?.(started);
      if (!started) {
        // Reset timeline state
        TIMELINES.currentOffsets = {};
        TIMELINES.previousOffsets = {};
      }
    },
    setInterval,
    clearInterval,
    beforeStart,
  };

  // NeoCyclist uses a shared worker to communicate between instances, which is not supported on mobile chrome
  const scheduler =
    sync && typeof SharedWorker != 'undefined' ? new NeoCyclist(schedulerOptions) : new Cyclist(schedulerOptions);
  let pPatterns = {};
  let anonymousIndex = 0;
  let allTransform;
  let eachTransform;

  const hush = function () {
    pPatterns = {};
    anonymousIndex = 0;
    allTransform = undefined;
    eachTransform = undefined;
    return silence;
  };

  // helper to get a patternified pure value out
  function unpure(pat) {
    if (pat._Pattern) {
      return pat.__pure;
    }
    return pat;
  }

  const setPattern = async (pattern, autostart = true) => {
    pattern = editPattern?.(pattern) || pattern;
    await scheduler.setPattern(pattern, autostart);
    return pattern;
  };
  setTime(() => scheduler.now()); // TODO: refactor?

  const stop = () => scheduler.stop();
  const start = () => scheduler.start();
  const pause = () => scheduler.pause();
  const toggle = () => scheduler.toggle();
  const setCps = (cps) => {
    scheduler.setCps(unpure(cps));
    return silence;
  };

  /**
   * Changes the global tempo to the given cycles per minute
   *
   * @name setcpm
   * @alias setCpm
   * @param {number} cpm cycles per minute
   * @example
   * setcpm(140/4) // =140 bpm in 4/4
   * $: s("bd*4,[- sd]*2").bank('tr707')
   */
  const setCpm = (cpm) => {
    scheduler.setCps(unpure(cpm) / 60);
    return silence;
  };

  // TODO - not documented as jsdoc examples as the test framework doesn't simulate enough context for `each` and `all`..

  /** Applies a function to all the running patterns. Note that the patterns are groups together into a single `stack` before the function is applied. This is probably what you want, but see `each` for
   * a version that applies the function to each pattern separately.
   * ```
   * $: sound("bd - cp sd")
   * $: sound("hh*8")
   * all(fast("<2 3>"))
   * ```
   * ```
   * $: sound("bd - cp sd")
   * $: sound("hh*8")
   * all(x => x.pianoroll())
   * ```
   */
  let allTransforms = [];
  const all = function (transform) {
    allTransforms.push(transform);
    return silence;
  };
  /** Applies a function to each of the running patterns separately. This is intended for future use with upcoming 'stepwise' features. See `all` for a version that applies the function to all the patterns stacked together into a single pattern.
   * ```
   * $: sound("bd - cp sd")
   * $: sound("hh*8")
   * each(fast("<2 3>"))
   * ```
   */
  const each = function (transform) {
    eachTransform = transform;
    return silence;
  };

  /**
   * Aligns the pattern with the specified `timeline` by ID.
   *
   * More specifically, if a timeline ID is encountered for the first time, that moment
   * in time is marked as the "start" of that pattern. Thereafter, any other patterns aligned
   * with that same id will begin at that same moment in time.
   *
   * If a negative ID is supplied, the timeline will reset at the start of the next cycle.
   *
   * @param {number | Pattern} id Timeline id. Must be a number. Set to negative to reset the timeline.
   * @returns Pattern
   */
  const timeline = register('timeline', (id, pat) => {
    const behavior = 2;
    if (typeof id !== 'number') {
      logger(`[query] ${id} is not a valid timeline id. Please ensure it is a number. Defaulting to timeline 1.`);
      id = 1;
    }
    const { currentOffsets: state, previousOffsets: prev } = TIMELINES;
    const key = Math.abs(id);
    // For negative id we just let the pattern run without resetting, hence tracking `prev`
    let t = id < 0 ? prev[key] : state[key];
    // We default here instead of updating `state` to prevent the `draw` functions from
    // interfering with `state` when querying
    t ??= Math.ceil(getTime());
    return (
      pat
        .late(t)
        .onTrigger((hap) => {
          const T = Number(hap.part.begin);
          // Set state on the first trigger
          state[key] ??= T;
          prev[key] ??= T;
          if (id < 0) {
            // Restart on next cycle
            const nextCycle = Math.floor(T) + 1;
            switch (behavior) {
              case 0: {
                // Restart at start of next cycle
                state[key] = nextCycle;
                break;
              }
              case 1: {
                // Restart immediately
                state[key] = T;
                break;
              }
              case 2: {
                // Restart at next hap or next cycle, whichever comes first
                const haps = pat.queryArc(T, nextCycle).filter((h) => Number(h.part.begin) !== T);
                state[key] = haps.length ? Number(haps[0].part.begin) : nextCycle;
                break;
              }
            }
          } else {
            prev[key] = state[key];
          }
        }, false)
        // Add labels
        .withValue((v) => ({ ...v, timeline: id, offset: t }))
    );
  });

  // set pattern methods that use this repl via closure
  const injectPatternMethods = () => {
    Pattern.prototype.p = function (id) {
      if (typeof id === 'string' && (id.startsWith('_') || id.endsWith('_'))) {
        // allows muting a pattern x with x_ or _x
        return silence;
      }
      if (id === '$') {
        // allows adding anonymous patterns with $:
        id = `$${anonymousIndex}`;
        anonymousIndex++;
      }
      pPatterns[id] = this;
      return this;
    };
    Pattern.prototype.q = function (id) {
      return silence;
    };
    try {
      for (let i = 1; i < 10; ++i) {
        Object.defineProperty(Pattern.prototype, `d${i}`, {
          get() {
            return this.p(i);
          },
          configurable: true,
        });
        Object.defineProperty(Pattern.prototype, `p${i}`, {
          get() {
            return this.p(i);
          },
          configurable: true,
        });
        Pattern.prototype[`q${i}`] = silence;
      }
    } catch (err) {
      console.warn('injectPatternMethods: error:', err);
    }
    const cpm = register('cpm', function (cpm, pat) {
      return pat._fast(cpm / 60 / scheduler.cps);
    });
    return evalScope({
      all,
      each,
      hush,
      cpm,
      setCps,
      setcps: setCps,
      setCpm,
      setcpm: setCpm,
      timeline,
    });
  };

  const evaluate = async (code, autostart = true, shouldHush = true) => {
    if (!code) {
      throw new Error('no code to evaluate');
    }
    try {
      updateState({ code, pending: true });
      await injectPatternMethods();
      setTime(() => scheduler.now()); // TODO: refactor?
      await beforeEval?.({ code });
      allTransforms = []; // reset all transforms
      shouldHush && hush();

      if (mondo) {
        code = `mondolang\`${code}\``;
      }
      let { pattern, meta } = await _evaluate(code, transpiler, transpilerOptions);
      if (Object.keys(pPatterns).length) {
        let patterns = [];
        for (const [key, value] of Object.entries(pPatterns)) {
          patterns.push(value.withState((state) => state.setControls({ id: key })));
        }
        if (eachTransform) {
          // Explicit lambda so only element (not index and array) are passed
          patterns = patterns.map((x) => eachTransform(x));
        }
        pattern = stack(...patterns);
      } else if (eachTransform) {
        pattern = eachTransform(pattern);
      }
      if (allTransforms.length) {
        for (let i in allTransforms) {
          pattern = allTransforms[i](pattern);
        }
      }

      if (!isPattern(pattern)) {
        const message = `got "${typeof evaluated}" instead of pattern`;
        throw new Error(message + (typeof evaluated === 'function' ? ', did you forget to call a function?' : '.'));
      }
      logger(`[eval] code updated`);
      pattern = await setPattern(pattern, autostart);
      updateState({
        miniLocations: meta?.miniLocations || [],
        widgets: meta?.widgets || [],
        activeCode: code,
        pattern,
        evalError: undefined,
        schedulerError: undefined,
        pending: false,
      });
      afterEval?.({ code, pattern, meta });
      return pattern;
    } catch (err) {
      logger(`[eval] error: ${err.message}`, 'error');
      console.error(err);
      updateState({ evalError: err, pending: false });
      onEvalError?.(err);
    }
  };
  const setCode = (code) => updateState({ code });
  return { scheduler, evaluate, start, stop, pause, setCps, setPattern, setCode, toggle, state };
}

export const getTrigger =
  ({ getTime, defaultOutput }) =>
  async (hap, deadline, duration, cps, t) => {
    //   ^ this signature is different from hap.context.onTrigger, as set by Pattern.onTrigger(onTrigger)
    // TODO: get rid of deadline after https://codeberg.org/uzu/strudel/pulls/1004
    try {
      if (!hap.context.onTrigger || !hap.context.dominantTrigger) {
        await defaultOutput(hap, deadline, duration, cps, t);
      }
      if (hap.context.onTrigger) {
        // call signature of output / onTrigger is different...
        await hap.context.onTrigger(hap, getTime(), cps, t);
      }
    } catch (err) {
      errorLogger(err, 'getTrigger');
    }
  };
