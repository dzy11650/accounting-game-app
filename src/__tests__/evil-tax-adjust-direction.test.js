/**
 * #5 evilTaxAdjust 方向错 — 复现测试（修复后应绿）
 *
 * 修复前代码（line 1264-1266）：
 *   // 调账分录：借「应交税费」减少负债，贷「所得税费用」(红字冲减利润，使当期税更低)
 *   const entries = [
 *     ...mk('应交税费', cut, '所得税费用', cut, '调账：调减本期应纳税额（违规）'),
 *   ]
 *
 * 修复前症状：
 *   1. 贷记"所得税费用"，而"所得税费用"在 PNL_KEEP_BALANCE_SUBJECTS 保护清单中永不清零
 *      → 跨月累积挂账破坏恒等式
 *   2. 恶意调账并未让应交税费得到合理结转
 *
 * 修复后断言：
 *   贷记改走"本年利润"，让应交税费余额真实下降，当月损益正常结转。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCompany, evilTaxAdjust, sumAccount } from '../lib/engine.js'

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

test('#5 evilTaxAdjust 应交税费应下降且本年利润同幅上升（调减冲回费用）', () => {
  const s = createCompany('tech', 'easy')
  s.balances['应交税费-所得税'] = 50
  s.balances['本年利润'] = 100
  s.balances['银行存款'] = 300
  s.balances['实收资本'] = 150

  const beforeTaxDue = sumAccount(s.balances, '应交税费')
  const beforeProfit = s.balances['本年利润']

  evilTaxAdjust(s, 0.5)   // due=50 => cut=25

  const afterTaxDue = sumAccount(s.balances, '应交税费')
  const afterProfit = s.balances['本年利润']

  // Fix1: 应交税费减少（借 应交税费）
  assert.strictEqual(afterTaxDue, beforeTaxDue - 25,
    `应交税费应减少 25 → before=${beforeTaxDue}, after=${afterTaxDue}`)

  // Fix2: 修复后贷记本年利润（而非"所得税费用"贷方余额累积）
  // 调减应纳税额 = 冲回费用，利润应同幅上升（100→125）
  assert.strictEqual(afterProfit, beforeProfit + 25,
    `本年利润应增加 25（调减冲回费用）→ before=${beforeProfit}, after=${afterProfit}`)

  // Fix3: "所得税费用"不应出现贷方负数（保护清单内会累积）
  const taxExp = sumAccount(s.balances, '所得税费用')
  assert.ok(taxExp >= 0,
    `Bug 复现：所得税费用不应被贷记（贷方余额会跨月累积）→ 实际 ${taxExp}`)
})

test('#5 evilTaxAdjust 会计分录本身应平衡', () => {
  const s = createCompany('tech', 'easy')
  s.balances['应交税费-所得税'] = 50
  s.balances['本年利润'] = 100
  s.balances['银行存款'] = 300
  s.balances['实收资本'] = 150

  evilTaxAdjust(s, 0.5)
  assertBalanced(s, '#5 evilTaxAdjust 后')
})
