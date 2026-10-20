import { afterEach, describe, expect, it } from 'vitest';
import { kobello, KobelloError, SDK_VERSION } from './index';
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
