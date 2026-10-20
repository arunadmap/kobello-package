import { afterEach, describe, expect, it } from 'vitest';
import { kobello } from './index';
import { installMock, type MockControls } from './mock';

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
