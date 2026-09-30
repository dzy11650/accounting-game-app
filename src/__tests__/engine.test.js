/**
 * engine.js 单元测试（纯 node，用内置 assert）
 * 运行: node --test src/__tests__/engine.test.js
 */
import test from 'node:test'
import assert from 'node:assert/strict'
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null }, setItem(k, v) { this._d[k] = v }, removeItem(k) { delete this._d[k] } }
const E = await import('../lib/engine.js')

test('createCompany initializes state', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  assert.equal(s.co.id, 'shop')
  assert.equal(s.projectId, 'milktea')
  assert.equal(s.lives, 3)
  assert.equal(s.balances['银行存款'], 0)
  assert.equal(s.month, 0)
})

test('applyFunding part: own 20 + borrow 30%', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'part')
  assert.equal(s.balances['实收资本'], 20)
  assert.equal(s.balances['短期借款'], 6)
  assert.equal(s.balances['银行存款'], 26)
  assert.equal(s.scale, 1.3)
})

test('applyFunding full: no borrow', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  assert.equal(s.balances['短期借款'], 0)
  assert.equal(s.balances['银行存款'], 20)
})

test('applyFunding low: 70% borrow', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'low')
  assert.equal(s.balances['短期借款'], 14)
  assert.equal(s.balances['银行存款'], 34)
  assert.equal(s.scale, 1.7)
})

test('vatOnSale: small tax = 3%', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyTaxType(s, 'small')
  const r = E.vatOnSale(s, 10, s.co.revenueAccount)
  assert.equal(r.vat, 0.3)
  assert.equal(s.vatOutput, 0.3)
  assert.equal(s.cumSales, 10)
})

test('vatOnSale: general tax = 13%', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyTaxType(s, 'general')
  const r = E.vatOnSale(s, 10, s.co.revenueAccount)
  assert.equal(r.vat, 1.3)
})

test('vatOnPurchase: general input tax = 13%', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyTaxType(s, 'general')
  const r = E.vatOnPurchase(s, 10, false)
  assert.equal(r.vat, 1.3)
  assert.equal(s.vatInput, 1.3)
})

test('vatOnPurchase: small no input tax', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyTaxType(s, 'small')
  const r = E.vatOnPurchase(s, 10, false)
  assert.equal(r.vat, 0)
})

test('maybeForceGeneral: cumSales > 500 forces general', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyTaxType(s, 'small')
  s.cumSales = 600
  const forced = E.maybeForceGeneral(s)
  assert.equal(forced, true)
  assert.equal(s.taxType, 'general')
  assert.equal(s.forcedGeneral, true)
})

test('maybeForceGeneral: no force when below threshold', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyTaxType(s, 'small')
  s.cumSales = 400
  assert.equal(E.maybeForceGeneral(s), false)
})

test('gradeEntries: identical = true', () => {
  const list = [
    { side: 'debit', account: '银行存款', amount: 10 },
    { side: 'credit', account: '主营业务收入', amount: 10 },
  ]
  assert.equal(E.gradeEntries(list, list), true)
})

test('gradeEntries: different order = true (normalizes)', () => {
  const a = [
    { side: 'credit', account: '主营业务收入', amount: 10 },
    { side: 'debit', account: '银行存款', amount: 10 },
  ]
  const b = [
    { side: 'debit', account: '银行存款', amount: 10 },
    { side: 'credit', account: '主营业务收入', amount: 10 },
  ]
  assert.equal(E.gradeEntries(a, b), true)
})

test('gradeEntries: different amount = false', () => {
  const a = [{ side: 'debit', account: '银行存款', amount: 10 }]
  const b = [{ side: 'debit', account: '银行存款', amount: 11 }]
  assert.equal(E.gradeEntries(a, b), false)
})

test('gradeEntries: length mismatch = false', () => {
  assert.equal(E.gradeEntries([], []), true)
  assert.equal(E.gradeEntries([], [{ side: 'debit', account: 'x', amount: 1 }]), false)
})

