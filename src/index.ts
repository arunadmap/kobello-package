// @kobello-electron/sdk: the API Kobello apps use to talk to the Kobello desktop app.
//
//   import { kobello } from '@kobello-electron/sdk';
//   await kobello.storage.set('theme', 'dark');

import { call, getBridge, listen } from './transport';
import type { AppInfo, FileInfo, HostInfo, JsonValue, NotificationOptions } from './protocol';

export { isKobelloError, KobelloError } from './errors';
export type { AppInfo, ErrorCode, FileInfo, HostInfo, JsonValue, NotificationOptions, Permission } from './protocol';

/** Keep in sync with package.json (a test checks this). */
export const SDK_VERSION = '0.1.0';

export const kobello = {
  /** SDK version. */
  version: SDK_VERSION,

  /**
   * True when running inside the Kobello desktop app. When false, every method rejects with NOT_AVAILABLE,
   * except the `on...` listeners, which do nothing (so they're safe to set up anywhere).
   */
  isAvailable: (): boolean => getBridge() !== undefined,

  /** Version and platform of the Kobello desktop app. */
  host: (): Promise<HostInfo> => call('host.info'),

  /** Information about the calling app, from its kobello.json. */
  app: {
    info: (): Promise<AppInfo> => call('app.info'),
  },

  /** Key/value storage, private to this app. Values must be JSON. Needs the `storage` permission. */
  storage: {
    /** The stored value, or undefined if the key isn't set. */
    get: <T extends JsonValue = JsonValue>(key: string) => call('storage.get', { key }) as Promise<T | undefined>,
    set: (key: string, value: JsonValue): Promise<void> => call('storage.set', { key, value }),
    delete: (key: string): Promise<void> => call('storage.delete', { key }),
    keys: (): Promise<string[]> => call('storage.keys'),
    clear: (): Promise<void> => call('storage.clear'),
  },

  /**
   * Files in this app's own folder. Paths are relative and use "/" (for example "notes/today.md").
   * Needs the `files` permission.
   */
  files: {
    /** Reads a file as text (default) or as bytes. */
    read: ((path: string, options: { encoding?: 'utf8' | 'binary' } = {}) =>
      call('files.read', { path, encoding: options.encoding ?? 'utf8' })) as {
      (path: string, options?: { encoding?: 'utf8' }): Promise<string>;
      (path: string, options: { encoding: 'binary' }): Promise<Uint8Array>;
      // When the encoding is only known at runtime.
      (path: string, options: { encoding?: 'utf8' | 'binary' }): Promise<string | Uint8Array>;
    },
    /** Creates or replaces a file. Set createDirs to create missing parent folders. */
    write: (path: string, data: string | Uint8Array, options: { createDirs?: boolean } = {}): Promise<FileInfo> =>
      call('files.write', { path, data, createDirs: options.createDirs ?? false }),
    /** Deletes a file or an empty folder. */
    delete: (path: string): Promise<void> => call('files.delete', { path }),
    /** Lists one folder level. Leave dir empty for the app's root folder. */
    list: (dir = ''): Promise<FileInfo[]> => call('files.list', { dir }),
    /** File or folder details, or null if nothing exists at that path. */
    stat: (path: string): Promise<FileInfo | null> => call('files.stat', { path }),
    /** Creates a folder, plus any missing parent folders. Throws ALREADY_EXISTS if it exists. */
    mkdir: (path: string): Promise<void> => call('files.mkdir', { path }),
    /** Renames or moves a file or folder. Throws ALREADY_EXISTS if the target exists. */
    rename: (from: string, to: string): Promise<void> => call('files.rename', { from, to }),
  },

  /** System notifications. Needs the `notifications` permission. */
  notifications: {
    /** Shows a notification and returns its id. */
    show: (options: NotificationOptions): Promise<string> => call('notifications.show', options),
    /**
     * Called when the user clicks one of this app's notifications. Returns a function that stops listening.
     * Outside Kobello it does nothing.
     */
    onClick: (callback: (id: string, tag?: string) => void): (() => void) =>
      listen('notification.clicked', ({ id, tag }) => callback(id, tag)),
  },

  /** Needs the `links` permission. */
  links: {
    /** Opens an http(s) or mailto link in the user's default browser or mail app. */
    open: (url: string): Promise<void> => call('links.open', { url }),
  },
};

export default kobello;
