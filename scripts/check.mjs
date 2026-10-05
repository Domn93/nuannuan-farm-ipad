// 只读项目检查：本地链接、入口资源、语法和现有行为回归。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--docs-only')) {
  console.error('用法：node scripts/check.mjs [--docs-only]');
  process.exit(2);
}

const ignoredDirectories = new Set(['.git', 'build', 'DerivedData', 'xcuserdata', 'node_modules']);
function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return ignoredDirectories.has(entry.name) ? [] : listFiles(file);
      }
      return entry.isFile() ? [file] : [];
    });
}

const files = listFiles(root);
const failures = [];
function fail(file, message) {
  failures.push(`${path.relative(root, file)}: ${message}`);
}

function resolveLocalLink(file, target) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target) || target.startsWith('#')) return null;
  try {
    return path.resolve(path.dirname(file), decodeURIComponent(target.split(/[?#]/)[0]));
  } catch {
    fail(file, `链接编码无效：${target}`);
    return null;
  }
}

let linkCount = 0;
for (const file of files.filter((file) => file.endsWith('.md'))) {
  const markdown = fs.readFileSync(file, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  // 支持仓库使用的内联链接；外部网址与页内锚点不做联网检查。
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '');
    const resolved = resolveLocalLink(file, target);
    if (!resolved) continue;
    linkCount++;
    if (!fs.existsSync(resolved)) fail(file, `本地链接不存在：${target}`);
  }
}
console.log(`文档本地链接：${linkCount} 个已检查（不检查外部网址和锚点）`);

if (!args.includes('--docs-only')) {
  let scriptCount = 0;
  for (const file of files.filter((file) => /\.(?:js|cjs|mjs)$/.test(file))) {
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    scriptCount++;
    if (checked.error || checked.status !== 0) {
      fail(file, checked.error?.message || checked.stderr.trim() || 'JavaScript 语法检查失败');
    }
  }
  console.log(`JavaScript 语法：${scriptCount} 个文件已检查`);

  let resourceCount = 0;
  for (const entry of ['index.html', 'iPadApp/NuannuanFarm/Game/index.html']) {
    const htmlFile = path.join(root, entry);
    const html = fs.readFileSync(htmlFile, 'utf8');
    for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
      const resolved = resolveLocalLink(htmlFile, match[1]);
      if (!resolved) continue;
      resourceCount++;
      if (!fs.existsSync(resolved)) fail(htmlFile, `入口资源不存在：${match[1]}`);
    }

    // 经典脚本共同解析，捕获单文件检查无法发现的重复全局声明。
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)]
      .map((match) => resolveLocalLink(htmlFile, match[1]))
      .filter((file) => file && fs.existsSync(file))
      .map((file) => fs.readFileSync(file, 'utf8'));
    try {
      new vm.Script(scripts.join('\n'), { filename: entry });
    } catch (error) {
      fail(htmlFile, `共享脚本解析失败：${error.message}`);
    }
  }
  console.log(`HTML 本地资源：${resourceCount} 个已检查`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}

if (!args.includes('--docs-only')) {
  const regressions = [
    ['Web 行为回归', 'tests/game-check.cjs'],
    ['iPad 存档与资源回归', 'iPadApp/tests/ipad-check.cjs'],
    ['iPad 音频恢复回归', 'iPadApp/tests/audio-check.cjs']
  ];
  for (const [label, entry] of regressions) {
    console.log(`\n运行 ${label}`);
    const result = spawnSync(process.execPath, [path.join(root, entry)], {
      cwd: root,
      stdio: 'inherit'
    });
    if (result.error || result.status !== 0) {
      console.error(`${label}失败：${result.error?.message || result.signal || result.status}`);
      process.exit(1);
    }
  }
}

console.log('\n项目检查通过。');
