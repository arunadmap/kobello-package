// Sends SDK calls to the host through `window.__kobello`, which the host's preload script provides.

import { KobelloError } from './errors';
import { PROTOCOL_VERSION } from './protocol';
import type { Bridge, EventName, Events, Method, Methods, Response } from './protocol';

/** The host bridge, or undefined outside the Kobello desktop app. */
export const getBridge = (): Bridge | undefined => globalThis.__kobello;

function requireBridge(): Bridge {
  const bridge = getBridge();
  if (!bridge) throw new KobelloError('NOT_AVAILABLE', 'Not running inside the Kobello desktop app.');
  if (bridge.v !== PROTOCOL_VERSION) {
    throw new KobelloError(
      'UNSUPPORTED',
      `This Kobello speaks protocol ${String(bridge.v)}, but this SDK needs protocol ${PROTOCOL_VERSION}. ` +
        'Update Kobello, or use a version of @kobello-electron/sdk that matches it.',
    );
  }
  return bridge;
}

/** A host answer has to be { ok: true, value } or { ok: false, error: { code, message } }. */
function isResponse(value: unknown): value is Response {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as { ok?: unknown; error?: { code?: unknown; message?: unknown } };
  if (response.ok === true) return true;
  return response.ok === false && typeof response.error?.code === 'string' && typeof response.error.message === 'string';
}

/** Calls a host method and returns its result, or throws a KobelloError. */
export async function call<M extends Method>(method: M, ...args: Methods[M]['args'] extends void ? [] : [Methods[M]['args']]): Promise<Methods[M]['result']> {
  const bridge = requireBridge();
  let response: unknown;
  try {
    response = await bridge.invoke(method, args[0]);
  } catch (error) {
    // The host never rejects on purpose, so this is a broken bridge (for example IPC failed).
    throw new KobelloError('INTERNAL', `Kobello couldn't answer "${method}": ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isResponse(response)) throw new KobelloError('INTERNAL', `Kobello sent an unexpected answer to "${method}".`);
  if (!response.ok) throw new KobelloError(response.error.code, response.error.message);
  return response.value as Methods[M]['result'];
}

/**
 * Listens for a host event. Returns a function that stops listening.
 * Outside Kobello there are no events, so this does nothing and returns a no-op. That lets apps
 * subscribe (for example in a React effect) without first checking `isAvailable()`.
 */
export function listen<E extends EventName>(event: E, callback: (payload: Events[E]) => void): () => void {
  if (!getBridge()) return () => {};
  return requireBridge().on(event, (payload) => callback(payload as Events[E]));
}
