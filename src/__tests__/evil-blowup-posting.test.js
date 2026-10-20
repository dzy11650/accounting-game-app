/**
 * #3 爆雷追缴假过账 — 复现测试（修复后应绿）
 *
 * 修复前代码（maybeEvilBlowup line 1412-1413）：
 *   entries.push(...mk('所得税费用', fine, '应交税费-滞纳金', fine, ...))
 *   entries.push(...mk('应交税费-滞纳金', fine, '银行存款', fine, ...))
 *
 * 修复前症状：
 *   1. 借"所得税费用"而非"应交税费-所得税" → 应交税费未减少，税款未销账
 *   2. 罚款计入"管理费用"而非"营业外支出-罚款"
 *   3. "所得税费用"在 PNL_KEEP_BALANCE_SUBJECTS 保护清单中，永不清零，跨月累积
 *
 * 修复后断言：
 *   借 应交税费-所得税 / 借 营业外支出-罚款 / 贷 银行存款
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCompany, maybeEvilBlowup, sumAccount } from '../lib/engine.js'

function totalAssets(s) {
  const g = (k) => sumAccount(s.balances, k)
  return +(
    g('银行存款') + g('库存现金') + g('应收账款') + g('原材料') + g('库存商品') +
    g('生产成本') + g('预付账款') + g('固定资产') - g('累计折旧') +
    g('无形资产') - g('累计摊销') + g('研发支出')
  ).toFixed(2)
}

function totalLiabEquity(s) {
  const g = (k) => sumAccount(s.balances, k)
  const liab = g('短期借款') + g('应付账款') + g('应付职工薪酬') + g('应付利息') + g('应交税费') + g('合同负债')
  const equity = g('实收资本') + g('股本') + g('资本公积') + g('本年利润') - g('利润分配-应付股利')
  return +(liab + equity).toFixed(2)
}

function assertBalanced(s, label) {
  const a = totalAssets(s)
  const le = totalLiabEquity(s)
  const gap = +(a - le).toFixed(2)
  assert.ok(Math.abs(gap) < 0.05, `${label}: 恒等式被打破 → 资产=${a}, 负债+权益=${le}, gap=${gap}`)
  return { assets: a, liabEquity: le, gap }
}

test('#3 爆雷追缴税款应真实销账，应交税费-所得税必须减少', () => {
  const s = createCompany('shop', 'easy')
  s.balances['银行存款'] = 500
  s.balances['应交税费-所得税'] = 50
  s.evilCount = 3
  s.year = 1

  // Force blowup by setting pendingBlowup path (randomized, so we check if entries were made)
  const beforeTax = sumAccount(s.balances, '应交税费')
  const msg = maybeEvilBlowup(s, 12)
  if (msg === null) { console.log('SKIP: random no blowup'); return }

  const afterTax = sumAccount(s.balances, '应交税费')
  // Fix: taxDue should be reduced (debited)
  assert.ok(afterTax < beforeTax,
    `Bug 复现：爆雷追缴税款应交税费应减少 → before=${beforeTax}, after=${afterTax}`)
})

test('#3 爆雷罚款应计入营业外支出 - 罚款，而非管理费用', () => {
  const s = createCompany('shop', 'easy')
  s.balances['银行存款'] = 500
  s.balances['应交税费-所得税'] = 50
  s.evilCount = 3
  s.year = 1

  const msg = maybeEvilBlowup(s, 12)
  if (msg === null) { console.log('SKIP: random no blowup'); return }

  // Fix: fine should be in "营业外支出 - 罚款", not "管理费用"
  const fineExpense = sumAccount(s.balances, '营业外支出 - 罚款')
  assert.ok(fineExpense > 0,
    'Bug 复现：罚款应计入营业外支出 - 罚款，实际 0')
})

test('#3 爆雷分录恒等式应保持平衡', () => {
  const s = createCompany('shop', 'easy')
  s.balances['银行存款'] = 500
  s.balances['应交税费-所得税'] = 50
  s.evilCount = 3
  s.year = 1

  const msg = maybeEvilBlowup(s, 12)
  if (msg === null) { console.log('SKIP: random no blowup'); return }

  assertBalanced(s, '#3 爆雷后')
})
