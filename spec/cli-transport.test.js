const os = require("node:os");
const path = require("node:path");
const clipboard = require("../index");
const { createDefaultTransport } = require("../lib/linux");

// Runs only where a real Linux transport exists - in CI that is xclip under
// xvfb; locally it needs a display and wl-clipboard or xclip installed.
let available = false;
if (process.platform === "linux") {
  try {
    createDefaultTransport();
    available = true;
  } catch {
    available = false;
  }
}
const suite = available ? describe : xdescribe;

const base = path.join(os.tmpdir(), "clipboard-files-spec");
const samplePaths = [path.join(base, "alpha.txt"), path.join(base, "beta folder")];

suite("linux transport round-trip", () => {
  afterAll(async () => {
    await clipboard.clear();
  });

  it("round-trips copied paths", async () => {
    await clipboard.writeFilePaths(samplePaths, clipboard.DROP_EFFECT_COPY);
    expect(await clipboard.readFilePaths()).toEqual(samplePaths);
    expect(await clipboard.readDropEffect()).toBe(clipboard.DROP_EFFECT_COPY);
  });

  it("round-trips a cut", async () => {
    await clipboard.writeFilePaths(samplePaths, clipboard.DROP_EFFECT_MOVE);
    expect(await clipboard.readFilePaths()).toEqual(samplePaths);
    expect(await clipboard.readDropEffect()).toBe(clipboard.DROP_EFFECT_MOVE);
  });

  it("reads back nothing after a clear", async () => {
    await clipboard.writeFilePaths(samplePaths);
    await clipboard.clear();
    expect(await clipboard.readFilePaths()).toEqual([]);
    expect(await clipboard.readDropEffect()).toBe(clipboard.DROP_EFFECT_NONE);
  });
});
