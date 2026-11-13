import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { isKobelloError, kobello, KobelloError, SDK_VERSION } from './index';
import { shell } from './shell';
import type { Bridge, Response } from './protocol';
import pkg from '../package.json';

/** A fake host that records calls and answers with `reply`. */
function fakeBridge(reply: (method: string, args: unknown) => Response = () => ({ ok: true, value: undefined })) {
  const calls: { method: string; args: unknown }[] = [];
  const listeners: Record<string, ((payload: unknown) => void)[]> = {};
  const bridge: Bridge = {
    v: 1,
    invoke: async (method, args) => {
      calls.push({ method, args });
      return reply(method, args);
    },
    on: (event, callback) => {
      (listeners[event] ??= []).push(callback);
      return () => { listeners[event] = listeners[event].filter((cb) => cb !== callback); };
    },
  };
  globalThis.__kobello = bridge;
  const emit = (event: string, payload: unknown) => listeners[event]?.forEach((cb) => cb(payload));
  return { calls, emit };
}

afterEach(() => { globalThis.__kobello = undefined; });

describe('outside Kobello', () => {
  it('reports that the host is unavailable', async () => {
    expect(kobello.isAvailable()).toBe(false);
    await expect(kobello.storage.get('x')).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
  });

  it('lets apps listen anyway, without doing anything', () => {
    const stop = kobello.notifications.onClick(() => {});
    const stopShortcut = shell.onShortcut(() => {});
    expect(() => { stop(); stopShortcut(); }).not.toThrow();
  });
});

describe('a broken or different host', () => {
  it('turns a rejected call into INTERNAL', async () => {
    fakeBridge(() => { throw new Error('IPC closed'); });
    const error = await kobello.storage.keys().catch((e) => e);
    expect(error).toBeInstanceOf(KobelloError);
    expect(error).toMatchObject({ code: 'INTERNAL' });
    expect(error.message).toContain('IPC closed');
  });

  it('turns a malformed answer into INTERNAL', async () => {
    for (const answer of [undefined, null, 'yes', {}, { ok: false }, { ok: false, error: { code: 1 } }]) {
      fakeBridge(() => answer as unknown as Response);
      await expect(kobello.storage.keys()).rejects.toMatchObject({ code: 'INTERNAL' });
    }
  });

  it('refuses a host that speaks another protocol version', async () => {
    const { calls } = fakeBridge();
    (globalThis.__kobello as Bridge).v = 2;
    await expect(kobello.host()).rejects.toMatchObject({ code: 'UNSUPPORTED', message: expect.stringContaining('protocol 2') });
    expect(calls).toEqual([]);
  });
});

describe('isKobelloError', () => {
  it('recognises errors from this and from another copy of the SDK', () => {
    // Another copy of the SDK has its own class, so instanceof fails but the name and code match.
    class OtherKobelloError extends Error { code = 'NOT_FOUND'; name = 'KobelloError'; }
    expect(isKobelloError(new KobelloError('NOT_FOUND', 'x'))).toBe(true);
    expect(isKobelloError(new OtherKobelloError('x'))).toBe(true);
    expect(isKobelloError(new Error('x'))).toBe(false);
    expect(isKobelloError({ name: 'KobelloError', code: 'NOT_FOUND' })).toBe(false);
    expect(isKobelloError(null)).toBe(false);
  });
});

it('types files.read by its encoding', () => {
  // Type-only checks: `npm run typecheck` fails if the overloads change. Nothing is called.
  const read = kobello.files.read;
  const encoding = 'binary' as 'utf8' | 'binary';
  expectTypeOf(() => read('a.txt')).returns.resolves.toEqualTypeOf<string>();
  expectTypeOf(() => read('a.bin', { encoding: 'binary' })).returns.resolves.toEqualTypeOf<Uint8Array>();
  expectTypeOf(() => read('a', { encoding })).returns.resolves.toEqualTypeOf<string | Uint8Array>();
});

describe('calls to the host', () => {
  it('sends the method name and arguments', async () => {
    const { calls } = fakeBridge();
    await kobello.storage.set('theme', 'dark');
    await kobello.files.read('a.txt');
    await kobello.files.write('b/c.txt', 'hi', { createDirs: true });
    await kobello.files.list();
    expect(calls).toEqual([
      { method: 'storage.set', args: { key: 'theme', value: 'dark' } },
      { method: 'files.read', args: { path: 'a.txt', encoding: 'utf8' } },
      { method: 'files.write', args: { path: 'b/c.txt', data: 'hi', createDirs: true } },
      { method: 'files.list', args: { dir: '' } },
    ]);
  });

  it('returns the host result', async () => {
    fakeBridge(() => ({ ok: true, value: 'dark' }));
    expect(await kobello.storage.get('theme')).toBe('dark');
  });

  it('turns host errors into KobelloError', async () => {
    fakeBridge(() => ({ ok: false, error: { code: 'PERMISSION_DENIED', message: 'no' } }));
    const error = await kobello.links.open('https://example.com').catch((e) => e);
    expect(error).toBeInstanceOf(KobelloError);
    expect(error).toMatchObject({ code: 'PERMISSION_DENIED', message: 'no' });
  });

  it('delivers events until unsubscribed', () => {
    const { emit } = fakeBridge();
    const clicked: string[] = [];
    const stop = kobello.notifications.onClick((id) => clicked.push(id));
    emit('notification.clicked', { id: 'n1' });
    stop();
    emit('notification.clicked', { id: 'n2' });
    expect(clicked).toEqual(['n1']);
  });

  it('uses the shell method names', async () => {
    const { calls } = fakeBridge();
    await shell.apps.uninstall('com.example.notes', { deleteData: false });
    await shell.views.show('com.example.notes', { x: 64, y: 0, width: 800, height: 600 });
    expect(calls.map((c) => c.method)).toEqual(['shell.apps.uninstall', 'shell.views.show']);
  });
});

it('SDK_VERSION matches package.json', () => {
  expect(SDK_VERSION).toBe(pkg.version);
});
