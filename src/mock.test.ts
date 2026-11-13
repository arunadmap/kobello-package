import { afterEach, describe, expect, it, vi } from 'vitest';
import { kobello } from './index';
import { installMock, type MockControls } from './mock';
import { PROTOCOL_VERSION } from './protocol';

let mock: MockControls;
afterEach(() => mock?.uninstall());

describe('mock storage', () => {
  it('stores JSON values as copies', async () => {
    mock = installMock();
    const settings = { theme: 'dark' };
    await kobello.storage.set('settings', settings);
    settings.theme = 'light';
    expect(await kobello.storage.get('settings')).toEqual({ theme: 'dark' });
    expect(await kobello.storage.keys()).toEqual(['settings']);
    await kobello.storage.delete('settings');
    expect(await kobello.storage.get('settings')).toBeUndefined();
  });

  it('needs the storage permission', async () => {
    mock = installMock({ app: { permissions: ['files'] } });
    await expect(kobello.storage.keys()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});

describe('mock files', () => {
  it('writes, reads, lists, renames and deletes', async () => {
    mock = installMock();
    await kobello.files.write('notes/a.md', '# Hello', { createDirs: true });
    expect(await kobello.files.read('notes/a.md')).toBe('# Hello');
    expect((await kobello.files.list('notes')).map((f) => f.name)).toEqual(['a.md']);
    await kobello.files.rename('notes', 'archive');
    expect(await kobello.files.stat('notes/a.md')).toBeNull();
    expect(await kobello.files.stat('archive/a.md')).toMatchObject({ type: 'file', size: 7 });
    await expect(kobello.files.delete('archive')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' }); // not empty
    await kobello.files.delete('archive/a.md');
    await kobello.files.delete('archive');
    expect(await kobello.files.list()).toEqual([]);
  });

  it('reads binary data', async () => {
    mock = installMock();
    await kobello.files.write('data.bin', new Uint8Array([1, 2, 3]));
    expect(await kobello.files.read('data.bin', { encoding: 'binary' })).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('refuses paths that leave the app folder', async () => {
    mock = installMock();
    for (const path of ['../secret.txt', '/etc/passwd', 'a/../../b', 'C:\\Windows\\x']) {
      await expect(kobello.files.write(path, 'x')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    }
  });

  it('needs the parent folder unless createDirs is set', async () => {
    mock = installMock();
    await expect(kobello.files.write('missing/a.txt', 'x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(kobello.files.read('nope.txt')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('mock notifications and links', () => {
  it('records notifications and delivers clicks', async () => {
    mock = installMock();
    const clicked: (string | undefined)[] = [];
    kobello.notifications.onClick((_id, tag) => clicked.push(tag));
    const id = await kobello.notifications.show({ title: 'Saved', tag: 'save' });
    mock.emit('notification.clicked', { id, tag: 'save' });
    expect(mock.notifications).toEqual([{ id, title: 'Saved', tag: 'save' }]);
    expect(clicked).toEqual(['save']);
  });

  it('opens only http, https and mailto links', async () => {
    mock = installMock();
    await kobello.links.open('https://example.com');
    await expect(kobello.links.open('file:///C:/Windows')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(mock.openedLinks).toEqual(['https://example.com']);
  });
});

it('reports the app info it was given', async () => {
  mock = installMock({ app: { id: 'com.example.notes', name: 'Notes' } });
  expect(await kobello.app.info()).toMatchObject({ id: 'com.example.notes', name: 'Notes' });
  expect(kobello.isAvailable()).toBe(true);
});

describe('mock matches the host rules', () => {
  it('refuses names Windows can\'t store', async () => {
    mock = installMock();
    const bad = ['con', 'NUL.txt', 'notes/aux.md', 'com1', 'LPT9.log', 'a.', 'a ', 'dir./b', 'a:b', 'a?b', 'a*b', 'a<b', 'a|b', 'a"b', 'a\0b', 'x'.repeat(1025)];
    for (const path of bad) {
      await expect(kobello.files.write(path, 'x'), path).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    }
    await kobello.files.write('console.md', 'x'); // only the exact device names are reserved
    await kobello.files.write('note-con.md', 'x');
  });

  it('accepts only strings and Uint8Array as file data', async () => {
    mock = installMock();
    for (const data of [123, { a: 1 }, [1, 2], null, new ArrayBuffer(2)]) {
      await expect(kobello.files.write('a.bin', data as unknown as string)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    }
  });

  it('limits file size to 50 MB', async () => {
    mock = installMock();
    await expect(kobello.files.write('big.bin', new Uint8Array(50 * 1024 * 1024 + 1))).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
  });

  it('refuses folders inside a file', async () => {
    mock = installMock();
    await kobello.files.write('a.txt', 'x');
    await expect(kobello.files.mkdir('a.txt/b')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(kobello.files.write('a.txt/b.txt', 'x')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(kobello.files.write('a.txt/b.txt', 'x', { createDirs: true })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('limits storage keys and values', async () => {
    mock = installMock();
    await expect(kobello.storage.set('k'.repeat(257), 1)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(kobello.storage.set('', 1)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(kobello.storage.set('big', 'x'.repeat(1024 * 1024))).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    const oneMillion = 'x'.repeat(1_000_000);
    for (let i = 0; i < 10; i++) await kobello.storage.set(`k${i}`, oneMillion);
    await expect(kobello.storage.set('k10', oneMillion)).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' }); // over 10 MB in all
    await kobello.storage.set('k0', 'small'); // replacing a value frees its space
  });

  it('limits notification text and rate', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      mock = installMock();
      await expect(kobello.notifications.show({ title: 't'.repeat(101) })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
      await expect(kobello.notifications.show({ title: 'Hi', body: 'b'.repeat(501) })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
      await expect(kobello.notifications.show({ title: 'Hi', tag: 't'.repeat(101) })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
      for (let i = 0; i < 10; i++) await kobello.notifications.show({ title: `Hi ${i}` });
      await expect(kobello.notifications.show({ title: 'One more' })).rejects.toMatchObject({ code: 'RATE_LIMITED' });
      vi.setSystemTime(Date.now() + 60_000);
      await kobello.notifications.show({ title: 'A minute later' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('only answers its own methods', async () => {
    mock = installMock();
    for (const method of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(await globalThis.__kobello?.invoke(method)).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED' } });
    }
  });

  it('uses the SDK protocol version and refuses to replace the real host', () => {
    mock = installMock();
    expect(globalThis.__kobello?.v).toBe(PROTOCOL_VERSION);
    mock.uninstall();
    globalThis.__kobello = { v: PROTOCOL_VERSION, invoke: async () => ({ ok: true, value: undefined }), on: () => () => {} };
    try {
      expect(() => installMock()).toThrow(/inside the Kobello desktop app/);
    } finally {
      globalThis.__kobello = undefined;
    }
  });
});
