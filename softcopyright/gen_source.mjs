// 软著源代码材料生成器
// 功能：从 src/ 抽取手写源码，去掉空行/大段注释，输出前后各 30 页（每页≥50行）的纯文本
// 用法：node gen_source.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), '..', 'src');
const OUT = process.cwd();
const SOFTWARE = '会计小当家教学软件';
const VERSION = 'V2.0.4';

// 1. 收集所有源码文件（手写，排除依赖）
const exts = ['.js', '.jsx', '.ts', '.tsx', '.css'];
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      // 跳过 node_modules / 构建产物
      if (['node_modules', 'dist', 'build', '.git'].includes(name)) continue;
      walk(p, acc);
    } else if (exts.includes(name.slice(name.lastIndexOf('.')))) {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(SRC).sort();
let lines = [];
const fileMarkers = [];
for (const f of files) {
  const rel = f.replace(SRC + '\\', '').replace(/\\/g, '/');
  const content = readFileSync(f, 'utf-8').split('\n');
  // 去掉整行注释与空行（保留代码行，凑行数用）
  const codeLines = content.filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('*/');
  });
  fileMarkers.push({ rel, startLine: lines.length + 1 });
  lines.push(`/* ===== 文件: ${rel} ===== */`);
  lines.push(...codeLines);
}

// 2. 计算总页数（每页 50 行）
const PER_PAGE = 50;
const totalPages = Math.ceil(lines.length / PER_PAGE);

// 软著要求：不足60页交全部，≥60页交前后各30页
let pagesToPrint;
if (totalPages <= 60) {
  pagesToPrint = Array.from({ length: totalPages }, (_, i) => i);
} else {
  const head = Array.from({ length: 30 }, (_, i) => i);
  const tail = Array.from({ length: 30 }, (_, i) => totalPages - 30 + i);
  pagesToPrint = [...head, ...tail];
}

// 3. 生成带页眉/页码的文本
let out = '';
for (const pg of pagesToPrint) {
  const start = pg * PER_PAGE;
  const slice = lines.slice(start, start + PER_PAGE);
  out += `${SOFTWARE} ${VERSION}\n`;
  out += '—'.repeat(40) + '\n';
  for (const ln of slice) out += ln + '\n';
  // 补满 50 行
  const pad = PER_PAGE - slice.length;
  for (let i = 0; i < pad; i++) out += '\n';
  out += `${pg + 1} / ${totalPages}\n`;
  out += '\n\n';
}

const outFile = join(OUT, '源代码_会计小当家教学软件_V2.0.4.txt');
writeFileSync(outFile, out, 'utf-8');
console.log(`源码总行数: ${lines.length}, 总页数: ${totalPages}`);
console.log(`输出文件: ${outFile}`);
console.log(`打印页数: ${pagesToPrint.length} (${pagesToPrint.length === 60 ? '前后各30页' : '全部提交'})`);
console.log('含文件:', files.map((f) => f.replace(SRC + '\\', '')).join(', '));
