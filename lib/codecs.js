const { pathToFileURL, fileURLToPath } = require("node:url");

// Drop effect constants matching the Windows DROPEFFECT values; the whole
// library speaks these on every platform.
const DROP_EFFECT_NONE = 0;
const DROP_EFFECT_COPY = 1;
const DROP_EFFECT_MOVE = 2;
const DROP_EFFECT_LINK = 4;

// Clipboard target names as Linux file managers register them.
const FORMAT_URI_LIST = "text/uri-list";
const FORMAT_GNOME_COPIED_FILES = "x-special/gnome-copied-files";
const FORMAT_KDE_CUT_SELECTION = "application/x-kde-cutselection";

function toFileUris(paths) {
  return paths.map((filePath) => pathToFileURL(filePath).href);
}

function fromFileUri(uri) {
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}

function stripTrailingNuls(text) {
  return text.replace(/\0+$/, "");
}

// RFC 2483: CRLF-separated URIs, each line terminated, `#` lines are comments.
function encodeUriList(paths) {
  return Buffer.from(
    toFileUris(paths)
      .map((uri) => `${uri}\r\n`)
      .join(""),
    "utf8",
  );
}

function decodeUriList(data) {
  const text = stripTrailingNuls(data.toString("utf8"));
  const paths = [];
  for (const line of text.split(/\r?\n/)) {
    const entry = line.trim();
    if (!entry || entry.startsWith("#") || !entry.startsWith("file:")) continue;
    const filePath = fromFileUri(entry);
    if (filePath) paths.push(filePath);
  }
  return paths;
}

// GNOME: a `copy` or `cut` verb line, then LF-joined file URIs, no trailing
// newline. LINK has no verb of its own and encodes as `copy`.
function encodeGnomeCopiedFiles(paths, dropEffect = DROP_EFFECT_COPY) {
  const verb = dropEffect === DROP_EFFECT_MOVE ? "cut" : "copy";
  return Buffer.from([verb, ...toFileUris(paths)].join("\n"), "utf8");
}

function decodeGnomeCopiedFiles(data) {
  const text = stripTrailingNuls(data.toString("utf8"));
  const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));
  // Nautilus 3.26-3.30 prefixed the payload with the format's own name.
  if (lines[0] === "x-special/nautilus-clipboard") lines.shift();
  const verb = lines.shift();
  if (verb !== "copy" && verb !== "cut") {
    return { paths: [], dropEffect: DROP_EFFECT_NONE };
  }
  const paths = [];
  for (const line of lines) {
    const entry = line.trim();
    if (!entry || !entry.startsWith("file:")) continue;
    const filePath = fromFileUri(entry);
    if (filePath) paths.push(filePath);
  }
  return { paths, dropEffect: verb === "cut" ? DROP_EFFECT_MOVE : DROP_EFFECT_COPY };
}

// KDE marks a cut with a single `1` byte next to the uri-list.
function encodeKdeCutSelection(dropEffect = DROP_EFFECT_COPY) {
  return Buffer.from(dropEffect === DROP_EFFECT_MOVE ? "1" : "0", "utf8");
}

function decodeKdeCutSelection(data) {
  const text = stripTrailingNuls(data.toString("utf8")).trim();
  return text.startsWith("1") ? DROP_EFFECT_MOVE : DROP_EFFECT_COPY;
}

module.exports = {
  DROP_EFFECT_NONE,
  DROP_EFFECT_COPY,
  DROP_EFFECT_MOVE,
  DROP_EFFECT_LINK,
  FORMAT_URI_LIST,
  FORMAT_GNOME_COPIED_FILES,
  FORMAT_KDE_CUT_SELECTION,
  encodeUriList,
  decodeUriList,
  encodeGnomeCopiedFiles,
  decodeGnomeCopiedFiles,
  encodeKdeCutSelection,
  decodeKdeCutSelection,
};
