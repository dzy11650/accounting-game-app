// 生成一个简单的 512x512 PNG 图标（纯色 + 文字无法用纯代码绘制，这里生成纯色方块）
// 仅用于满足 Tauri 构建对图标文件的存在要求；你可后续替换为正式图标。
import { writeFileSync } from 'fs'
import zlib from 'zlib'

// 最小有效 PNG：512x512, RGBA, 8-bit, 纯色 #FFD24C（会计小当家的金色）
const W = 512, H = 512
const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const crcTable = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = [ (data.length >>> 24) & 0xff, (data.length >>> 16) & 0xff, (data.length >>> 8) & 0xff, data.length & 0xff ]
  const t = [...type].map(c => c.charCodeAt(0))
  const crc = crc32(Buffer.from([...t, ...data]))
  const crcBytes = [ (crc >>> 24) & 0xff, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff ]
  return Buffer.from([...len, ...t, ...data, ...crcBytes])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
// 每个像素 RGBA: 金色 0xFF 0xD2 0x4C
const row = Buffer.alloc(1 + W * 4)
row[0] = 0
for (let x = 0; x < W; x++) { row[1 + x * 4] = 0xFF; row[1 + x * 4 + 1] = 0xD2; row[1 + x * 4 + 2] = 0x4C; row[1 + x * 4 + 3] = 0xFF }
const raw = Buffer.concat(Array.from({ length: H }, () => row))
const idat = Buffer.from(raw)
const png = Buffer.concat([
  Buffer.from(sig),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(idat)),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync('src-tauri/icons/icon.png', png)
console.log('icon written:', png.length, 'bytes')
