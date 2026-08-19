const { execFile, spawnSync } = require("node:child_process");
const codecs = require("./codecs");

// A transport moves buffers to and from the platform clipboard; the codecs
// decide what those buffers say. Keeping the two apart is what lets this file
// stay pure JS: Electron's clipboard, wl-clipboard and xclip all fit the same
// three-function shape, and the Electron 44 rewrite only replaces a transport.
function createLinuxClipboard(transport) {
  if (!transport) throw new TypeError("createLinuxClipboard requires a transport");

  const read = async (format) => {
    const data = await transport.readBuffer(format);
    return data && data.length > 0 ? data : null;
  };

  return {
    async readFilePaths() {
      const gnome = await read(codecs.FORMAT_GNOME_COPIED_FILES);
      if (gnome) return codecs.decodeGnomeCopiedFiles(gnome).paths;
      const uris = await read(codecs.FORMAT_URI_LIST);
      return uris ? codecs.decodeUriList(uris) : [];
    },

    async readDropEffect() {
      const gnome = await read(codecs.FORMAT_GNOME_COPIED_FILES);
      if (gnome) {
        const { dropEffect } = codecs.decodeGnomeCopiedFiles(gnome);
        if (dropEffect !== codecs.DROP_EFFECT_NONE) return dropEffect;
      }
      const kde = await read(codecs.FORMAT_KDE_CUT_SELECTION);
      if (kde) return codecs.decodeKdeCutSelection(kde);
      const uris = await read(codecs.FORMAT_URI_LIST);
      if (uris && codecs.decodeUriList(uris).length > 0) return codecs.DROP_EFFECT_COPY;
      return codecs.DROP_EFFECT_NONE;
    },

    async writeFilePaths(paths, dropEffect = codecs.DROP_EFFECT_COPY) {
      const entries = [
        {
          format: codecs.FORMAT_GNOME_COPIED_FILES,
          data: codecs.encodeGnomeCopiedFiles(paths, dropEffect),
        },
        { format: codecs.FORMAT_URI_LIST, data: codecs.encodeUriList(paths) },
        { format: codecs.FORMAT_KDE_CUT_SELECTION, data: codecs.encodeKdeCutSelection(dropEffect) },
      ];
      // A single-format transport writes only the first entry, so on KDE lead
      // with the uri-list that Dolphin actually reads.
      if (/kde/i.test(process.env.XDG_CURRENT_DESKTOP || "")) {
        entries.unshift(entries.splice(1, 1)[0]);
      }
      await transport.writeBuffers(entries);
    },

    async clear() {
      await transport.clear();
    },
  };
}

// Electron <= 43 exposes raw clipboard targets through readBuffer/writeBuffer.
// Electron 44 removes both (and the clipboard module from renderers), so the
// capability is feature-detected, never assumed.
function electronTransport() {
  if (!process.versions.electron) return null;
  let clipboard;
  try {
    // eslint-disable-next-line n/no-missing-require -- present inside Electron only
    clipboard = require("electron").clipboard;
  } catch {
    return null;
  }
  if (
    !clipboard ||
    typeof clipboard.readBuffer !== "function" ||
    typeof clipboard.writeBuffer !== "function"
  ) {
    return null;
  }
  return {
    readBuffer(format) {
      try {
        return clipboard.readBuffer(format);
      } catch {
        return null;
      }
    },
    // writeBuffer replaces the whole clipboard, so only one format can be
    // offered at a time; the caller ordered the entries by importance.
    writeBuffers(entries) {
      clipboard.writeBuffer(entries[0].format, entries[0].data);
    },
    clear() {
      clipboard.clear();
    },
  };
}

function commandExists(command, probeArgs) {
  try {
    const result = spawnSync(command, probeArgs, { stdio: "ignore" });
    return !result.error;
  } catch {
    return false;
  }
}

function runForOutput(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }, (error, stdout) =>
      resolve(error ? null : stdout),
    );
  });
}

function runWithInput(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, (error) => (error ? reject(error) : resolve()));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

function waylandTransport() {
  if (!process.env.WAYLAND_DISPLAY) return null;
  if (!commandExists("wl-copy", ["--version"]) || !commandExists("wl-paste", ["--version"])) {
    return null;
  }
  return {
    readBuffer: (format) => runForOutput("wl-paste", ["--type", format, "--no-newline"]),
    writeBuffers: (entries) =>
      runWithInput("wl-copy", ["--type", entries[0].format], entries[0].data),
    clear: () => runWithInput("wl-copy", ["--clear"], null),
  };
}

function x11Transport() {
  if (!process.env.DISPLAY) return null;
  if (!commandExists("xclip", ["-version"])) return null;
  const selection = ["-selection", "clipboard"];
  return {
    readBuffer: (format) => runForOutput("xclip", [...selection, "-t", format, "-o"]),
    writeBuffers: (entries) =>
      runWithInput("xclip", [...selection, "-t", entries[0].format, "-i"], entries[0].data),
    clear: () => runWithInput("xclip", [...selection, "-i"], Buffer.alloc(0)),
  };
}

function createDefaultTransport() {
  const transport = electronTransport() || waylandTransport() || x11Transport();
  if (!transport) {
    throw new Error(
      "clipboard-files: no Linux clipboard transport available - run inside Electron, " +
        "install wl-clipboard or xclip, or supply one with createLinuxClipboard(transport)",
    );
  }
  return transport;
}

module.exports = { createLinuxClipboard, createDefaultTransport };
