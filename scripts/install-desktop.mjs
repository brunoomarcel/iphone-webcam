#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = join(homedir(), ".local/share/applications");
const desktopPath = join(desktopDir, "iphone-webcam.desktop");
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const appCommand = join(repoRoot, "bin/iphone-webcam-desktop.sh");

mkdirSync(desktopDir, { recursive: true });

writeFileSync(
  desktopPath,
  [
    "[Desktop Entry]",
    "Type=Application",
    "Name=iPhone Webcam",
    "Comment=Usar a camera do iPhone como webcam local para OBS",
    `Exec=${appCommand}`,
    "Terminal=false",
    "Categories=AudioVideo;Video;",
    "StartupNotify=true",
    "",
  ].join("\n"),
);

console.log(`Atalho instalado em ${desktopPath}`);
