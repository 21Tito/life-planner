/**
 * OneDrive can leave `.next/trace` in a state where Node's readlink() fails
 * (EINVAL), which prevents `next dev` from starting. Remove it before dev.
 */
const fs = require("fs");
const path = require("path");

const cwd = process.cwd();
if (!/onedrive/i.test(cwd.replace(/\\/g, "/"))) {
  process.exit(0);
}

const trace = path.join(cwd, ".next", "trace");
try {
  fs.unlinkSync(trace);
} catch (e) {
  if (e && e.code !== "ENOENT") {
    console.warn("[clean-next-trace]", e.message);
  }
}
