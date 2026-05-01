const fs = require("fs");
const path = require("path");
const { parse } = require("@vue/compiler-sfc");

const root = path.join(__dirname, "..", "src");
const vueFiles = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (name.endsWith(".vue")) {
      vueFiles.push(fullPath);
    }
  }
}

walk(root);

let failed = false;
for (const file of vueFiles) {
  const source = fs.readFileSync(file, "utf8");
  const result = parse(source, { filename: file });
  if (result.errors.length > 0) {
    failed = true;
    console.error(path.relative(path.join(__dirname, ".."), file));
    for (const error of result.errors) {
      console.error(`  - ${error.message || error}`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`OK ${vueFiles.length} vue files parsed`);
