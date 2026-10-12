#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

const arch = process.arch === "x64" ? "amd64" : process.arch;
const packageName = "iphone-webcam";
const version = pkg.version;
const distDir = join(repoRoot, "dist");
const buildRoot = join(distDir, `${packageName}_${version}_${arch}`);
const optRoot = join(buildRoot, "opt/iphone-webcam");
const debianRoot = join(buildRoot, "DEBIAN");
const binRoot = join(buildRoot, "usr/bin");
const appRoot = join(buildRoot, "usr/share/applications");
const iconRoot = join(buildRoot, "usr/share/pixmaps");
const nodePath = realpathSync(process.execPath);
const debPath = join(distDir, `${packageName}_${version}_${arch}.deb`);

mkdirSync(distDir, { recursive: true });
for (const entry of readdirSync(distDir)) {
  if (entry.startsWith(`${packageName}_`) && entry.endsWith(".deb")) {
    unlinkSync(join(distDir, entry));
  }
}

function chmodTree(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    chmodSync(path, 0o755);
    for (const entry of readdirSync(path)) {
      chmodTree(join(path, entry));
    }
    return;
  }

  chmodSync(path, 0o644);
}

rmSync(buildRoot, { recursive: true, force: true });
mkdirSync(optRoot, { recursive: true });
mkdirSync(debianRoot, { recursive: true });
mkdirSync(binRoot, { recursive: true });
mkdirSync(appRoot, { recursive: true });
mkdirSync(iconRoot, { recursive: true });

for (const entry of ["server.mjs", "package.json", "README.md", "public", "bin", "certs"]) {
  const source = join(repoRoot, entry);
  if (existsSync(source)) {
    cpSync(source, join(optRoot, entry), { recursive: true });
  }
}

mkdirSync(join(optRoot, "runtime"), { recursive: true });
cpSync(nodePath, join(optRoot, "runtime/node"));
chmodSync(join(optRoot, "runtime/node"), 0o755);

writeFileSync(
  join(binRoot, "iphone-webcam"),
  [
    "#!/usr/bin/env bash",
    'exec /opt/iphone-webcam/runtime/node /opt/iphone-webcam/bin/iphone-webcam.mjs "$@"',
    "",
  ].join("\n"),
);
writeFileSync(
  join(binRoot, "iphone-webcam-app"),
  [
    "#!/usr/bin/env bash",
    "exec /opt/iphone-webcam/bin/iphone-webcam-desktop.sh",
    "",
  ].join("\n"),
);
chmodSync(join(binRoot, "iphone-webcam"), 0o755);
chmodSync(join(binRoot, "iphone-webcam-app"), 0o755);
chmodSync(join(optRoot, "bin/iphone-webcam.mjs"), 0o755);
chmodSync(join(optRoot, "bin/iphone-webcam-app.mjs"), 0o755);
chmodSync(join(optRoot, "bin/iphone-webcam-desktop.sh"), 0o755);

writeFileSync(
  join(appRoot, "iphone-webcam.desktop"),
  [
    "[Desktop Entry]",
    "Type=Application",
    "Name=iPhone Webcam",
    "GenericName=Webcam para OBS",
    "Comment=Usar a camera do iPhone como webcam local para OBS",
    "Exec=/usr/bin/iphone-webcam-app",
    "Icon=camera-web",
    "Terminal=false",
    "Categories=AudioVideo;Video;",
    "Keywords=iphone;webcam;camera;obs;video;",
    "StartupNotify=true",
    "",
  ].join("\n"),
);

writeFileSync(
  join(debianRoot, "control"),
  [
    `Package: ${packageName}`,
    `Version: ${version}`,
    "Section: video",
    "Priority: optional",
    `Architecture: ${arch}`,
    "Depends: libc6, libstdc++6, libgcc-s1, xdg-utils",
    "Maintainer: iPhone Webcam <noreply@example.local>",
    "Description: Use a camera do iPhone como webcam local para OBS",
    " Aplicativo local que conecta o Safari do iPhone ao OBS Studio no Linux via WebRTC.",
    "",
  ].join("\n"),
);

writeFileSync(
  join(debianRoot, "postinst"),
  [
    "#!/usr/bin/env bash",
    "set -e",
    "if command -v update-desktop-database >/dev/null 2>&1; then",
    "  update-desktop-database /usr/share/applications || true",
    "fi",
    "if command -v xdg-desktop-menu >/dev/null 2>&1; then",
    "  xdg-desktop-menu forceupdate || true",
    "fi",
    "",
  ].join("\n"),
);
chmodSync(join(debianRoot, "postinst"), 0o755);

chmodTree(join(buildRoot, "opt"));
chmodTree(join(buildRoot, "usr"));
chmodSync(join(optRoot, "runtime/node"), 0o755);
chmodSync(join(optRoot, "bin/iphone-webcam.mjs"), 0o755);
chmodSync(join(optRoot, "bin/iphone-webcam-app.mjs"), 0o755);
chmodSync(join(optRoot, "bin/iphone-webcam-desktop.sh"), 0o755);
chmodSync(join(binRoot, "iphone-webcam"), 0o755);
chmodSync(join(binRoot, "iphone-webcam-app"), 0o755);

execFileSync("dpkg-deb", ["--root-owner-group", "--build", buildRoot, debPath], { stdio: "inherit" });
rmSync(buildRoot, { recursive: true, force: true });
console.log(`Pacote criado: ${debPath}`);
console.log(`Nome do arquivo: ${basename(debPath)}`);
