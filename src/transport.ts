// Sends SDK calls to the host through `window.__kobello`, which the host's preload script provides.

import { KobelloError } from './errors';
import type { Bridge, EventName, Events, Method, Methods } from './protocol';

declare global {
  // eslint-disable-next-line no-var
  var __kobello: Bridge | undefined;
}

/** The host bridge, or undefined outside the Kobello desktop app. */
export const getBridge = (): Bridge | undefined => globalThis.__kobello;

function requireBridge(): Bridge {
  const bridge = getBridge();
  if (!bridge) throw new KobelloError('NOT_AVAILABLE', 'Not running inside the Kobello desktop app.');
  return bridge;
}

/** Calls a host method and returns its result, or throws a KobelloError. */
export async function call<M extends Method>(method: M, ...args: Methods[M]['args'] extends void ? [] : [Methods[M]['args']]): Promise<Methods[M]['result']> {
  const response = await requireBridge().invoke(method, args[0]);
  if (!response.ok) throw new KobelloError(response.error.code, response.error.message);
  return response.value as Methods[M]['result'];
}

/** Listens for a host event. Returns a function that stops listening. */
export function listen<E extends EventName>(event: E, callback: (payload: Events[E]) => void): () => void {
  return requireBridge().on(event, (payload) => callback(payload as Events[E]));
}
