// 生成软著三类PDF鉴别材料：程序鉴别材料(源代码)、文档鉴别材料(用户手册)、其他相关证明文件(身份证明说明)
import { readdirSync, readFileSync, writeFileSync, renameSync, unlink as fs_unlink, existsSync } from 'fs'
import { createRequire } from 'module'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
const require = createRequire(import.meta.url)
const fontkitPkg = require('fontkit')
const fontkit = {
  create: (fontData) => {
    const buf = Buffer.isBuffer(fontData) ? fontData : Buffer.from(fontData)
    return fontkitPkg.create(buf)
  },
}

const DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]):\//, '$1:/').replace(/\//g, '\\')
const resolve = (name) => DIR + name

function pick(pattern) {
  const all = readdirSync(DIR)
  const m = all.find((f) => pattern.test(f))
  if (!m) throw new Error('未找到匹配文件: ' + pattern)
  return m
}

const SW = '源代码_会计小当家教学软件_V2.0.4.txt'
const MW = '用户手册_会计小当家教学软件_V2.0.4.md'
const srcName = pick(/^源代码.*\.txt$/)
const manName = pick(/^用户手册.*\.md$/)

// 写入PDF：优先原子替换；若文件被占用(rename失败)，则改写到带序号的新文件名，避免覆盖失败
function safeWrite(finalName, out) {
  const tmp = '._tmp_' + finalName
  writeFileSync(resolve(tmp), out)
  try {
    try { fs_unlink(resolve(finalName)) } catch (e) {}
    renameSync(resolve(tmp), resolve(finalName))
  } catch (e) {
    let i = 1
    let alt
    do {
      alt = finalName.replace(/(\.[^.]+)$/, `_${i}$1`)
      i++
    } while (existsSync(resolve(alt)))
    renameSync(resolve(tmp), resolve(alt))
    console.log('  （原文件被占用，已另存为：' + alt + '）')
  }
}

const A4 = { w: 595.28, h: 841.89 }
const MARGIN = 40
const LINE_H = 13
const FONT_SIZE = 9

const FONT_PATH = 'C:\\Windows\\Fonts\\simhei.ttf'
const FONT_PATH_B = 'C:\\Windows\\Fonts\\simhei.ttf'

