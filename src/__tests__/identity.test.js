/**
 * engine.js 会计恒等式「全账本回放」测试
 * 运行: node --test src/__tests__/identity.test.js
 *
 * 设计原则（针对上一版"浅测试"的修正）：
 *   1. 不再只测初始状态/单步操作，而是模拟完整经营回放；
 *   2. 引擎只在 monthEnd 结转损益至「本年利润」后恒等式平衡，
 *      因此恒等式断言只在 monthEnd 后进行；
 *   3. 针对账务方向可能被颠倒的科目，额外断言其余额符号/递增/递减。
 *
 * 覆盖会真正打破恒等式的场景：
 *   - IPO 溢价方向为正
 *   - SaaS/会员合同负债逐月递减
 *   - 坏账准备为正（备抵资产）
 *   - 工厂库存不为负且等于累计进货-累计销售成本
 *   - 分红记录 dividendPaid 供现金流勾稽
 *
 * 恒等式：资产 = 负债 + 权益
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
    g('研发支出')
  ).toFixed(2)
}

// ─── 负债 + 权益合计（与 buildReports 口径一致；sumAccount 已含子科目，勿重复加） ─
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

    E.monthEnd(s) // ← 结转损益后才是真正的恒等式时点
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

// ─── 场景 3：科技公司 SaaS 合同负债逐月递减 ──────────────────────────────
test('replay 3: tech SaaS contract liability amortizes monthly', () => {
  const s = E.createCompany('tech', 'easy', 'saas')
  E.applyFunding(s, 'part')

  const total = 12 // SaaS 年费预收 12 万
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
    E.monthEnd(s) // ← monthEnd 末尾已自动调用 deferContractLiabilities，无需再单独调
    const cur = +(s.balances[SAAS] || 0).toFixed(2)
    assert.ok(cur < prev, `SaaS 第 ${m} 月合同负债应递减：${prev} → ${cur}`)
    assertBalanced(s, `SaaS 第 ${m} 月递延后`)
    prev = cur
  }
  assert.ok(Math.abs((before - prev) - 3) < 0.05, `3 个月应确认 3 万收入，实际递减 ${+(before - prev).toFixed(2)}`)
})

// ─── 场景 4：贸易公司坏账准备方向正确 ────────────────────────────────────
test('replay 4: trade bad-debt provision is positive (contra-asset)', () => {
  const s = E.createCompany('trade', 'easy')
  E.applyFunding(s, 'part')

  E.applyBusiness(s, [
    { side: 'debit', account: '应收账款', amount: 50 },
    { side: 'credit', account: '主营业务收入', amount: 50 },
  ], '赊销', 1)
  E.applyBusiness(s, [
    { side: 'debit', account: '信用减值损失', amount: 5 },
    { side: 'credit', account: '坏账准备', amount: 5 },
  ], '计提坏账', 1)

  const prov = +(s.balances['坏账准备'] || 0).toFixed(2)
  assert.ok(prov > 0, `坏账准备（备抵科目）应为正数，实际=${prov}`)

  E.monthEnd(s) // 结转损益后恒等式平衡
  assertBalanced(s, '计提坏账后')
})

// ─── 场景 5：工厂库存不为负，且等于累计进货−累计销售成本 ────────────────
test('replay 5: factory inventory non-negative and consistent (no double posting)', () => {
  const s = E.createCompany('factory', 'easy', 'auto')
  E.applyFunding(s, 'full')

  for (let m = 1; m <= 5; m++) {
    const buy = E.vatOnPurchaseForFactory(s, 20, false)
    E.applyBusiness(s, buy.entries, `采购${m}`, m)
    E.applyBusiness(s, s.co.produce(15), `领料${m}`, m)
    E.applyBusiness(s, s.co.complete(15), `完工${m}`, m)
    const sale = E.vatOnSale(s, 25, s.co.revenueAccount)
    E.applyBusiness(s, sale.entries, `销售${m}`, m)
    E.applyBusiness(s, s.co.costOfSale(12), `结转成本${m}`, m)
    E.monthEnd(s)
    assertBalanced(s, `工厂第 ${m} 月末`)
  }

  const inv = +(s.balances['库存商品'] || 0).toFixed(2)
  const raw = +(s.balances['原材料'] || 0).toFixed(2)
  assert.ok(inv >= 0, `库存商品不得为负，实际=${inv}`)
  assert.ok(raw >= 0, `原材料不得为负，实际=${raw}`)
  // 完工入库 5×15=75，结转成本 5×12=60 → 库存商品应 = 15
  assert.ok(Math.abs(inv - 15) < 0.05, `库存商品应为 15（75−60），实际=${inv}；偏差说明存在双重记账`)
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
