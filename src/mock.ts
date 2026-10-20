// @kobello/sdk/mock: an in-memory stand-in for the Kobello desktop app.
// Use it in unit tests, or to preview an app in a normal browser while developing.
// Nothing is saved: everything is lost when the page reloads.
//
//   import { installMock } from '@kobello/sdk/mock';
//   const mock = installMock({ app: { id: 'com.example.notes' } });

import { KobelloError } from './errors';
import type { AppInfo, Bridge, EventName, Events, FileInfo, HostInfo, NotificationOptions, Permission } from './protocol';
import { PROTOCOL_VERSION } from './protocol';

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

const fail = (code: ConstructorParameters<typeof KobelloError>[0], message: string): never => {
  throw new KobelloError(code, message);
};

/** Checks a relative "/" path and returns it without empty parts. "" means the root folder. */
function cleanPath(path: unknown, allowRoot = false): string {
  if (typeof path !== 'string') return fail('INVALID_ARGUMENT', 'Path must be a string.');
  const parts = path.split('/').filter(Boolean);
  if (path.startsWith('/') || path.includes('\\') || parts.some((part) => part === '..' || part === '.')) {
    fail('INVALID_ARGUMENT', `Path must be relative and stay inside the app folder: "${path}"`);
  }
  if (!allowRoot && parts.length === 0) fail('INVALID_ARGUMENT', 'Path is empty.');
  return parts.join('/');
}

const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

/** Puts an in-memory host on `window.__kobello`, so the SDK works without Electron. */
export function installMock(options: MockOptions = {}): MockControls {
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
    if (!app.permissions.includes(permission)) fail('PERMISSION_DENIED', `The app needs the "${permission}" permission.`);
  };
  const isDir = (path: string) => path === '' || files.get(path)?.type === 'dir';
  const info = (path: string, entry: Entry): FileInfo => ({
    path,
    name: path.split('/').pop() ?? path,
    type: entry.type,
    size: entry.type === 'file' ? entry.data.byteLength : 0,
    modifiedAt: entry.modifiedAt,
  });
  const makeDirs = (path: string) => {
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      if (files.get(dir)?.type === 'file') fail('INVALID_ARGUMENT', `"${dir}" is a file, not a folder.`);
      if (!files.has(dir)) files.set(dir, { type: 'dir', data: new Uint8Array(), modifiedAt: new Date().toISOString() });
    }
  };

  // One function per protocol method. Each receives the call's arguments.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers: Record<string, (args: any) => unknown> = {
    'host.info': () => host,
    'app.info': () => app,

    'storage.get': ({ key }) => {
      need('storage');
      const text = storage.get(key);
      return text === undefined ? undefined : JSON.parse(text);
    },
    'storage.set': ({ key, value }) => {
      need('storage');
      const text = JSON.stringify(value);
      if (typeof key !== 'string' || !key) fail('INVALID_ARGUMENT', 'Key must be a non-empty string.');
      if (text === undefined) fail('INVALID_ARGUMENT', 'Value must be JSON (no undefined or functions).');
      storage.set(key, text);
    },
    'storage.delete': ({ key }) => { need('storage'); storage.delete(key); },
    'storage.keys': () => { need('storage'); return [...storage.keys()]; },
    'storage.clear': () => { need('storage'); storage.clear(); },

    'files.read': ({ path, encoding }) => {
      need('files');
      const entry = files.get(cleanPath(path));
      if (!entry || entry.type !== 'file') return fail('NOT_FOUND', `No file at "${path}".`);
      return encoding === 'binary' ? entry.data.slice() : new TextDecoder().decode(entry.data);
    },
    'files.write': ({ path, data, createDirs }) => {
      need('files');
      const clean = cleanPath(path);
      if (isDir(clean)) fail('INVALID_ARGUMENT', `"${path}" is a folder.`);
      if (createDirs && parentOf(clean)) makeDirs(parentOf(clean));
      if (!isDir(parentOf(clean))) fail('NOT_FOUND', `Folder "${parentOf(clean)}" doesn't exist. Pass { createDirs: true } to create it.`);
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
      const entry: Entry = { type: 'file', data: bytes, modifiedAt: new Date().toISOString() };
      files.set(clean, entry);
      return info(clean, entry);
    },
    'files.delete': ({ path }) => {
      need('files');
      const clean = cleanPath(path);
      if (!files.has(clean)) fail('NOT_FOUND', `Nothing at "${path}".`);
      if ([...files.keys()].some((key) => parentOf(key) === clean)) fail('INVALID_ARGUMENT', `Folder "${path}" isn't empty.`);
      files.delete(clean);
    },
    'files.list': ({ dir }) => {
      need('files');
      const clean = cleanPath(dir, true);
      if (!isDir(clean)) fail('NOT_FOUND', `No folder at "${dir}".`);
      return [...files.entries()].filter(([key]) => parentOf(key) === clean).map(([key, entry]) => info(key, entry));
    },
    'files.stat': ({ path }) => {
      need('files');
      const clean = cleanPath(path);
      const entry = files.get(clean);
      return entry ? info(clean, entry) : null;
    },
    'files.mkdir': ({ path }) => {
      need('files');
      const clean = cleanPath(path);
      if (files.has(clean)) fail('ALREADY_EXISTS', `"${path}" already exists.`);
      makeDirs(clean);
    },
    'files.rename': ({ from, to }) => {
      need('files');
      const source = cleanPath(from);
      const target = cleanPath(to);
      if (!files.has(source)) fail('NOT_FOUND', `Nothing at "${from}".`);
      if (files.has(target)) fail('ALREADY_EXISTS', `"${to}" already exists.`);
      if (!isDir(parentOf(target))) fail('NOT_FOUND', `Folder "${parentOf(target)}" doesn't exist.`);
      if (target.startsWith(`${source}/`)) fail('INVALID_ARGUMENT', 'Can\'t move a folder into itself.');
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
      if (!options?.title) fail('INVALID_ARGUMENT', 'A notification needs a title.');
      const id = `mock-${controls.notifications.length + 1}`;
      controls.notifications.push({ ...options, id });
      return id;
    },

    'links.open': ({ url }) => {
      need('links');
      if (!/^(https?:|mailto:)/i.test(String(url))) fail('INVALID_ARGUMENT', 'Only http, https and mailto links can be opened.');
      controls.openedLinks.push(url);
    },
  };

  const bridge: Bridge = {
    v: PROTOCOL_VERSION,
    async invoke(method, args) {
      try {
        const handler = handlers[method];
        if (!handler) return fail('UNSUPPORTED', `The mock doesn't support "${method}".`);
        return { ok: true, value: handler(args ?? {}) };
      } catch (error) {
        if (error instanceof KobelloError) return { ok: false, error: { code: error.code, message: error.message } };
        return { ok: false, error: { code: 'INTERNAL', message: String(error) } };
      }
    },
    on(event, callback) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(callback);
      return () => listeners.get(event)?.delete(callback);
    },
  };

  globalThis.__kobello = bridge;
  return controls;
}
