const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { codecs } = require("../index");

// Absolute local paths so the file URLs are valid on every platform the suite
// runs on; the names exercise spaces, percent signs, hashes and non-ASCII.
const base = path.resolve(path.sep, "clipboard-files spec");
const samplePaths = [
  path.join(base, "plain.txt"),
  path.join(base, "with space.txt"),
  path.join(base, "percent%20sign.txt"),
  path.join(base, "hash#tag.txt"),
  path.join(base, "unicode-znak-ż.txt"),
];

describe("codecs", () => {
  describe("uri-list", () => {
    it("round-trips paths through CRLF-terminated file URIs", () => {
      const data = codecs.encodeUriList(samplePaths);
      const text = data.toString("utf8");
      expect(text.endsWith("\r\n")).toBe(true);
      expect(codecs.decodeUriList(data)).toEqual(samplePaths);
    });

    it("skips comments, blank lines and non-file URIs", () => {
      const uri = pathToFileURL(samplePaths[0]).href;
      const data = Buffer.from(`# comment\r\n\r\nhttps://example.com/a\r\n${uri}\r\n`);
      expect(codecs.decodeUriList(data)).toEqual([samplePaths[0]]);
    });

    it("tolerates LF-only separators and trailing NUL bytes", () => {
      const uris = samplePaths.map((entry) => pathToFileURL(entry).href);
      const data = Buffer.from(`${uris.join("\n")}\0`);
      expect(codecs.decodeUriList(data)).toEqual(samplePaths);
    });
  });

  describe("gnome-copied-files", () => {
    it("round-trips a copy", () => {
      const data = codecs.encodeGnomeCopiedFiles(samplePaths, codecs.DROP_EFFECT_COPY);
      expect(data.toString("utf8").startsWith("copy\n")).toBe(true);
      expect(codecs.decodeGnomeCopiedFiles(data)).toEqual({
        paths: samplePaths,
        dropEffect: codecs.DROP_EFFECT_COPY,
      });
    });

    it("round-trips a cut", () => {
      const data = codecs.encodeGnomeCopiedFiles(samplePaths, codecs.DROP_EFFECT_MOVE);
      expect(data.toString("utf8").startsWith("cut\n")).toBe(true);
      expect(codecs.decodeGnomeCopiedFiles(data).dropEffect).toBe(codecs.DROP_EFFECT_MOVE);
    });

    it("encodes a link as a copy, the only verb GNOME has for it", () => {
      const data = codecs.encodeGnomeCopiedFiles(samplePaths, codecs.DROP_EFFECT_LINK);
      expect(data.toString("utf8").startsWith("copy\n")).toBe(true);
    });

    it("tolerates the Nautilus 3.26-3.30 text-prefixed variant", () => {
      const uri = pathToFileURL(samplePaths[1]).href;
      const data = Buffer.from(`x-special/nautilus-clipboard\ncut\n${uri}\n`);
      expect(codecs.decodeGnomeCopiedFiles(data)).toEqual({
        paths: [samplePaths[1]],
        dropEffect: codecs.DROP_EFFECT_MOVE,
      });
    });

    it("returns none for payloads without a verb", () => {
      expect(codecs.decodeGnomeCopiedFiles(Buffer.from("garbage"))).toEqual({
        paths: [],
        dropEffect: codecs.DROP_EFFECT_NONE,
      });
      expect(codecs.decodeGnomeCopiedFiles(Buffer.alloc(0))).toEqual({
        paths: [],
        dropEffect: codecs.DROP_EFFECT_NONE,
      });
    });
  });

  describe("kde-cutselection", () => {
    it("round-trips both effects as single bytes", () => {
      expect(codecs.encodeKdeCutSelection(codecs.DROP_EFFECT_MOVE).toString()).toBe("1");
      expect(codecs.encodeKdeCutSelection(codecs.DROP_EFFECT_COPY).toString()).toBe("0");
      expect(codecs.decodeKdeCutSelection(Buffer.from("1"))).toBe(codecs.DROP_EFFECT_MOVE);
      expect(codecs.decodeKdeCutSelection(Buffer.from("0"))).toBe(codecs.DROP_EFFECT_COPY);
    });
  });
});
