/**
 * #4 totalAssets 漏计子科目 — 复现测试
 *
 * 根因（修复前）：totalAssets 用 b['预付账款'] 直取，但实际挂"预付账款-房租"子科目。
 * 导致 isBankrupt、scoreMetrics、破产阈值系统性失真。
 *
 * 修复后：改用 sumAccount(b, '预付账款')，聚合所有以"预付账款-"开头的子科目。
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { createCompany, totalAssets, sumAccount } from '../lib/engine.js'

test('#4 totalAssets：包含「预付账款-房租」等子科目', () => {
  const s = createCompany('shop', 'easy')
  s.balances['银行存款'] = 100
  s.balances['预付账款'] = 0 // 主科目为空
  s.balances['预付账款-房租'] = 20
  s.balances['预付账款-设备'] = 10

  const assets = totalAssets(s.balances)
  const prepaidTotal = sumAccount(s.balances, '预付账款')
  
  assert.strictEqual(prepaidTotal, 30, `预付账款合计应为 30，实际 ${prepaidTotal}`)
  assert.ok(assets >= 130, `总资产应包含预付账款合计 30，实际 ${assets}（若≈100 则是旧 Bug）`)
})

test('#4 totalAssets：当只有子科目时也能正确聚合', () => {
  const s = createCompany('shop', 'easy')
  s.balances['银行存款'] = 50
  s.balances['预付账款'] = 0
  s.balances['预付账款-房租'] = 15
  s.balances['预付账款-广告'] = 5

  const assets = totalAssets(s.balances)
  assert.ok(assets >= 70, `总资产应包含预付账款 20，实际 ${assets}`)
})

test('#4 totalAssets：当主科目和子科目并存时，两者都计入', () => {
  const s = createCompany('shop', 'easy')
  s.balances['银行存款'] = 50
  s.balances['预付账款'] = 10
  s.balances['预付账款-房租'] = 20

  const assets = totalAssets(s.balances)
  const prepaidTotal = sumAccount(s.balances, '预付账款')
  
  assert.strictEqual(prepaidTotal, 30, `预付账款合计应为 30`)
  assert.ok(assets >= 80, `总资产应包含预付账款 30，实际 ${assets}`)
})
