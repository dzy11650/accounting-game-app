/**
 * #6 税收返补方向反 — 复现测试（修复后应绿）
 *
 * 修复前代码（settleTax line 602-603）：
 *   applyBusiness(state, mk('营业外收入-税收返补', rebate, '应交税费-税收返补', rebate, ...), ...)
 *   state.balances['本年利润'] = +((state.balances['本年利润'] || 0) + rebate).toFixed(2)
 *
 * 修复前症状：
 *   1. 贷记"应交税费-税收返补"（负债增加），但现金未流入
 *   2. 手动"本年利润+="绕过损益结转链路
 *   3. 恒等式失衡：资产未增，负债 + 权益均增，差额 = rebate
 *
 * 修复后断言：
 *   借 银行存款 / 贷 营业外收入-税收返补，并删除手动本年利润+=。
 *   营业外收入-税收返补应加入 PNL_SUBJECTS_TO_RESET 以便月末结转。
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

test('#6 税收返补应使现金（银行存款）流入，而非挂账负债', () => {
  const s = createCompany('tech', 'easy')
  s.taxRebate = 0.1
  s.taxType = 'general'
  s.balances['银行存款'] = 100
  s.balances['本年利润'] = 100
  s.vatOutput = 0
  s.vatInput = 0

  const cashBefore = s.balances['银行存款']
  settleTax(s, [])
  const cashAfter = s.balances['银行存款']

  // Fix: cash must increase by rebate amount
  assert.ok(cashAfter > cashBefore,
    `Bug 复现：税收返补应使现金流入 → before=${cashBefore}, after=${cashAfter}`)
})

test('#6 税收返补不应增加应交税费负债', () => {
  const s = createCompany('tech', 'easy')
  s.taxRebate = 0.1
  s.taxType = 'general'
  s.balances['银行存款'] = 100
  s.balances['本年利润'] = 100
  s.vatOutput = 0
  s.vatInput = 0

  settleTax(s, [])
  // Fix: no liability balance should remain
  assert.strictEqual(sumAccount(s.balances, '应交税费-税收返补'), 0,
    'Bug 复现：税收返补不应挂账负债，应交税费 - 税收返补应=0')
})

test('#6 税收返补月末结转后恒等式必须平衡', () => {
  const s = createCompany('tech', 'easy')
  s.taxRebate = 0.1
  s.taxType = 'general'
  s.balances['银行存款'] = 100
  s.balances['本年利润'] = 100
  s.vatOutput = 0
  s.vatInput = 0

  settleTax(s, [])
  monthEnd(s)
  assertBalanced(s, '#6 税收返补月末结转后')
})
