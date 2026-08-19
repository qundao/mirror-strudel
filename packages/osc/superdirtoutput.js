/* import { oscTriggerTauri } from '../desktopbridge/oscbridge.mjs';
import { isTauri } from '../desktopbridge/utils.mjs'; */
import { oscScheduler } from './osc.mjs';

const scheduler = /* isTauri() ? oscTriggerTauri : */ oscScheduler;

export const superdirtOutput = (hap, targetTime, cps) => scheduler(hap, targetTime, cps);
