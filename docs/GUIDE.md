# Building apps for Kobello

Kobello is a desktop app that keeps your favourite web apps together in one window. Anyone can
build an app for it. This guide takes you from an empty folder to an app running in Kobello,
working offline.

**Contents**

1. [What a Kobello app is](#1-what-a-kobello-app-is)
2. [Quick start](#2-quick-start)
3. [Run your app in Kobello](#3-run-your-app-in-kobello)
4. [The manifest and permissions](#4-the-manifest-and-permissions)
5. [API reference](#5-api-reference)
6. [Errors and limits](#6-errors-and-limits)
7. [Make your app work offline](#7-make-your-app-work-offline)
8. [Testing without Kobello](#8-testing-without-kobello)
9. [Publishing](#9-publishing)

A complete example is in [examples/notes](https://github.com/arunadmap/kobello-package/tree/main/examples/notes).

---

## 1. What a Kobello app is

A Kobello app is a normal web app (any framework, or none) with two extra things:

- **`/kobello.json`**, a small manifest at the root of your site. It names your app and lists the
  permissions it needs.
- **`@kobello/sdk`**, the package your code uses to talk to Kobello: save data and files on the
  user's computer, show notifications, and open links in their browser.

Kobello shows each app in its own window area, with its own private storage. An app can only reach
its own data; it can't see other apps or the user's other files.

Any website can be added to Kobello's sidebar, but only sites with a valid `kobello.json` get the SDK.

## 2. Quick start

Create a web app. This guide uses [Vite](https://vite.dev) with React and TypeScript, but any setup works.

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm install @kobello/sdk
npm install -D vite-plugin-pwa
```

> **Before `@kobello/sdk` is published on npm**, install it from a local copy instead:
> `npm install ../path/to/kobello-package` (build it first with `npm install && npm run build` in that folder).

`@kobello/sdk` is ESM-only: use `import`, not `require`. Every modern bundler (Vite, webpack, esbuild, Rollup) handles that.

**Add `public/kobello.json`** (Vite serves `public/` at the root of your site):

```json
{
  "kobello": 1,
  "id": "com.example.myapp",
  "name": "My app",
  "version": "1.0.0",
  "start_url": "/",
  "icon": "/icon.svg",
  "permissions": ["storage"]
}
```

**Use the SDK** in your code:

```ts
import { kobello } from '@kobello/sdk';

if (kobello.isAvailable()) {
  const count = (await kobello.storage.get<number>('visits')) ?? 0;
  await kobello.storage.set('visits', count + 1);
}
```

**Make it a PWA**, so it works offline (see [section 7](#7-make-your-app-work-offline)), in `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // A fixed port keeps your app's address the same (Kobello UI's own dev server uses 5173).
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'kobello.json'],
      manifest: { name: 'My app', short_name: 'My app', start_url: '/', display: 'standalone', icons: [] },
    }),
  ],
});
```

## 3. Run your app in Kobello

Kobello only installs `https://` apps. To test apps on your own computer (`http://localhost` or
`http://127.0.0.1`), run Kobello in **developer mode**:

- running the desktop app from source (`npm start` in the Kobello desktop project), or
- a packaged Kobello started with the environment variable `KOBELLO_DEV=1`.

Then:

1. Start your app: `npm run dev`.
2. In Kobello, click **+**, type your app's address (`localhost:5180` with the config above) and click **Next**.
3. Kobello reads your `kobello.json` and shows the permissions your app asks for. Click **Install**.

Your app now runs in Kobello with the SDK available.

> **Offline while developing.** `vite-plugin-pwa` doesn't register a service worker under
> `npm run dev`, so Kobello will say the app wasn't saved for offline use. To test offline, run
> `npm run build && npm run preview` and add the preview address instead.

> **One address per app ID.** Kobello ties an app's `id` to the address it was installed from.
> Adding the app again from the same address updates it. To switch from the dev address to the preview
> address, remove the app first (right-click its icon → Remove).

## 4. The manifest and permissions

| Field | Required | Description |
|---|---|---|
| `kobello` | yes | Always `1` |
| `id` | yes | A unique, permanent ID in reverse-domain style, e.g. `com.example.notes`: at least two parts separated by dots, using lowercase letters, numbers and dashes (the first part has no dashes). Changing it later makes a different app with different data. |
| `name` | yes | Shown in the sidebar (1–80 characters). Users can rename it. |
| `version` | yes | Your app's version, e.g. `1.2.0`. Kobello records it when the app is added (see `kobello.app.info()`). |
| `permissions` | yes | What the app may use (see below). Can be empty. |
| `start_url` | no | The page to open, on the same site. Default `/`. |
| `icon` | no | Path or URL of the sidebar icon. Square, at least 128×128 (SVG is ideal). |
| `description` | no | A sentence about the app |

**Permissions.** Ask only for what you use. Users see the list before installing.

| Permission | Lets the app | What the user sees |
|---|---|---|
| `storage` | Use `kobello.storage` | Save its settings and data on this computer |
| `files` | Use `kobello.files` | Create and open its own files |
| `notifications` | Use `kobello.notifications` | Show notifications |
| `links` | Use `kobello.links` | Open links in your browser |

`kobello.app.info()` and `kobello.host()` need no permission.

Kobello grants only the permissions the user approved when they added the app. If a new version of your
`kobello.json` asks for more, calls that need the new permission get `PERMISSION_DENIED` until the user adds
the app again (**+**, same address). Kobello then shows them the permissions again to approve. Adding it again
from the same address updates the installed app and keeps its data; there's no need to remove it first.
Check `(await kobello.app.info()).permissions` if you want to tell the user a feature needs this.

## 5. API reference

Everything is on the `kobello` object. Every method returns a Promise.

```ts
import { kobello, KobelloError } from '@kobello/sdk';
```

### General

| | |
|---|---|
| `kobello.isAvailable()` | `true` inside Kobello. When `false`, every other method rejects with `NOT_AVAILABLE`, except `notifications.onClick`, which does nothing (so it's safe to set up anywhere). |
| `kobello.version` | The SDK's version |
| `kobello.host()` | `{ version, platform, protocol }` of the Kobello desktop app |
| `kobello.app.info()` | `{ id, name, version, permissions }` of your app. `version` and `permissions` are the ones recorded when the user added the app (or last added it again), not necessarily what your server serves now. |

### Storage (`storage` permission)

Key/value storage, private to your app. Values must be JSON (strings, numbers, booleans, `null`, arrays, objects).

```ts
await kobello.storage.set('settings', { theme: 'dark' });
const settings = await kobello.storage.get<{ theme: string }>('settings'); // undefined if not set
await kobello.storage.delete('settings');
const keys = await kobello.storage.keys();
await kobello.storage.clear();
```

### Files (`files` permission)

Your app has its own folder. Paths are relative to it and use `/`, for example `notes/today.md`.

```ts
await kobello.files.write('notes/today.md', '# Today', { createDirs: true }); // creates notes/ if needed
const text = await kobello.files.read('notes/today.md');                      // string
const bytes = await kobello.files.read('photo.png', { encoding: 'binary' });  // Uint8Array
await kobello.files.write('photo.png', bytes);                                // strings or Uint8Array

const entries = await kobello.files.list('notes'); // one level; list() for the root folder
const info = await kobello.files.stat('notes/today.md'); // or null if nothing is there
await kobello.files.mkdir('archive/2026');               // creates parent folders too
await kobello.files.rename('notes/today.md', 'archive/2026/today.md');
await kobello.files.delete('archive/2026/today.md');     // a file, or an empty folder
```

`list` and `stat` return `FileInfo`: `{ path, name, type: 'file' | 'dir', size, modifiedAt }` (`modifiedAt` is an ISO date).

### Notifications (`notifications` permission)

```ts
const id = await kobello.notifications.show({ title: 'Saved', body: 'today.md', tag: 'save' });

const stop = kobello.notifications.onClick((id, tag) => {
  // The user clicked one of your notifications. Kobello comes to the front.
});
stop(); // stop listening
```

Kobello puts your app's name in front of the title. Outside Kobello, `onClick` does nothing and returns a
no-op, so you can call it in a React effect without checking `isAvailable()` first.

### Links (`links` permission)

```ts
await kobello.links.open('https://example.com'); // opens in the user's browser
```

Only `https:`, `http:` and `mailto:` links. Links your pages open with `target="_blank"` also open in
the user's browser automatically, without needing this permission.

## 6. Errors and limits

Failures reject with a `KobelloError`. Check its `code`:

```ts
import { isKobelloError, kobello } from '@kobello/sdk';

try {
  await kobello.files.read('missing.txt');
} catch (error) {
  if (isKobelloError(error) && error.code === 'NOT_FOUND') {
    // first run: nothing saved yet
  } else {
    throw error;
  }
}
```

`isKobelloError(error)` works like `error instanceof KobelloError`, but also when your bundle ends up with
two copies of the SDK (for example one inside a library you use).

| Code | Meaning |
|---|---|
| `NOT_AVAILABLE` | Not running inside Kobello |
| `PERMISSION_DENIED` | The permission isn't in your `kobello.json`, or the call came from somewhere other than your app's own pages (another site your app navigated to, or an iframe) |
| `INVALID_ARGUMENT` | A wrong value: a path leaving your folder or using a name Windows can't store, an unsupported link, a value that isn't JSON, a string that's too long… |
| `NOT_FOUND` | No such file or folder |
| `ALREADY_EXISTS` | `mkdir` or `rename` target already exists |
| `QUOTA_EXCEEDED` | Over a size or count limit (see below) |
| `RATE_LIMITED` | Too many notifications |
| `NETWORK_ERROR` | A site couldn't be reached |
| `UNSUPPORTED` | The user's Kobello is older than your SDK and doesn't have this method, or speaks a different protocol version |
| `INTERNAL` | Something went wrong inside Kobello, or its answer didn't arrive |

**Limits**

| | Limit |
|---|---|
| Storage key | 256 characters |
| Storage value | 1 MB |
| Storage per app | 10 MB |
| File size | 50 MB |
| Files per app | 1 GB in all, and at most 10,000 files and folders |
| File path | 1024 characters; relative (no leading `/`); no `.` or `..` parts; none of `\` `:` `<` `>` `"` `\|` `?` `*`; no part ending in a dot or space; no Windows device names (`con`, `prn`, `aux`, `nul`, `com1`–`com9`, `lpt1`–`lpt9`), with or without an extension |
| File data | A string (saved as UTF-8) or a `Uint8Array` |
| Notification title / body / tag | 100 / 500 / 100 characters |
| Notifications | 10 per minute |
| Link URL | 4096 characters; `http:`, `https:` or `mailto:` |

## 7. Make your app work offline

Kobello users expect apps to open without internet. Two things make that work:

1. **Your code is cached by your service worker.** Make your app a PWA that precaches every file it
   needs. With Vite, `vite-plugin-pwa` (see [Quick start](#2-quick-start)) does this. Include
   `kobello.json` in what it caches.
2. **Your data is stored through the SDK.** `kobello.storage` and `kobello.files` are on the user's
   disk, so they're always available. Don't rely on a server for data the app needs to open.

When a user installs your app, Kobello loads it once in the background and waits until its service
worker is active. Install shows a warning if that doesn't happen within about 30 seconds.

**Check it:**

1. `npm run build && npm run preview`, and install the preview address in Kobello.
2. Close Kobello, stop the preview server, and open Kobello again.
3. Your app should open and show its saved data.

If something is missing offline, it's usually a file your service worker didn't precache (check
`globPatterns` in the `vite-plugin-pwa` options), or data that came from your server.

## 8. Testing without Kobello

`@kobello/sdk/mock` is an in-memory stand-in for Kobello, for unit tests and for previewing your app
in a normal browser. Nothing is saved: it resets when the page reloads.

**Preview in the browser** (the example app does this in `src/main.tsx`). Install the mock before your
app starts; the dynamic import keeps it out of production builds:

```ts
import { kobello } from '@kobello/sdk';

async function start() {
  if (import.meta.env.DEV && !kobello.isAvailable()) {
    const { installMock } = await import('@kobello/sdk/mock');
    installMock({ app: { id: 'com.example.myapp', name: 'My app' } });
  }
  // ...then render your app
}
void start();
```

`installMock()` throws if the page is already running inside Kobello, so it can't replace the real thing by accident.

**Unit tests** (Vitest, or Jest set up for ES modules):

```ts
import { installMock } from '@kobello/sdk/mock';
import { kobello } from '@kobello/sdk';

const mock = installMock({ app: { permissions: ['storage', 'notifications'] } });

await kobello.notifications.show({ title: 'Hi' });
expect(mock.notifications).toMatchObject([{ title: 'Hi' }]);

mock.emit('notification.clicked', { id: mock.notifications[0].id }); // simulate a click
mock.uninstall();
```

The mock checks the same rules as Kobello: permissions, paths, file and storage sizes, notification length
and rate, and link types. Mistakes show up in your tests instead of in front of users.

**Jest** runs CommonJS by default and won't load this ESM-only package from `node_modules`. Vitest works
without setup. With Jest, let it transform the SDK, for example
`transformIgnorePatterns: ['/node_modules/(?!@kobello/sdk)']` with Babel or ts-jest configured for ES modules.

## 9. Publishing

1. Host your built app on any `https://` address (Vercel, Netlify, GitHub Pages, your own server).
   Make sure `/kobello.json` is served from the root of that address.
2. Share the address. Users add it with **+** in Kobello.
3. To update, deploy a new version. Kobello picks it up through your service worker the next time
   the user is online. Bump `version` in `kobello.json`. If the new version needs more permissions,
   users add the app again to approve them (see [section 4](#4-the-manifest-and-permissions)).

Keep your `id` the same forever: users' data is stored under it.
