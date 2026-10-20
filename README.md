# @kobello/sdk

The API Kobello apps use to talk to the Kobello desktop app: key/value storage, files, notifications, links and app info.

```bash
npm install @kobello/sdk
```

```ts
import { kobello, KobelloError } from '@kobello/sdk';

if (kobello.isAvailable()) {
  await kobello.storage.set('theme', 'dark');
  await kobello.files.write('notes/today.md', '# Today', { createDirs: true });
  await kobello.notifications.show({ title: 'Saved' });
}
```

Your app also needs a `kobello.json` manifest that declares the permissions it uses (`storage`, `files`, `notifications`, `links`).

**New to Kobello apps? Read the [guide](docs/GUIDE.md)** and look at the [Notes example](examples/notes).

## API

| Module | Methods |
|---|---|
| `kobello` | `isAvailable()`, `version`, `host()` |
| `kobello.app` | `info()` |
| `kobello.storage` | `get(key)`, `set(key, value)`, `delete(key)`, `keys()`, `clear()`, `onChange(cb)` |
| `kobello.files` | `read(path, { encoding })`, `write(path, data, { createDirs })`, `delete(path)`, `list(dir)`, `stat(path)`, `mkdir(path)`, `rename(from, to)` |
| `kobello.notifications` | `show({ title, body, silent, tag })`, `onClick(cb)` |
| `kobello.links` | `open(url)` |

File paths are relative to your app's own folder and use `/`.
Every method returns a Promise. Failures reject with `KobelloError`; check `error.code` (`NOT_AVAILABLE`, `PERMISSION_DENIED`, `INVALID_ARGUMENT`, `NOT_FOUND`, `ALREADY_EXISTS`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `NETWORK_ERROR`, `UNSUPPORTED`, `INTERNAL`).

## Testing without the desktop app

```ts
import { installMock } from '@kobello/sdk/mock';

const mock = installMock({ app: { id: 'com.example.notes', permissions: ['storage'] } });
// ...use kobello as usual; mock.notifications and mock.openedLinks record what happened.
```

The mock keeps everything in memory. Use it for tests and previews, not in production.

## Other entry points

- `@kobello/sdk/shell`: extra methods for Kobello UI only (installing apps, showing app views). Other apps get `PERMISSION_DENIED`.
- `@kobello/sdk/protocol`: the shared message types, used by the desktop host.

## Development

```bash
npm install
npm test        # unit tests
npm run build   # builds dist/ with tsup
```
