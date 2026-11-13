# @kobello/sdk

The API Kobello apps use to talk to the Kobello desktop app: key/value storage, files, notifications, links and app info.

```bash
npm install @kobello/sdk
```

The package is **ESM-only** (`import`, not `require`). It works as is with Vite, webpack, esbuild, Rollup and Vitest.

```ts
import { kobello, KobelloError } from '@kobello/sdk';

if (kobello.isAvailable()) {
  await kobello.storage.set('theme', 'dark');
  await kobello.files.write('notes/today.md', '# Today', { createDirs: true });
  await kobello.notifications.show({ title: 'Saved' });
}
```

Your app also needs a `kobello.json` manifest that declares the permissions it uses (`storage`, `files`, `notifications`, `links`).

**New to Kobello apps? Read the [guide](https://github.com/arunadmap/kobello-package/blob/main/docs/GUIDE.md)** and look at the [Notes example](https://github.com/arunadmap/kobello-package/tree/main/examples/notes).

## API

| Module | Methods |
|---|---|
| `kobello` | `isAvailable()`, `version`, `host()` |
| `kobello.app` | `info()` |
| `kobello.storage` | `get(key)`, `set(key, value)`, `delete(key)`, `keys()`, `clear()` |
| `kobello.files` | `read(path, { encoding })`, `write(path, data, { createDirs })`, `delete(path)`, `list(dir)`, `stat(path)`, `mkdir(path)`, `rename(from, to)` |
| `kobello.notifications` | `show({ title, body, silent, tag })`, `onClick(cb)` |
| `kobello.links` | `open(url)` |

File paths are relative to your app's own folder and use `/`.
Every method returns a Promise. Failures reject with `KobelloError`; check `error.code` (`NOT_AVAILABLE`, `PERMISSION_DENIED`, `INVALID_ARGUMENT`, `NOT_FOUND`, `ALREADY_EXISTS`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `NETWORK_ERROR`, `UNSUPPORTED`, `INTERNAL`).
`isKobelloError(error)` checks for one, and keeps working if your bundle ends up with two copies of the SDK (where `instanceof` doesn't).

Outside Kobello (`kobello.isAvailable()` is `false`) every method rejects with `NOT_AVAILABLE`, except the listeners
(`notifications.onClick`, `shell.onShortcut`): they do nothing and return a no-op, so they're safe to set up anywhere, for example in a React effect.

## Testing without the desktop app

```ts
import { installMock } from '@kobello/sdk/mock';

const mock = installMock({ app: { id: 'com.example.notes', permissions: ['storage'] } });
// ...use kobello as usual; mock.notifications and mock.openedLinks record what happened.
```

The mock keeps everything in memory and checks the same paths, sizes and rate limits as Kobello. Use it for tests and previews, not in production;
`installMock()` throws if the page is already running inside Kobello.

**Jest** runs CommonJS by default and won't load this ESM package from `node_modules`. Either use [Vitest](https://vitest.dev),
or let Jest transform it: `transformIgnorePatterns: ['/node_modules/(?!@kobello/sdk)']` (with Babel or ts-jest set up for ES modules).

## Other entry points

- `@kobello/sdk/shell`: extra methods for Kobello UI only (installing apps, showing app views). Other apps get `PERMISSION_DENIED`.
- `@kobello/sdk/protocol`: the shared message types, used by the desktop host.

## Development

```bash
npm install
npm run build      # builds dist/ with tsup; run it after npm install (examples and the desktop app use dist/)
npm test           # unit tests
npm run typecheck
```

`npm publish` runs the type check, tests and build first (`prepublishOnly`).

## License

MIT
