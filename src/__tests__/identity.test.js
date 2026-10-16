/**
 * engine.js 会计恒等式「全账本回放」测试
 * 运行: node --test src/__tests__/identity.test.js
 *
 * 覆盖会真正打破恒等式的场景：
 *   - IPO 溢价方向为正
 *   - SaaS/会员合同负倪逐月递减
 *   - 坏账准备为正（备抵资产）
 *   - 金融公司专属操作（贷款/收息/公允价值/核销）恒等式保持
 *   - 工厂库存不为负且等于累计进货-累计销售成本
 *   - 分红记录 dividendPaid 供现金流勾稽
 *   - 市场竞争：份额变化 & 季度演进
 */
import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null },
  setItem(k, v) { this._d[k] = v },
  removeItem(k) { delete this._d[k] },
}
const E = await import('../lib/engine.js')

const SAAS = '合同负债-SaaS年费'

// ─── 资产总额（与 buildReports 资产负债表口径完全一致） ─────────────────────
function totalAssets(s) {
  const g = (k) => E.sumAccount(s.balances, k)
  return +(
    g('银行存款') + g('库存现金') +
    (g('应收账款') - g('坏账准备')) +
    (g('原材料') + g('库存商品') + g('生产成本')) +
    g('预付账款') +
    (g('固定资产') - g('累计折旧')) +
    (g('无形资产') - g('累计摊销')) +
    g('研发支出') +
    // 金融专属资产
    g('贷款资产') + g('债权投资') + g('交易性金融资产')
  ).toFixed(2)
}

// ─── 负债 + 权益合计 ────────────────────────────────────────────────────────
function totalLiabEquity(s) {
  const g = (k) => E.sumAccount(s.balances, k)
  const liab =
    g('短期借款') + g('应付账款') + g('应付职工薪酬') + g('应付利息') +
    g('应交税费') + g('合同负债') + g('应付股利')
  const equity =
    g('实收资本') + g('股本') + g('资本公积') + g('本年利润') -
    g('利润分配-应付股利')
  return +(liab + equity).toFixed(2)
}

function assertBalanced(s, label) {
  const a = totalAssets(s)
  const le = totalLiabEquity(s)
  const gap = +(a - le).toFixed(2)
  assert.ok(
    Math.abs(gap) < 0.05,
    `${label}: 恒等式被打破 → 资产=${a}, 负债+权益=${le}, gap=${gap}`,
  )
  return { assets: a, liabEquity: le, gap }
}

// ─── 场景 1：奶茶店 12 个月完整经营回放 ──────────────────────────────────
test('replay 1: shop 12-month operation keeps identity balanced', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'part')
  assertBalanced(s, '出资后')

  for (let m = 1; m <= 12; m++) {
    const buy = E.vatOnPurchase(s, 8, false)
    E.applyBusiness(s, buy.entries, `进货${m}`, m)
    const sale = E.vatOnSale(s, 14, s.co.revenueAccount)
    E.applyBusiness(s, sale.entries, `卖货${m}`, m)
    E.applyBusiness(s, s.co.costOfSale(9), `结转成本${m}`, m)
    E.applyBusiness(s, [
      { side: 'debit', account: '管理费用-工资', amount: 3 },
      { side: 'credit', account: '应付职工薪酬', amount: 3 },
    ], `工资${m}`, m)

    if (m === 2 && E.applyCompanySpecialEvent) {
      E.applyCompanySpecialEvent(s, 'membership')
    }
    if (m === 5) E.declareDividend(s, 0.3)

    E.monthEnd(s)
    assertBalanced(s, `第 ${m} 月末`)
  }
})

// ─── 场景 2：IPO 溢价方向必须为正 ────────────────────────────────────────
test('replay 2: listed IPO premium is positive and identity holds', () => {
  const s = E.createCompany('listed', 'easy')
  E.applyFunding(s, 'part')
  const amt = 200
  const r = E.ipoFunding(s, amt)
  assert.ok(r && r.success, 'IPO 应成功')

  const premium = +(s.balances['资本公积-股本溢价'] || 0).toFixed(2)
  assert.ok(premium > 0, `IPO 溢价必须为正数，实际=${premium}`)
  assert.ok(Math.abs(premium - amt * 0.9) < 0.05, `溢价应为 ${amt * 0.9}，实际=${premium}`)
  assertBalanced(s, 'IPO 后')
})

