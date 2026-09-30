import test from 'node:test'
import assert from 'node:assert/strict'
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]} }
const E = await import('../lib/engine.js')

test('DuPont inputs: profit/turnover/multiplier computable from state', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  const sale = E.vatOnSale(s, 10, s.co.revenueAccount)
  E.applyBusiness(s, sale.entries, '卖货', 1)
  E.applyBusiness(s, s.co.costOfSale(4), '结转成本', 1)
  E.monthEnd(s)

  const assets = E.totalAssets(s.balances)
  const debt = E.liabilityTotal(s)
  const netProfit = s.balances['本年利润'] != null ? s.balances['本年利润'] : 0
  // 模拟 DuPontChart 内计算
  const revenue = Math.max(0.01, s.cumSales || 0.01)
  const profitMargin = Math.max(-100, Math.min(100, +((netProfit / revenue) * 100).toFixed(1)))
  const turnover = Math.max(0, +(revenue / assets).toFixed(2))
  const multiplier = +(assets / Math.max(0.01, assets - debt)).toFixed(2)

  assert.ok(profitMargin >= -100 && profitMargin <= 100)
  assert.ok(turnover >= 0)
  assert.ok(multiplier >= 1, 'equity < assets so multiplier >= 1')
})
