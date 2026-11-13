# Notes: an example Kobello app

A small notes app that uses every part of `@kobello/sdk`:

| SDK | Used for |
|---|---|
| `files` | Each note is a Markdown file in `notes/` |
| `storage` | The last open note, and the "notify me when saved" setting |
| `notifications` | "Note saved" |
| `links` | Opening the guide in your browser |

It's a PWA, so after it's installed in Kobello it opens without internet.
The code is in [src/App.tsx](src/App.tsx); the manifest Kobello reads is [public/kobello.json](public/kobello.json).

## Run it

The example uses the SDK from this repository (`file:../..`), so build the SDK first, in the repository root:

```bash
npm install && npm run build
```

Then, in this folder:

```bash
npm install
npm run dev        # http://127.0.0.1:5180, uses the in-memory mock when opened in a normal browser
```

To try it inside Kobello, with offline support, build it and serve the build:

```bash
npm run build
npm run preview    # http://127.0.0.1:5181
```

Then, in the Kobello desktop app running in developer mode, click **+** and add `http://127.0.0.1:5181`.
The [guide](https://github.com/arunadmap/kobello-package/blob/main/docs/GUIDE.md) explains each step.