test('isBankrupt: negative cash = bankrupt', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  s.balances['银行存款'] = -1
  assert.equal(E.isBankrupt(s), true)
})

test('isBankrupt: positive cash = ok', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  assert.equal(E.isBankrupt(s), false)
})

test('buildReports: three statements generated', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  const sale = E.vatOnSale(s, 3, s.co.revenueAccount)
  E.applyBusiness(s, sale.entries, '卖货', 1)
  E.applyBusiness(s, s.co.costOfSale(1.2), '结转成本', 1)
  E.monthEnd(s)
  E.settleTax(s)
  const r = E.buildReports(s)
  assert.equal(r.balance.type, 'balance')
  assert.equal(r.income.type, 'income')
  assert.ok(r.cashflow)
})

test('monthEnd: depreciation and interest entries', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'part') // has loan
  const before = s.ledger.length
  E.monthEnd(s)
  const dep = s.ledger.slice(before).filter((l) => l.desc.includes('折旧'))
  const int = s.ledger.slice(before).filter((l) => l.desc.includes('利息'))
  assert.ok(dep.length >= 1, 'depreciation entry exists')
  assert.ok(int.length >= 1, 'interest entry exists')
})

test('settleTax: small pays VAT only (no input)', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  E.applyTaxType(s, 'small')
  const sale = E.vatOnSale(s, 10, s.co.revenueAccount)
  E.applyBusiness(s, sale.entries, '卖货', 1)
  const r = E.settleTax(s)
  assert.equal(r.vatPayable, 0.3)
})

test('declareDividend: no profit = rejected', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  const r = E.declareDividend(s, 0.3)
  assert.equal(r.ok, false)
})

test('evilSalary: raises discontent and evilCount', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  E.applyFunding(s, 'full')
  const before = s.evilCount
  const msg = E.evilSalary(s)
  assert.equal(s.evilCount, before + 1)
  assert.ok(s.wageUnpaid > 0)
  assert.ok(typeof msg === 'string' && msg.length > 0)
})

test('evilTaxOwe: accumulates taxOwed', () => {
  const s = E.createCompany('shop', 'hard', 'milktea')
  E.applyFunding(s, 'full')
  // 先产生一笔应交税费（卖货形成销项税），否则无税可拖
  const sale = E.vatOnSale(s, 10, s.co.revenueAccount)
  E.applyBusiness(s, sale.entries, '卖货', 1)
  const msg = E.evilTaxOwe(s)
  assert.ok(s.taxOwed > 0)
  assert.equal(s.evilCount, 1)
  assert.equal(s.skippedTaxMonths, 1)
  assert.ok(typeof msg === 'string' && msg.includes('拖欠'))
})

test('scoreMetrics + overallStars produce numbers', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  const sale = E.vatOnSale(s, 5, s.co.revenueAccount)
  E.applyBusiness(s, sale.entries, '卖货', 1)
  E.applyBusiness(s, s.co.costOfSale(2), '结转成本', 1)
  E.monthEnd(s)
  const scores = E.scoreMetrics(s)
  assert.ok(scores.profit >= 0 && scores.profit <= 100)
  assert.ok(scores.cash >= 0 && scores.cash <= 100)
  const stars = E.overallStars(scores)
  assert.ok(stars >= 0 && stars <= 3)
})

test('DIFFICULTY econ multipliers exist', () => {
  assert.equal(E.DIFFICULTY.easy.lives, 3)
  assert.equal(E.DIFFICULTY.hard.lives, 1)
  assert.equal(E.DIFFICULTY.hardcore.lives, 0)
  assert.ok(E.DIFFICULTY.hardcore.econ.costMult > E.DIFFICULTY.easy.econ.costMult)
})

test('TAX constants', () => {
  assert.equal(E.TAX.VAT_SMALL, 0.03)
  assert.equal(E.TAX.VAT_GENERAL, 0.13)
  assert.equal(E.TAX.CIT, 0.25)
  assert.equal(E.TAX.FORCE_THRESHOLD, 500)
})
