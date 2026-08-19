export const DROP_EFFECT_NONE: 0;
export const DROP_EFFECT_COPY: 1;
export const DROP_EFFECT_MOVE: 2;
export const DROP_EFFECT_LINK: 4;

/** File paths on the clipboard, or an empty array when it holds none. */
export function readFilePaths(): Promise<string[]>;

/** Whether the paths were cut, copied or linked; one of the constants. */
export function readDropEffect(): Promise<number>;

/** Puts paths on the clipboard; `dropEffect` defaults to `DROP_EFFECT_COPY`. */
export function writeFilePaths(paths: string[], dropEffect?: number): Promise<void>;

/** Empties the clipboard. */
export function clear(): Promise<void>;

export interface LinuxClipboardTransport {
  readBuffer(format: string): Buffer | null | Promise<Buffer | null>;
  writeBuffers(entries: Array<{ format: string; data: Buffer }>): void | Promise<void>;
  clear(): void | Promise<void>;
}

export interface LinuxClipboard {
  readFilePaths(): Promise<string[]>;
  readDropEffect(): Promise<number>;
  writeFilePaths(paths: string[], dropEffect?: number): Promise<void>;
  clear(): Promise<void>;
}

/** A clipboard over a custom Linux transport; the built-in chain is Electron, wl-clipboard, xclip. */
export function createLinuxClipboard(transport: LinuxClipboardTransport): LinuxClipboard;

export namespace codecs {
  const DROP_EFFECT_NONE: 0;
  const DROP_EFFECT_COPY: 1;
  const DROP_EFFECT_MOVE: 2;
  const DROP_EFFECT_LINK: 4;
  const FORMAT_URI_LIST: "text/uri-list";
  const FORMAT_GNOME_COPIED_FILES: "x-special/gnome-copied-files";
  const FORMAT_KDE_CUT_SELECTION: "application/x-kde-cutselection";
  function encodeUriList(paths: string[]): Buffer;
  function decodeUriList(data: Buffer): string[];
  function encodeGnomeCopiedFiles(paths: string[], dropEffect?: number): Buffer;
  function decodeGnomeCopiedFiles(data: Buffer): { paths: string[]; dropEffect: number };
  function encodeKdeCutSelection(dropEffect?: number): Buffer;
  function decodeKdeCutSelection(data: Buffer): number;
}
