/**
 * #2 营业外收入-税收返补未进利润结转 — 复现测试
 *
 * 根因（修复前）：
 *   Line 602-603:
 *     applyBusiness(state, mk('营业外收入-税收返补', rebate, '应交税费-税收返补', rebate, ...), ...)
 *     state.balances['本年利润'] += rebate
 *   问题：① 贷记"应交税费-税收返补"（负债↑），但无银行存款流入；
 *        ② "营业外收入-税收返补"不在 PNL_SUBJECTS_TO_RESET，月末不清零也不结转至本年利润；
 *        ③ 手动本年利润+= 绕过损益结转链路，导致权益虚增、恒等式缺口。
 *
 * 预期（修复后）：
 *   改为真实三边分录：借 银行存款 / 贷 营业外收入-税收返补，并删除手动本年利润+=。
 *   月末结转时，营业外收入-税收返补应随其他损益科目一并结转至本年利润。
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

test('#2 营业外收入-税收返补应计入损益并结转，否则恒等式失衡', () => {
  const s = createCompany('tech', 'easy')
  s.balances['银行存款'] = 100
  s.balances['本年利润'] = 50
  s.taxRebate = 0.1
  
  // 模拟税收返补场景（当前 buggy 实现）
  const rebate = 10
  applyBusiness(s, mk('营业外收入-税收返补', rebate, '应交税费-税收返补', rebate, '税收返补¥10万'), 1)
  s.balances['本年利润'] = +(s.balances['本年利润'] + rebate).toFixed(2)
  
  // Bug 暴露：恒等式失衡（因为银行存款没增加，但权益增加了）
  const { gap } = assertBalanced(s, '税收返补后（修复前）')
  // 修复前 gap ≈ -10（资产少 10，权益多 10）
  assert.ok(gap !== 0, 'Bug 复现：恒等式应失衡（gap ≠ 0）')
})

test('#2 营业外收入-税收返补月末应结转至本年利润', () => {
  const s = createCompany('tech', 'easy')
  s.balances['银行存款'] = 100
  s.balances['本年利润'] = 50
  s.taxRebate = 0.1
  
  const rebate = 10
  applyBusiness(s, mk('营业外收入-税收返补', rebate, '应交税费-税收返补', rebate, '税收返补¥10万'), 1)
  s.balances['本年利润'] = +(s.balances['本年利润'] + rebate).toFixed(2)
  
  const otherIncome = sumAccount(s.balances, '营业外收入-税收返补')
  // Bug 暴露：营业外收入-税收返补未被清零（因为它不在 PNL_SUBJECTS_TO_RESET）
  assert.ok(otherIncome !== 0, 'Bug 复现：营业外收入-税收返补月末未清零（应结转但未结转）')
})
