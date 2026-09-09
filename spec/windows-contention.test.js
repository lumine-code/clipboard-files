const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const clipboard = require("../index");

const suite = process.platform === "win32" ? describe : () => {};
const samplePaths = [path.join(os.tmpdir(), "clipboard-contention.txt")];

async function whileContended(operation, milliseconds = 40) {
  const script = fs.readFileSync(path.join(__dirname, "fixtures", "hold-clipboard.ps1"), "utf8");
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", `& {${script}} ${milliseconds}`],
    { windowsHide: true },
  );
  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Clipboard helper timed out: ${stderr}`)),
        5000,
      );
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Clipboard helper exited ${code}: ${stderr}`));
      });
      child.stdout.once("data", (data) => {
        clearTimeout(timer);
        if (!data.toString().includes("locked"))
          reject(new Error(`Unexpected clipboard helper output: ${data}`));
        else resolve();
      });
    });
    // Start the release timer only after the parent has received the lock
    // acknowledgement, so a slow process startup cannot hide the contention.
    await new Promise((resolve, reject) =>
      child.stdin.write("release\n", (error) => (error ? reject(error) : resolve())),
    );
    const result = await operation();
    await exited;
    return result;
  } finally {
    child.kill();
  }
}

suite("Windows clipboard contention", () => {
  afterAll(async () => {
    await clipboard.clear();
  });

  it("retries a read while another process briefly owns the clipboard", async () => {
    await clipboard.writeFilePaths(samplePaths, clipboard.DROP_EFFECT_COPY);
    expect(await whileContended(() => clipboard.readFilePaths())).toEqual(samplePaths);
  });

  it("retries reading cut intent instead of returning none during contention", async () => {
    await clipboard.writeFilePaths(samplePaths, clipboard.DROP_EFFECT_MOVE);
    expect(await whileContended(() => clipboard.readDropEffect())).toBe(clipboard.DROP_EFFECT_MOVE);
  });

  it("retries writes without losing their paths or drop effect", async () => {
    await clipboard.clear();
    await whileContended(() => clipboard.writeFilePaths(samplePaths, clipboard.DROP_EFFECT_MOVE));
    expect(await clipboard.readFilePaths()).toEqual(samplePaths);
    expect(await clipboard.readDropEffect()).toBe(clipboard.DROP_EFFECT_MOVE);
  });

  it("retries clearing the clipboard", async () => {
    await clipboard.writeFilePaths(samplePaths, clipboard.DROP_EFFECT_COPY);
    await whileContended(() => clipboard.clear());
    expect(await clipboard.readFilePaths()).toEqual([]);
    expect(await clipboard.readDropEffect()).toBe(clipboard.DROP_EFFECT_NONE);
  });

  it("retains the existing empty result after the bounded retry window", async () => {
    await clipboard.writeFilePaths(samplePaths, clipboard.DROP_EFFECT_MOVE);
    expect(await whileContended(() => clipboard.readDropEffect(), 350)).toBe(
      clipboard.DROP_EFFECT_NONE,
    );
    expect(await clipboard.readDropEffect()).toBe(clipboard.DROP_EFFECT_MOVE);
  });
});
