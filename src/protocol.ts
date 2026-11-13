// Shared contract between the SDK (in web pages) and the Kobello desktop host (Electron main).
// The host imports these types too, so both sides agree on method names, arguments and results.

/** Bumped only when the wire format changes in a way old hosts or SDKs can't handle. */
export const PROTOCOL_VERSION = 1;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** What an app can ask for in its kobello.json manifest. */
export type Permission = 'storage' | 'files' | 'notifications' | 'links';

export type ErrorCode =
  | 'NOT_AVAILABLE'      // not running inside the Kobello desktop app
  | 'PERMISSION_DENIED'  // permission not declared, or caller isn't a registered Kobello app
  | 'INVALID_ARGUMENT'   // bad path, bad URL, wrong type, too long
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'      // the app's website couldn't be reached (for example while offline)
  | 'UNSUPPORTED'        // the host is older than the SDK and doesn't know the method
  | 'INTERNAL';

export interface HostInfo { version: string; platform: string; protocol: number }

export interface AppInfo {
  id: string;
  name: string;
  version: string;
  permissions: Permission[];
}

export interface FileInfo {
  /** Path relative to the app's files folder, using "/" separators. */
  path: string;
  name: string;
  type: 'file' | 'dir';
  size: number;
  /** ISO 8601 date. */
  modifiedAt: string;
}

export interface NotificationOptions {
  title: string;
  body?: string;
  silent?: boolean;
  /** Your own label, passed back to onClick. */
  tag?: string;
}

/** The kobello.json file a Kobello app serves from its origin. */
export interface AppManifest {
  kobello: number;
  id: string;
  name: string;
  version: string;
  description?: string;
  start_url?: string;
  icon?: string;
  permissions: Permission[];
}

/** An entry in the user's sidebar: a Kobello app or a plain website. */
export interface InstalledApp {
  id: string;
  kind: 'kobello-app' | 'website';
  name: string;
  url: string;
  iconUrl?: string;
  /** Always empty for websites. */
  permissions: Permission[];
}

export type InspectResult =
  | { kind: 'kobello-app'; url: string; manifest: AppManifest; iconUrl?: string }
  | { kind: 'website'; url: string; name?: string; iconUrl?: string };

/** CSS pixels, relative to the window's content area. */
export interface Bounds { x: number; y: number; width: number; height: number }

/** Every method the host answers: its arguments and its result. */
export interface Methods {
  'host.info': { args: void; result: HostInfo };
  'app.info': { args: void; result: AppInfo };

  'storage.get': { args: { key: string }; result: JsonValue | undefined };
  'storage.set': { args: { key: string; value: JsonValue }; result: void };
  'storage.delete': { args: { key: string }; result: void };
  'storage.keys': { args: void; result: string[] };
  'storage.clear': { args: void; result: void };

  'files.read': { args: { path: string; encoding: 'utf8' | 'binary' }; result: string | Uint8Array };
  'files.write': { args: { path: string; data: string | Uint8Array; createDirs: boolean }; result: FileInfo };
  'files.delete': { args: { path: string }; result: void };
  'files.list': { args: { dir: string }; result: FileInfo[] };
  'files.stat': { args: { path: string }; result: FileInfo | null };
  'files.mkdir': { args: { path: string }; result: void };
  'files.rename': { args: { from: string; to: string }; result: void };

  'notifications.show': { args: NotificationOptions; result: string };

  'links.open': { args: { url: string }; result: void };

  // Shell-only methods: the host rejects them from anything but Kobello UI.
  'shell.apps.list': { args: void; result: InstalledApp[] };
  'shell.apps.inspect': { args: { url: string }; result: InspectResult };
  'shell.apps.install': { args: { url: string; name?: string; permissions: Permission[] }; result: InstalledApp & { offlineReady: boolean } };
  'shell.apps.update': { args: { appId: string; name?: string; iconUrl?: string }; result: InstalledApp };
  'shell.apps.uninstall': { args: { appId: string; deleteData: boolean }; result: void };
  'shell.views.show': { args: { appId: string; bounds: Bounds }; result: void };
  'shell.views.hideAll': { args: void; result: void };
  'shell.views.reload': { args: { appId: string }; result: void };
  'shell.views.close': { args: { appId: string }; result: void };
}

export type Method = keyof Methods;

/** Events the host pushes to a page, with their payloads. */
export interface Events {
  'notification.clicked': { id: string; tag?: string };
  'shell.shortcut': { number: number };
}

export type EventName = keyof Events;

/** The host never throws across IPC; it always answers with one of these. */
export type Response<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: { code: ErrorCode; message: string } };

/**
 * What the host's preload script puts on `window.__kobello`.
 * App code never uses this directly; it goes through the SDK.
 */
export interface Bridge {
  v: number;
  invoke(method: string, args?: unknown): Promise<Response>;
  on(event: string, callback: (payload: unknown) => void): () => void;
}

// The bridge lives on the page's global object. Declared here, in the shared contract, so it's part of
// the published type definitions (tests and the mock read and replace it).
declare global {
  // eslint-disable-next-line no-var
  var __kobello: Bridge | undefined;
}
