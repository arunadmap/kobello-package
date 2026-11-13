// @kobello/sdk/shell: extra methods for Kobello UI only.
// The host rejects these with PERMISSION_DENIED when any other app calls them.

import { call, listen } from './transport';
import type { Bounds, InspectResult, InstalledApp, Permission } from './protocol';

export type { AppManifest, Bounds, InspectResult, InstalledApp } from './protocol';

export const shell = {
  apps: {
    /** Everything in the sidebar, in install order. */
    list: (): Promise<InstalledApp[]> => call('shell.apps.list'),
    /** Looks at a URL before installing: a Kobello app (with its manifest) or a plain website. */
    inspect: (url: string): Promise<InspectResult> => call('shell.apps.inspect', { url }),
    /**
     * Installs a Kobello app or adds a website. `name` overrides the detected name.
     * `permissions` are the ones the user approved (from `inspect`). If the app's kobello.json now asks
     * for any other permission, the host refuses with PERMISSION_DENIED. Websites ignore it.
     * `offlineReady` is true once the app's service worker has cached it, so it opens without internet.
     */
    install: (url: string, options: { name?: string; permissions: Permission[] }): Promise<InstalledApp & { offlineReady: boolean }> =>
      call('shell.apps.install', { url, name: options.name, permissions: options.permissions }),
    /** Renames an app or changes its icon. */
    update: (appId: string, changes: { name?: string; iconUrl?: string }): Promise<InstalledApp> =>
      call('shell.apps.update', { appId, ...changes }),
    /** Removes an app. With deleteData, its storage and files are deleted too. */
    uninstall: (appId: string, options: { deleteData: boolean }): Promise<void> =>
      call('shell.apps.uninstall', { appId, deleteData: options.deleteData }),
  },

  /** The native views apps are shown in. */
  views: {
    /** Shows the app at these bounds, creating its view on first use and hiding every other app. */
    show: (appId: string, bounds: Bounds): Promise<void> => call('shell.views.show', { appId, bounds }),
    /** Hides all app views, for example while a dialog is open. */
    hideAll: (): Promise<void> => call('shell.views.hideAll'),
    reload: (appId: string): Promise<void> => call('shell.views.reload', { appId }),
    /** Destroys the app's view (it's created again the next time it's shown). */
    close: (appId: string): Promise<void> => call('shell.views.close', { appId }),
  },

  /**
   * Ctrl/Cmd+1–9 pressed anywhere in the window. Receives 1–9. Returns a function that stops listening.
   * Outside Kobello it does nothing.
   */
  onShortcut: (callback: (number: number) => void): (() => void) =>
    listen('shell.shortcut', ({ number }) => callback(number)),
};

export default shell;
