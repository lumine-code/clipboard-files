const os = require("node:os");
const path = require("node:path");
const clipboard = require("../index");

const native = process.platform === "win32" || process.platform === "darwin";
const suite = native ? describe : xdescribe;

// The paths need not exist: the clipboard carries strings, not files.
const base = path.join(os.tmpdir(), "clipboard-files-spec");
const samplePaths = [
  path.join(base, "alpha.txt"),
  path.join(base, "beta folder"),
  path.join(base, "unicode-znak-ż.txt"),
];

suite("native clipboard round-trip", () => {
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

  it("reads an empty clipboard as no paths and no effect", async () => {
    await clipboard.writeFilePaths(samplePaths);
    await clipboard.clear();
    expect(await clipboard.readFilePaths()).toEqual([]);
    expect(await clipboard.readDropEffect()).toBe(clipboard.DROP_EFFECT_NONE);
  });

  it("rejects malformed path lists before touching the clipboard", async () => {
    await expectAsync(clipboard.writeFilePaths("not-an-array")).toBeRejectedWithError(TypeError);
    await expectAsync(clipboard.writeFilePaths([""])).toBeRejectedWithError(TypeError);
    await expectAsync(clipboard.writeFilePaths([42])).toBeRejectedWithError(TypeError);
  });
});
