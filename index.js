const codecs = require("./lib/codecs");
const { createLinuxClipboard, createDefaultTransport } = require("./lib/linux");

const { DROP_EFFECT_NONE, DROP_EFFECT_COPY, DROP_EFFECT_MOVE, DROP_EFFECT_LINK } = codecs;

// The backend is resolved on first use so that requiring the module never
// throws: a missing native build or Linux transport surfaces as a rejection
// from the call that needed it, with the remedy in the message.
let backend = null;

function loadBackend() {
  if (backend) return backend;
  if (process.platform === "linux") {
    backend = createLinuxClipboard(createDefaultTransport());
    return backend;
  }
  let native;
  try {
    native = require("./build/Release/clipboard_files.node");
  } catch (cause) {
    throw new Error(
      "clipboard-files: the native addon is not built - run `npm run build` " +
        "(requires a C++ toolchain; supported on Windows and macOS)",
      { cause },
    );
  }
  backend = {
    async readFilePaths() {
      return native.readFilePaths();
    },
    async readDropEffect() {
      return native.readDropEffect();
    },
    async writeFilePaths(paths, dropEffect = DROP_EFFECT_COPY) {
      native.writeFilePaths(paths, dropEffect);
    },
    async clear() {
      native.clear();
    },
  };
  return backend;
}

module.exports = {
  DROP_EFFECT_NONE,
  DROP_EFFECT_COPY,
  DROP_EFFECT_MOVE,
  DROP_EFFECT_LINK,

  async readFilePaths() {
    return loadBackend().readFilePaths();
  },

  async readDropEffect() {
    return loadBackend().readDropEffect();
  },

  async writeFilePaths(paths, dropEffect = DROP_EFFECT_COPY) {
    if (!Array.isArray(paths) || paths.some((entry) => typeof entry !== "string" || !entry)) {
      throw new TypeError("writeFilePaths expects an array of non-empty path strings");
    }
    return loadBackend().writeFilePaths(paths, dropEffect);
  },

  async clear() {
    return loadBackend().clear();
  },

  createLinuxClipboard,
  codecs,
};
