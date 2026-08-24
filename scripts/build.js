const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const addon = path.join(root, "addon");
const manifest = JSON.parse(fs.readFileSync(path.join(addon, "manifest.json"), "utf8"));
const buildDir = path.join(root, "build");
const output = path.join(buildDir, `zotero-card-view-${manifest.version}.xpi`);

fs.mkdirSync(buildDir, { recursive: true });
if (fs.existsSync(output)) fs.rmSync(output);

const python = process.env.CODEX_PYTHON || "python";
const script = [
  "import os,sys,zipfile",
  "src,out=sys.argv[1],sys.argv[2]",
  "with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:",
  "  for base,dirs,files in os.walk(src):",
  "    dirs.sort(); files.sort()",
  "    for name in files:",
  "      file_path=os.path.join(base,name)",
  "      archive_path=os.path.relpath(file_path,src).replace(os.sep,'/')",
  "      z.write(file_path,archive_path)"
].join("\n");
execFileSync(python, ["-c", script, addon, output], { stdio: "inherit" });

console.log(output);

