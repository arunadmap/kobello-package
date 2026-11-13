// @kobello-electron/sdk/mock: an in-memory stand-in for the Kobello desktop app.
// Use it in unit tests, or to preview an app in a normal browser while developing.
// Nothing is saved: everything is lost when the page reloads.
// It checks paths, sizes and rate limits the same way the real app does (see rules.ts).
//
//   import { installMock } from '@kobello-electron/sdk/mock';
//   const mock = installMock({ app: { id: 'com.example.notes' } });

import { isKobelloError } from './errors';
import type { AppInfo, Bridge, EventName, Events, FileInfo, HostInfo, NotificationOptions, Permission } from './protocol';
import { PROTOCOL_VERSION } from './protocol';
import { byteLength, checkLink, checkPath, fail, LIMITS, requireString } from './rules';

export interface MockOptions {
  /** Defaults: id "com.example.app", every permission. */
  app?: Partial<AppInfo>;
  host?: Partial<HostInfo>;
}

export interface MockControls {
  /** Notifications the app has shown, newest last. */
  notifications: (NotificationOptions & { id: string })[];
  /** Links the app has opened, newest last. */
  openedLinks: string[];
  /** Sends a host event to the app, e.g. emit('notification.clicked', { id }). */
  emit<E extends EventName>(event: E, payload: Events[E]): void;
  /** Removes the mock from the page. */
  uninstall(): void;
}

interface Entry { type: 'file' | 'dir'; data: Uint8Array; modifiedAt: string }

/** Marks a bridge as a mock, so installMock can tell it apart from the real one (even across SDK copies). */
const MOCK_MARK = Symbol.for('@kobello-electron/sdk/mock');

const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

/**
 * Puts an in-memory host on `window.__kobello`, so the SDK works without Electron.
 * Throws if the page is already running inside the Kobello desktop app.
 */
