# clipboard-files

Reads and writes file paths with cut or copy intent on the system clipboard.

The ordinary clipboard APIs carry text; file managers exchange _files_ through richer clipboard formats. This library speaks those formats directly — `CF_HDROP` with `Preferred DropEffect` on Windows, `NSPasteboard` file URLs on macOS, and the `text/uri-list` / `x-special/gnome-copied-files` / `application/x-kde-cutselection` targets on Linux — so an application can copy files to Explorer, Finder, Nautilus or Dolphin, paste files from them, and tell a cut from a copy.

## Features

- **File paths on the real clipboard**: interoperates with the platform file manager in both directions.
- **Cut or copy intent**: reads and writes the drop effect alongside the paths, using each platform's own convention.
- **One promise-based API**: the same four calls on Windows, macOS and Linux.
- **Native where it must be**: a small Node-API addon for Windows and macOS, compiled at install.
- **Pure JS on Linux**: clipboard access goes through a pluggable transport — Electron's clipboard, `wl-clipboard` or `xclip` out of the box.
- **Codec exports**: the Linux clipboard formats are exposed as standalone encode/decode functions, testable without any clipboard at all.

## Installation

```
npm install @lumine-code/clipboard-files
```

Windows and macOS compile the addon at install and need a C++ toolchain; the Linux install builds nothing.

## Usage

```js
const clip = require("@lumine-code/clipboard-files");

await clip.writeFilePaths(["/home/me/report.pdf"], clip.DROP_EFFECT_MOVE);
const paths = await clip.readFilePaths();
const isCut = (await clip.readDropEffect()) === clip.DROP_EFFECT_MOVE;
await clip.clear();
```

`readFilePaths()` resolves to `[]` for a clipboard holding anything else, which is not distinguishable from an empty clipboard through this API. Paths are whatever the clipboard carries and are not checked for existence. The native calls are synchronous inside and must run on the JS main thread — not in `worker_threads`.

### Windows

Full fidelity: paths travel as `CF_HDROP` and the intent as the registered `Preferred DropEffect` format, exactly as Explorer writes them.

### macOS

Paths travel as file URLs on the general pasteboard, so Finder pastes them with ⌘V and moves them with ⌘⌥V — move-at-paste is the paster's decision on macOS, and there is no cut marker convention on the pasteboard. The intent is therefore carried as a custom pasteboard type, `com.lumine-code.clipboard-files.drop-effect`, holding the drop-effect number as a UTF-8 string on the first pasteboard item. Any application reading that type interoperates with the cut semantics; content written by other applications reads back as a plain copy.

### Linux

Reads prefer `x-special/gnome-copied-files` (which carries the verb), then fall back to `text/uri-list`; the KDE cut marker is honoured when present. Writes offer all three formats to the transport, gnome-first — or uri-list-first when `XDG_CURRENT_DESKTOP` says KDE, because a single-format transport can only offer one.

The default transport chain is Electron's `clipboard` (when running inside Electron and `readBuffer`/`writeBuffer` exist — Electron 44 removes them), then `wl-copy`/`wl-paste`, then `xclip`. Note that Electron ≤ 43 and the CLI tools can offer only one format per write, so cross-desktop fidelity is best on a multi-format transport. To supply your own:

```js
const { createLinuxClipboard } = require("@lumine-code/clipboard-files");

const clip = createLinuxClipboard({
  readBuffer(format) {
    /* return a Buffer or null */
  },
  writeBuffers(entries) {
    /* entries: [{ format, data }] ordered by importance */
  },
  clear() {},
});
```

## API

- `readFilePaths(): Promise<string[]>` — the file paths on the clipboard, or `[]`.
- `readDropEffect(): Promise<number>` — one of the constants below.
- `writeFilePaths(paths, dropEffect?): Promise<void>` — puts paths on the clipboard; the effect defaults to copy.
- `clear(): Promise<void>` — empties the clipboard.
- `DROP_EFFECT_NONE` (0), `DROP_EFFECT_COPY` (1), `DROP_EFFECT_MOVE` (2), `DROP_EFFECT_LINK` (4) — the Windows `DROPEFFECT` values, spoken on every platform.
- `createLinuxClipboard(transport)` — the four calls above over a custom Linux transport.
- `codecs` — `encodeUriList`/`decodeUriList`, `encodeGnomeCopiedFiles`/`decodeGnomeCopiedFiles`, `encodeKdeCutSelection`/`decodeKdeCutSelection` and the `FORMAT_*` names.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
