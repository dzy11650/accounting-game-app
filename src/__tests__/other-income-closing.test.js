/**
 * #2 营业外收入-税收返补未进利润结转 — 复现测试（修复后应绿）
 *
 * 修复前代码（settleTax）：
 *   602: applyBusiness(state, mk('营业外收入-税收返补', rebate, '应交税费-税收返补', rebate, ...), state.month)
 *   603: state.balances['本年利润'] = +((state.balances['本年利润'] || 0) + rebate).toFixed(2)
 *
 * 修复前症状：
 *   1. 贷记"应交税费-税收返补"（负债增加），但无银行存款流入 → 恒等式缺口 = rebate
 *   2. 营业外收入-税收返补不在 PNL_SUBJECTS_TO_RESET → 月末不清零、不结转
 *   3. 手动本年利润 += rebate 绕过损益结转链路
 *
 * 修复后断言：
 *   税收返补 = 借 银行存款 / 贷 营业外收入-税收返补；月末结转后清零；无手工 +=。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCompany, settleTax, monthEnd, sumAccount } from '../lib/engine.js'

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

test('#2 税收返补应让现金（银行存款）真实流入', () => {
  const s = createCompany('tech', 'easy')
  s.taxRebate = 0.1
  s.taxType = 'general'
  s.balances['银行存款'] = 100
  s.balances['本年利润'] = 100
  s.vatOutput = 0
  s.vatInput = 0

  const cashBefore = s.balances['银行存款']
  // taxableProfit=100 ≤300 => CIT 5%; cit0=5; rebate = 5*10% = 0.5
  settleTax(s, [])
  const cashAfter = s.balances['银行存款']

  // 修复前：现金不变（bug — 返补进了"应交税费"负债而非现金）
  // 修复后：现金必须增加 0.5
  assert.ok(cashAfter - cashBefore > 0,
    `Bug 复现：税收返补未使现金流入 → before=${cashBefore}, after=${cashAfter}`)
})

test('#2 税收返补不应挂账到应交税费负债', () => {
  const s = createCompany('tech', 'easy')
  s.taxRebate = 0.1
  s.taxType = 'general'
  s.balances['银行存款'] = 100
  s.balances['本年利润'] = 100
  s.vatOutput = 0
  s.vatInput = 0

  settleTax(s, [])
  // 修复前挂在"应交税费-税收返补"，修复后应=0
  assert.strictEqual(sumAccount(s.balances, '应交税费-税收返补'), 0,
    'Bug 复现：税收返补挂在应交税费负债，应删除该挂账')
})

test('#2 营业外收入-税收返补月末必须结转清零且恒等式平衡', () => {
  const s = createCompany('tech', 'easy')
  s.taxRebate = 0.1
  s.taxType = 'general'
  s.balances['银行存款'] = 100
  s.balances['本年利润'] = 100
  s.vatOutput = 0
  s.vatInput = 0

  settleTax(s, [])
  monthEnd(s)

  // 修复前：营业外收入-税收返补不在 PNL_SUBJECTS_TO_RESET，月末仍 ≠ 0
  assert.strictEqual(sumAccount(s.balances, '营业外收入-税收返补'), 0,
    'Bug 复现：营业外收入-税收返补月末未结转清零')
  assertBalanced(s, '#2 月末结转后')
})