export function installMock(options: MockOptions = {}): MockControls {
  const existing = globalThis.__kobello as (Bridge & { [MOCK_MARK]?: boolean }) | undefined;
  if (existing && !existing[MOCK_MARK]) {
    // Replacing the real bridge would keep the app's data in memory instead of on the user's disk.
    throw new Error('installMock: this page is running inside the Kobello desktop app. Only install the mock when kobello.isAvailable() is false.');
  }

  const app: AppInfo = {
    id: 'com.example.app',
    name: 'Example app',
    version: '0.0.0',
    permissions: ['storage', 'files', 'notifications', 'links'],
    ...options.app,
  };
  const host: HostInfo = { version: 'mock', platform: 'mock', protocol: PROTOCOL_VERSION, ...options.host };

  const storage = new Map<string, string>(); // values kept as JSON text, like the real host
  const files = new Map<string, Entry>();     // key: relative path; the root folder is implicit
  const notificationTimes: number[] = [];     // for the rate limit
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const controls: MockControls = {
    notifications: [],
    openedLinks: [],
    emit: (event, payload) => listeners.get(event)?.forEach((callback) => callback(payload)),
    uninstall: () => {
      if (globalThis.__kobello === bridge) globalThis.__kobello = undefined;
    },
  };

  const need = (permission: Permission) => {
    if (!app.permissions.includes(permission)) fail('PERMISSION_DENIED', `Add "${permission}" to the permissions in kobello.json.`);
  };
  const storageKey = (key: unknown) => requireString(key, 'Key', LIMITS.storageKeyLength);
  const isDir = (path: string) => path === '' || files.get(path)?.type === 'dir';
  const info = (path: string, entry: Entry): FileInfo => ({
    path,
    name: path.split('/').pop() ?? path,
    type: entry.type,
    size: entry.type === 'file' ? entry.data.byteLength : 0,
    modifiedAt: entry.modifiedAt,
  });
  const newDir = (): Entry => ({ type: 'dir', data: new Uint8Array(), modifiedAt: new Date().toISOString() });

  /** Folders that would have to be created for `path` to be a folder. Fails if a file is in the way. */
  const missingDirs = (path: string): string[] => {
    const parts = path ? path.split('/') : [];
    const missing: string[] = [];
    for (let i = 1; i <= parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      if (files.get(dir)?.type === 'file') fail('INVALID_ARGUMENT', `"${dir}" is a file, not a folder.`);
      if (!files.has(dir)) missing.push(dir);
    }
    return missing;
  };
  const checkEntryCount = (added: number) => {
    if (files.size + added > LIMITS.fileEntries) fail('QUOTA_EXCEEDED', `An app can have at most ${LIMITS.fileEntries} files and folders.`);
  };

  // One function per protocol method. Each receives the call's arguments.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers: Record<string, (args: any) => unknown> = {
    // Copies, so the app can't change the mock's state by editing what it got back.
    'host.info': () => ({ ...host }),
    'app.info': () => ({ ...app, permissions: [...app.permissions] }),

    'storage.get': ({ key }) => {
      need('storage');
      const text = storage.get(storageKey(key));
      return text === undefined ? undefined : JSON.parse(text);
    },
    'storage.set': ({ key, value }) => {
      need('storage');
      const name = storageKey(key);
      const text = JSON.stringify(value);
      if (text === undefined) fail('INVALID_ARGUMENT', 'Value must be JSON (no undefined or functions).');
      if (byteLength(text) > LIMITS.storageValueBytes) fail('QUOTA_EXCEEDED', 'A single value can be at most 1 MB.');
      // The host measures the whole store as one JSON object of JSON texts.
      const next = new Map(storage).set(name, text);
      if (byteLength(JSON.stringify(Object.fromEntries(next))) > LIMITS.storageTotalBytes) {
        fail('QUOTA_EXCEEDED', 'Storage is full (10 MB per app).');
      }
      storage.set(name, text);
    },
    'storage.delete': ({ key }) => { need('storage'); storage.delete(storageKey(key)); },
    'storage.keys': () => { need('storage'); return [...storage.keys()]; },
    'storage.clear': () => { need('storage'); storage.clear(); },

    'files.read': ({ path, encoding }) => {
      need('files');
      const entry = files.get(checkPath(path));
      if (!entry || entry.type !== 'file') return fail('NOT_FOUND', `No file at "${path}".`);
      return encoding === 'binary' ? entry.data.slice() : new TextDecoder().decode(entry.data);
    },
    'files.write': ({ path, data, createDirs }) => {
      need('files');
      const clean = checkPath(path);
      if (typeof data !== 'string' && !(data instanceof Uint8Array)) fail('INVALID_ARGUMENT', 'Data must be a string or a Uint8Array.');
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
      if (bytes.byteLength > LIMITS.fileBytes) fail('QUOTA_EXCEEDED', 'Files can be at most 50 MB.');
      if (isDir(clean)) fail('INVALID_ARGUMENT', `"${clean}" is a folder.`);

      const parent = parentOf(clean);
      const dirs = missingDirs(parent);
      if (dirs.length > 0 && createDirs !== true) {
        fail('NOT_FOUND', `Folder "${parent}" doesn't exist. Pass { createDirs: true } to create it.`);
      }
      const old = files.get(clean);
      checkEntryCount(dirs.length + (old ? 0 : 1));
      let total = 0;
      files.forEach((entry) => { total += entry.data.byteLength; });
      if (total - (old?.data.byteLength ?? 0) + bytes.byteLength > LIMITS.filesTotalBytes) {
        fail('QUOTA_EXCEEDED', 'The app\'s files are full (1 GB per app).');
      }

      dirs.forEach((dir) => files.set(dir, newDir()));
      const entry: Entry = { type: 'file', data: bytes, modifiedAt: new Date().toISOString() };
      files.set(clean, entry);
      return info(clean, entry);
    },
    'files.delete': ({ path }) => {
      need('files');
      const clean = checkPath(path);
      if (!files.has(clean)) fail('NOT_FOUND', `Nothing at "${clean}".`);
      if ([...files.keys()].some((key) => parentOf(key) === clean)) fail('INVALID_ARGUMENT', `Folder "${clean}" isn't empty.`);
      files.delete(clean);
    },
    'files.list': ({ dir }) => {
      need('files');
      const clean = checkPath(dir ?? '', true);
      if (!isDir(clean)) fail('NOT_FOUND', `No folder at "${clean}".`);
      return [...files.entries()].filter(([key]) => parentOf(key) === clean).map(([key, entry]) => info(key, entry));
    },
    'files.stat': ({ path }) => {
      need('files');
      const clean = checkPath(path);
      const entry = files.get(clean);
      return entry ? info(clean, entry) : null;
    },
    'files.mkdir': ({ path }) => {
      need('files');
      const clean = checkPath(path);
      if (files.has(clean)) fail('ALREADY_EXISTS', `"${clean}" already exists.`);
      const dirs = missingDirs(clean);
      checkEntryCount(dirs.length);
      dirs.forEach((dir) => files.set(dir, newDir()));
    },
    'files.rename': ({ from, to }) => {
      need('files');
      const source = checkPath(from);
      const target = checkPath(to);
      if (!files.has(source)) fail('NOT_FOUND', `Nothing at "${source}".`);
      if (files.has(target)) fail('ALREADY_EXISTS', `"${target}" already exists.`);
      if (target.startsWith(`${source}/`)) fail('INVALID_ARGUMENT', 'Can\'t move a folder into itself.');
      if (!isDir(parentOf(target))) fail('NOT_FOUND', `Folder "${parentOf(target)}" doesn't exist.`);
      // Move the entry and, for a folder, everything inside it.
      for (const [key, entry] of [...files.entries()]) {
        if (key === source || key.startsWith(`${source}/`)) {
          files.delete(key);
          files.set(target + key.slice(source.length), entry);
        }
      }
    },

    'notifications.show': (options: NotificationOptions) => {
      need('notifications');
      requireString(options?.title, 'Title', LIMITS.notificationTitle);
      if (options.body !== undefined) requireString(options.body, 'Body', LIMITS.notificationBody, true);
      if (options.tag !== undefined) requireString(options.tag, 'Tag', LIMITS.notificationTag);

      const now = Date.now();
      const recent = notificationTimes.filter((time) => now - time < 60_000);
      if (recent.length >= LIMITS.notificationsPerMinute) {
        fail('RATE_LIMITED', `At most ${LIMITS.notificationsPerMinute} notifications per minute.`);
      }
      notificationTimes.splice(0, notificationTimes.length, ...recent, now);

      const id = `mock-${controls.notifications.length + 1}`;
      controls.notifications.push({ ...options, id });
      return id;
    },

    'links.open': ({ url }) => {
      need('links');
      controls.openedLinks.push(checkLink(url));
    },
  };

  const bridge: Bridge = {
    v: PROTOCOL_VERSION,
    async invoke(method, args) {
      try {
        // Own keys only, so a method name like "toString" or "constructor" isn't found on the prototype.
        if (!Object.prototype.hasOwnProperty.call(handlers, method)) {
          return fail('UNSUPPORTED', `This version of Kobello doesn't support "${method}".`);
        }
        return { ok: true, value: handlers[method](args ?? {}) };
      } catch (error) {
        if (isKobelloError(error)) return { ok: false, error: { code: error.code, message: error.message } };
        return { ok: false, error: { code: 'INTERNAL', message: String(error) } };
      }
    },
    on(event, callback) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(callback);
      return () => listeners.get(event)?.delete(callback);
    },
  };
  Object.defineProperty(bridge, MOCK_MARK, { value: true });

  globalThis.__kobello = bridge;
  return controls;
}
