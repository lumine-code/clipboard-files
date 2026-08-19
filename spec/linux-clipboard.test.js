const path = require("node:path");
const { createLinuxClipboard, codecs } = require("../index");

// Stores every entry it is handed, like the Electron 44 multi-format path.
function memoryTransport() {
  const store = new Map();
  return {
    store,
    lastEntries: null,
    readBuffer(format) {
      return store.get(format) ?? null;
    },
    writeBuffers(entries) {
      this.lastEntries = entries;
      store.clear();
      for (const entry of entries) store.set(entry.format, entry.data);
    },
    clear() {
      store.clear();
    },
  };
}

// Keeps only the first entry, like Electron <= 43 and the CLI tools.
function singleFormatTransport() {
  const transport = memoryTransport();
  const writeAll = transport.writeBuffers.bind(transport);
  transport.writeBuffers = (entries) => writeAll(entries.slice(0, 1));
  return transport;
}

const base = path.resolve(path.sep, "clipboard-files spec");
const samplePaths = [path.join(base, "one.txt"), path.join(base, "two three.txt")];

describe("createLinuxClipboard", () => {
  let savedDesktop;

  beforeEach(() => {
    savedDesktop = process.env.XDG_CURRENT_DESKTOP;
    delete process.env.XDG_CURRENT_DESKTOP;
  });

  afterEach(() => {
    if (savedDesktop === undefined) {
      delete process.env.XDG_CURRENT_DESKTOP;
    } else {
      process.env.XDG_CURRENT_DESKTOP = savedDesktop;
    }
  });

  it("requires a transport", () => {
    expect(() => createLinuxClipboard(null)).toThrowError(TypeError);
  });

  it("round-trips paths and effect through a multi-format transport", async () => {
    const clipboard = createLinuxClipboard(memoryTransport());
    await clipboard.writeFilePaths(samplePaths, codecs.DROP_EFFECT_MOVE);
    expect(await clipboard.readFilePaths()).toEqual(samplePaths);
    expect(await clipboard.readDropEffect()).toBe(codecs.DROP_EFFECT_MOVE);
  });

  it("defaults the effect to copy", async () => {
    const clipboard = createLinuxClipboard(memoryTransport());
    await clipboard.writeFilePaths(samplePaths);
    expect(await clipboard.readDropEffect()).toBe(codecs.DROP_EFFECT_COPY);
  });

  it("writes gnome-copied-files first so single-format transports keep the verb", async () => {
    const transport = singleFormatTransport();
    const clipboard = createLinuxClipboard(transport);
    await clipboard.writeFilePaths(samplePaths, codecs.DROP_EFFECT_MOVE);
    expect(transport.lastEntries[0].format).toBe(codecs.FORMAT_GNOME_COPIED_FILES);
    expect(await clipboard.readFilePaths()).toEqual(samplePaths);
    expect(await clipboard.readDropEffect()).toBe(codecs.DROP_EFFECT_MOVE);
  });

  it("leads with the uri-list on KDE desktops", async () => {
    process.env.XDG_CURRENT_DESKTOP = "KDE";
    const transport = memoryTransport();
    const clipboard = createLinuxClipboard(transport);
    await clipboard.writeFilePaths(samplePaths, codecs.DROP_EFFECT_MOVE);
    expect(transport.lastEntries[0].format).toBe(codecs.FORMAT_URI_LIST);
    // The full entry set still carries the gnome verb and the KDE cut marker.
    const formats = transport.lastEntries.map((entry) => entry.format);
    expect(formats).toContain(codecs.FORMAT_GNOME_COPIED_FILES);
    expect(formats).toContain(codecs.FORMAT_KDE_CUT_SELECTION);
  });

  it("reads the KDE cut marker when no gnome payload is present", async () => {
    const transport = memoryTransport();
    transport.store.set(codecs.FORMAT_URI_LIST, codecs.encodeUriList(samplePaths));
    transport.store.set(
      codecs.FORMAT_KDE_CUT_SELECTION,
      codecs.encodeKdeCutSelection(codecs.DROP_EFFECT_MOVE),
    );
    const clipboard = createLinuxClipboard(transport);
    expect(await clipboard.readFilePaths()).toEqual(samplePaths);
    expect(await clipboard.readDropEffect()).toBe(codecs.DROP_EFFECT_MOVE);
  });

  it("reports a bare uri-list as a copy", async () => {
    const transport = memoryTransport();
    transport.store.set(codecs.FORMAT_URI_LIST, codecs.encodeUriList(samplePaths));
    const clipboard = createLinuxClipboard(transport);
    expect(await clipboard.readDropEffect()).toBe(codecs.DROP_EFFECT_COPY);
  });

  it("reports an empty clipboard as none", async () => {
    const clipboard = createLinuxClipboard(memoryTransport());
    expect(await clipboard.readFilePaths()).toEqual([]);
    expect(await clipboard.readDropEffect()).toBe(codecs.DROP_EFFECT_NONE);
  });

  it("clears through the transport", async () => {
    const transport = memoryTransport();
    const clipboard = createLinuxClipboard(transport);
    await clipboard.writeFilePaths(samplePaths);
    await clipboard.clear();
    expect(await clipboard.readFilePaths()).toEqual([]);
  });
});
