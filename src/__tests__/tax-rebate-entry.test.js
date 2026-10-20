/**
 * #6 税收返补方向反 — 复现测试
 *
 * 根因（修复前）：
 *   Line 602-603:
 *     applyBusiness(state, mk('营业外收入-税收返补', rebate, '应交税费-税收返补', rebate, ...), ...)
 *     state.balances['本年利润'] += rebate
 *   问题：① 贷记"应交税费-税收返补"（负债增加），但现金未流入；
 *        ② 手动"本年利润+="绕过损益结转链路；
 *        ③ 恒等式失衡：资产未增，负债+权益均增，差额 = rebate。
 *
 * 预期（修复后）：
 *   借 银行存款 / 贷 营业外收入-税收返补，并删除手动本年利润+=。
 *   营业外收入-税收返补应加入 PNL_SUBJECTS_TO_RESET 以便月末结转。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCompany, applyBusiness, mk, sumAccount } from '../lib/engine.js'

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

test('#6 税收返补应使现金流入，而非挂账负债', () => {
  const s = createCompany('tech', 'easy')
  s.balances['银行存款'] = 100
  s.balances['本年利润'] = 50
  s.taxRebate = 0.1
  
  const rebate = 10
  // 当前 buggy 实现：贷记应交税费-税收返补 + 手动本年利润+=
  applyBusiness(s, mk('营业外收入-税收返补', rebate, '应交税费-税收返补', rebate, '税收返补¥10万'), 1)
  s.balances['本年利润'] = +(s.balances['本年利润'] + rebate).toFixed(2)
  
  // Bug 暴露：银行存款未增加（现金未流入）
  const cashAfter = s.balances['银行存款']
  assert.strictEqual(cashAfter, 100, 'Bug 复现：税收返补应使现金流入，但银行存款未增加')
})

test('#6 税收返补不应增加应交税费负债', () => {
  const s = createCompany('tech', 'easy')
  s.balances['银行存款'] = 100
  s.balances['本年利润'] = 50
  s.taxRebate = 0.1
  
  const rebate = 10
  applyBusiness(s, mk('营业外收入-税收返补', rebate, '应交税费-税收返补', rebate, '税收返补¥10万'), 1)
  s.balances['本年利润'] = +(s.balances['本年利润'] + rebate).toFixed(2)
  
  // Bug 暴露：应交税费-税收返补被贷记（负债增加），应删除该挂账
  const taxRebateLiab = sumAccount(s.balances, '应交税费-税收返补')
  assert.ok(taxRebateLiab === 0, 'Bug 复现：税收返补不应挂账负债，应交税费-税收返补应=0')
})