async function makeSourcePdf() {
  const bytes = readFileSync(resolve(srcName))
  const text = bytes.toString('utf8').replace(/^﻿/, '')
  const lines = text.split(/\r?\n/)
  const perPage = 50
  const totalPages = Math.ceil(lines.length / perPage)
  const headerText = '会计小当家教学软件 V2.0.4 — 源代码（程序鉴别材料）'

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(readFileSync(FONT_PATH), { subset: true })
  for (let p = 0; p < totalPages; p++) {
    const page = doc.addPage([A4.w, A4.h])
    // 页眉
    page.drawText(headerText, { x: MARGIN, y: A4.h - MARGIN + 6, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
    page.drawLine({
      start: { x: MARGIN, y: A4.h - MARGIN },
      end: { x: A4.w - MARGIN, y: A4.h - MARGIN },
      thickness: 0.5, color: rgb(0.7, 0.7, 0.7),
    })
    const slice = lines.slice(p * perPage, (p + 1) * perPage)
    let y = A4.h - MARGIN - 14
    for (const ln of slice) {
      const safe = ln.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
      page.drawText(safe, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) })
      y -= LINE_H
    }
    // 页码
    const pnum = `第 ${p + 1} 页 / 共 ${totalPages} 页`
    const tw = font.widthOfTextAtSize(pnum, 9)
    page.drawText(pnum, { x: (A4.w - tw) / 2, y: MARGIN - 20, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
  }
  const out = await doc.save()
  safeWrite('程序鉴别材料_源代码_会计小当家教学软件_V2.0.4.pdf', out)
  console.log('程序鉴别材料(源代码) PDF 已生成, 页数:', totalPages)
}

async function makeManualPdf() {
  const bytes = readFileSync(resolve(manName))
  const text = bytes.toString('utf8').replace(/^﻿/, '')
  const lines = text.split(/\r?\n/)
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(readFileSync(FONT_PATH), { subset: true })
  const bold = await doc.embedFont(readFileSync(FONT_PATH_B), { subset: true })
  const maxW = A4.w - MARGIN * 2
  let page = doc.addPage([A4.w, A4.h])
  let y = A4.h - MARGIN
  const newPage = () => { page = doc.addPage([A4.w, A4.h]); y = A4.h - MARGIN }
  const drawLine = (ln, size, f, color, indent = 0) => {
    // 简单按字符宽度折行（中文按全角计宽）
    const chars = Array.from(ln)
    let cur = ''
    let curW = 0
    const lineH = size + 8
    for (const ch of chars) {
      const cw = f.widthOfTextAtSize(ch, size)
      if (curW + cw > maxW - indent) {
        if (y < MARGIN + 20) newPage()
        page.drawText(cur, { x: MARGIN + indent, y, size, font: f, color })
        y -= lineH
        cur = ch
        curW = cw
      } else {
        cur += ch
        curW += cw
      }
    }
    if (cur) {
      if (y < MARGIN + 20) newPage()
      page.drawText(cur, { x: MARGIN + indent, y, size, font: f, color })
      y -= lineH
    }
    y -= 4
  }
  // 真实运行截图：将软件实际界面截图嵌入文档（替代占位框）
  const SHOT_DIR = 'C:\\proj\\app\\shots\\'
  const SHOT_FILES = ['p01_home', 'p02_company_select', 'p03_difficulty', 'p04_game_main', 'p05_decision_analysis', 'p06_operation', 'p07_reports', 'p08_me', 'p09_project_difficulty']
  const shotImages = []
  for (const sf of SHOT_FILES) {
    try {
      const png = await doc.embedPng(readFileSync(SHOT_DIR + sf + '.png'))
      shotImages.push(png)
    } catch (e) {
      console.log('截图缺失跳过:', sf, e.message)
    }
  }
  let figNo = 0
  let shotCursor = 0
  const drawFigure = (caption) => {
    figNo += 1
    // 说明文字
    const cap = `图 ${figNo}：${caption}`
    const cs = 10
    if (y < MARGIN + 40) newPage()
    const cw = font.widthOfTextAtSize(cap, cs)
    page.drawText(cap, { x: (A4.w - cw) / 2, y, size: cs, font, color: rgb(0.3, 0.3, 0.3) })
    y -= cs + 8
    const img = shotImages.length ? shotImages[shotCursor % shotImages.length] : null
    shotCursor += 1
    if (img) {
      const iw = img.width
      const ih = img.height
      const drawW = maxW - 20
      const drawH = (ih / iw) * drawW
      if (y - drawH < MARGIN + 10) newPage()
      const top = y
      page.drawImage(img, { x: MARGIN + 10, y: top - drawH, width: drawW, height: drawH })
      y = top - drawH - 14
    } else {
      const boxH = 150
      if (y - boxH < MARGIN + 20) newPage()
      const top = y
      page.drawRectangle({ x: MARGIN + 40, y: top - boxH, width: maxW - 80, height: boxH, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 1, color: rgb(0.96, 0.96, 0.96) })
      y = top - boxH - 14
    }
    y -= 6
  }
  for (const raw of lines) {
    const ln = raw.replace(/\t/g, '  ')
    if (/^#{1,3}\s/.test(ln)) {
      const level = (ln.match(/^#+/)[0]).length
      const title = ln.replace(/^#+\s/, '')
      const size = level === 1 ? 18 : level === 2 ? 14 : 12
      const f = level === 1 ? bold : bold
      if (y < MARGIN + 40) newPage()
      y -= 8
      drawLine(title, size, f, rgb(0, 0, 0))
    } else if (/建议配图/.test(ln)) {
      const m = ln.match(/建议配图[：:]\s*(.*)/)
      const cap = m ? m[1].replace(/[（(].*$/, '').trim() : '软件界面截图'
      drawFigure(cap)
    } else if (/^\s*\|/.test(ln) && /\|/.test(ln)) {
      // 表格行：简单处理，去除首尾|并分隔
      const cells = ln.split('|').map((c) => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''))
      drawLine(cells.join('   |   '), 10, font, rgb(0, 0, 0), 10)
    } else if (ln.trim() === '') {
      y -= 6
    } else if (/^[-*]\s/.test(ln)) {
      const item = ln.replace(/^[-*]\s/, '• ')
      drawLine(item, 11, font, rgb(0, 0, 0), 10)
    } else if (/^\s*>\s/.test(ln)) {
      drawLine(ln.replace(/^\s*>\s/, ''), 10, font, rgb(0.4, 0.4, 0.4), 10)
    } else {
      drawLine(ln, 11, font, rgb(0, 0, 0))
    }
  }
  const out = await doc.save()
  safeWrite('文档鉴别材料_用户手册_会计小当家教学软件_V2.0.4_截图版.pdf', out)
  console.log('文档鉴别材料(用户手册) PDF 已生成, 页数:', doc.getPageCount())
}

async function makeProofPdf() {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(readFileSync(FONT_PATH), { subset: true })
  const bold = await doc.embedFont(readFileSync(FONT_PATH_B), { subset: true })
  const text = [
    ['其他相关证明文件 — 著作权人身份证明', 16, bold, 0],
    ['', 10, font, 0],
    ['软件名称：会计小当家教学软件', 11, font, 0],
    ['版本号：V2.0.4', 11, font, 0],
    ['', 8, font, 0],
    ['一、著作权人（申请主体）信息', 13, bold, 0],
    ['姓名：董之洋', 11, font, 0],
    ['身份证号：370786199507180016', 11, font, 0],
    ['通讯地址：山东省潍坊市', 11, font, 0],
    ['联系电话：（请自行补充）', 11, font, 0],
    ['', 8, font, 0],
    ['二、需提交的身份证明文件', 13, bold, 0],
    ['1. 申请人身份证正反面复印件一份，须本人签字确认。', 11, font, 0],
    ['2. 复印件须清晰可辨，信息完整，与申请表填写的姓名、证件号码一致。', 11, font, 0],
    ['3. 如由代理人办理，另附代理人身份证复印件及授权委托书。', 11, font, 0],
    ['', 8, font, 0],
    ['三、权利取得与归属说明', 13, bold, 0],
    ['本软件由董之洋独立开发，以原始取得方式享有著作权，权利范围为全部权利。', 11, font, 0],
    ['开发语言：JavaScript、TypeScript、HTML、CSS。', 11, font, 0],
    ['开发方式：独立开发（原始取得）。', 11, font, 0],
    ['', 8, font, 0],
    ['四、材料真实性声明', 13, bold, 0],
    ['本人声明：本软著申请所提交的全部材料真实、合法、有效，如有不实，愿承担相应法律责任。', 11, font, 0],
    ['', 8, font, 0],
    ['申请人（签字）：________________', 11, font, 0],
    ['日期：______年______月______日', 11, font, 0],
  ]
  const page = doc.addPage([A4.w, A4.h])
  let y = A4.h - MARGIN
  for (const [t, size, f, indent] of text) {
    const chars = Array.from(t)
    let cur = ''
    let curW = 0
    for (const ch of chars) {
      const cw = f.widthOfTextAtSize(ch, size)
      if (curW + cw > A4.w - MARGIN * 2 - indent) {
        page.drawText(cur, { x: MARGIN + indent, y, size, font: f, color: rgb(0, 0, 0) })
        y -= size + 6
        cur = ch
        curW = cw
      } else {
        cur += ch
        curW += cw
      }
    }
    page.drawText(cur, { x: MARGIN + indent, y, size, font: f, color: rgb(0, 0, 0) })
    y -= size + 8
  }
  const out = await doc.save()
  safeWrite('其他相关证明文件_著作权人身份证明_董之洋.pdf', out)
  console.log('其他相关证明文件 PDF 已生成, 页数:', doc.getPageCount())
}

await makeSourcePdf()
await makeManualPdf()
await makeProofPdf()
console.log('全部 PDF 生成完成。')
