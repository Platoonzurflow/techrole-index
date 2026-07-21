import { access, cp, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

const frontendRoot = path.resolve(process.cwd());
const requestedDistDir = process.env.NEXT_DIST_DIR ?? process.argv[2] ?? ".next";
const buildDir = path.resolve(frontendRoot, requestedDistDir);
const relativeBuildDir = path.relative(frontendRoot, buildDir);

if (relativeBuildDir.startsWith("..") || path.isAbsolute(relativeBuildDir)) {
  throw new Error(`build directory must stay inside ${frontendRoot}`);
}
if (!path.basename(buildDir).startsWith(".next")) {
  throw new Error(`refusing unexpected build directory: ${buildDir}`);
}

const standaloneDir = path.join(buildDir, "standalone");
const standaloneDistDir = path.join(standaloneDir, path.basename(buildDir));
const staticSource = path.join(buildDir, "static");
const staticTarget = path.join(standaloneDistDir, "static");
const publicSource = path.join(frontendRoot, "public");
const publicTarget = path.join(standaloneDir, "public");

await access(path.join(standaloneDir, "server.js"));
await access(staticSource);
await mkdir(standaloneDistDir, { recursive: true });
await cp(staticSource, staticTarget, { force: true, recursive: true });

let publicCopied = false;
try {
  await access(publicSource);
  await cp(publicSource, publicTarget, { force: true, recursive: true });
  publicCopied = true;
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

async function countFiles(directory) {
  let files = 0;
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const child = await countFiles(entryPath);
      files += child.files;
      bytes += child.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += (await stat(entryPath)).size;
    }
  }
  return { bytes, files };
}

const staticBundle = await countFiles(staticTarget);
if (!staticBundle.files || !staticBundle.bytes) throw new Error("prepared standalone has no static assets");

console.log(JSON.stringify({
  build_dir: buildDir,
  public_copied: publicCopied,
  standalone_dir: standaloneDir,
  static_bytes: staticBundle.bytes,
  static_files: staticBundle.files,
}, null, 2));