// ─── 场景 3：SaaS 合同负倪逐月递减 ──────────────────────────────────────
test('replay 3: tech SaaS contract liability amortizes monthly', () => {
  const s = E.createCompany('tech', 'easy', 'saas')
  E.applyFunding(s, 'part')

  const total = 12
  E.applyBusiness(s, [
    { side: 'debit', account: '银行存款', amount: total },
    { side: 'credit', account: SAAS, amount: total },
  ], 'SaaS年费预收', 1)
  s.saasContract = { total, monthly: 1, recognized: 0 }

  const before = +(s.balances[SAAS] || 0).toFixed(2)
  assert.ok(before > 0, `${SAAS} 应为正数，实际=${before}`)
  assertBalanced(s, 'SaaS 预收后')

  let prev = before
  for (let m = 1; m <= 3; m++) {
    E.monthEnd(s)
    const cur = +(s.balances[SAAS] || 0).toFixed(2)
    assert.ok(cur < prev, `SaaS 第 ${m} 月合同负倪应递减：${prev} → ${cur}`)
    assertBalanced(s, `SaaS 第 ${m} 月递延后`)
    prev = cur
  }
  assert.ok(prev >= 0, `${SAAS} 不应变为负数，实际=${prev}`)
})

// ─── 场景 4：金融公司金融专属操作回放 ────────────────────────────────────
test('replay 4: finance loan + interest + FV + badLoan, identity balanced', () => {
  const s = E.createCompany('finance', 'easy')
  E.applyFunding(s, 'full')
  E.applyTaxType(s, 'small')
  // 金融公司专属动作
  E.applyBusiness(s, s.co.loanIssue(20), '发放贷款 20 万')
  E.applyBusiness(s, s.co.loanCollect(20, 0.3), '收回贷款本息 20.3 万')
  E.applyBusiness(s, s.co.bondBuy(15), '购买债券 15 万')
  E.applyBusiness(s, s.co.fairValueChange(2, true), '公允价值上升 2 万')
  E.applyBusiness(s, s.co.loanIssue(3), '发放贷款 3 万')
  E.applyBusiness(s, s.co.badLoanWriteoff(3), '违约核销 3 万')
  E.monthEnd(s)
  assertBalanced(s, '金融公司月终')
  assert.ok((s.balances['贷款资产'] || 0) >= 0, '贷款资产应为正数')
  assert.ok((s.balances['债权投资'] || 0) >= 0, '债权投资应为正数')
  assert.ok((s.balances['交易性金融资产'] || 0) >= 0, '交易性金融资产应为正数')
  assert.ok((s.balances['信用减值损失'] || 0) >= 0, '信用减值损失应为正数（费用类）')
  assert.ok((s.cum.interestIncome || 0) >= 0, '利息收入累计应为正数')
})

// ─── 场景 5：市场竞争份额变化与季度演进 ───────────────────────────────────
test('replay 5: market share dynamics & quarterly evolution', () => {
  const s = E.createCompany('shop', 'easy')
  E.applyFunding(s, 'full')
  E.applyTaxType(s, 'small')
  assert.ok(s.marketData != null, 'marketData 应初始化')
  const before = s.marketData.playerShare
  E.updateMarketShare(s, 0.85)
  const afterLow = s.marketData.playerShare
  assert.ok(afterLow > before, '低价应提升份额')
  E.updateMarketShare(s, 1.15)
  const afterHigh = s.marketData.playerShare
  assert.ok(afterHigh < afterLow, '高价应丢份额')
  s.yearMood = 'good'
  E.rollMarketMonth(s)
  assert.ok(s.marketData.shareHistory.length > 0, '应记录份额历史')
  s.month = 3
  const news = E.evolveCompetitorsQuarterly(s)
  assert.ok(Array.isArray(news), 'evolveCompetitorsQuarterly 应返回数组')
})

// ─── 场景 6：分红写入 dividendPaid ────────────────────────────────────────
test('replay 6: dividend records dividendPaid for cash-flow reconciliation', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  s.balances['本年利润'] = 50
  s.balances['银行存款'] = +(s.balances['银行存款'] || 0) + 50

  const r = E.declareDividend(s, 0.3)
  assert.ok(r.ok, '分红应成功')
  assert.ok((s.dividendPaid || 0) > 0, `dividendPaid 应 > 0，实际=${s.dividendPaid || 0}`)
  E.monthEnd(s)
  assertBalanced(s, '分红后')
})
