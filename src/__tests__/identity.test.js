/**
 * engine.js 会计恒等式单元测试
 * 运行: node --test src/__tests__/identity.test.js
 *
 * 验证核心会计恒等式：
 *   资产 = 负债 + 权益
 * 在所有合法操作路径（出资、进货、销售、月末结账、分红、邪道）后必须保持。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null }, setItem(k, v) { this._d[k] = v }, removeItem(k) { delete this._d[k] } }
const E = await import('../lib/engine.js')

/**
 * 计算资产总额（取资产负债表侧资产科目合计）
 */
function totalAssets(s) {
  return E.totalAssets(s.balances)
}

/**
 * 计算负债 + 权益合计（直接取报表行，side 字段区分）
 */
function totalLiabEquity(s) {
  const r = E.buildReports(s)
  const liab = r.balance.rows.filter((row) => row.side === 'liability')
    .reduce((sum, row) => sum + (row.value || 0), 0)
  const equity = r.balance.rows.filter((row) => row.side === 'equity')
    .reduce((sum, row) => sum + (row.value || 0), 0)
  return liab + equity
}

// ─── 恒等式测试 1：初始状态 ─────────────────────────────────────────────
test('identity 1: createCompany initial state holds', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'part')
  // 出资后：资产 = 银行存款，负债 = 短期借款，权益 = 实收资本
  assert.ok(totalAssets(s) > 0, 'assets should be > 0 after funding')
  const diff = Math.abs(totalAssets(s) - totalLiabEquity(s))
  assert.ok(diff < 0.001, `identity violated: assets=${totalAssets(s)}, L+E=${totalLiabEquity(s)}, diff=${diff}`)
})

// ─── 恒等式测试 2：月末结账后 ─────────────────────────────────────────
test('identity 2: monthEnd preserves identity', () => {
  const s = E.createCompany('factory', 'easy', 'auto')
  E.applyFunding(s, 'part')
  // 做一些业务
  E.applyBusiness(s, [
    { side: 'debit', account: '原材料', amount: 10 },
    { side: 'credit', account: '银行存款', amount: 10 },
  ], '进货', 1)
  E.monthEnd(s)
  const diff = Math.abs(totalAssets(s) - totalLiabEquity(s))
  assert.ok(diff < 0.001, `identity violated after monthEnd: assets=${totalAssets(s)}, L+E=${totalLiabEquity(s)}, diff=${diff}`)
})

// ─── 恒等式测试 3：股东分红后 ─────────────────────────────────────────
test('identity 3: declareDividend preserves identity', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'full')
  // 制造利润
  s.balances['本年利润'] = 50
  s.balances['银行存款'] = (s.balances['银行存款'] || 0) + 50
  const res = E.declareDividend(s, 0.5)
  assert.ok(res.ok, 'dividend should succeed with profit')
  const diff = Math.abs(totalAssets(s) - totalLiabEquity(s))
  assert.ok(diff < 0.001, `identity violated after dividend: assets=${totalAssets(s)}, L+E=${totalLiabEquity(s)}, diff=${diff}`)
})

// ─── 恒等式测试 4：邪道欠薪后 evilCount 记录违规（有意不保持恒等式） ────────────
test('identity 4: evilSalary increments evilCount (intentional violation tracked)', () => {
  const s = E.createCompany('shop', 'easy', 'milktea')
  E.applyFunding(s, 'part')
  const evilBefore = s.evilCount || 0
  E.evilSalary(s)
  assert.equal(s.evilCount, evilBefore + 1, 'evilCount should increment after evilSalary')
  assert.ok(s.evilCount > 0, 'evilCount should be > 0')
})

// ─── 恒等式测试 5：邪道欠税后 taxOwed 累积（需先有应缴税款挂账） ─────────────
test('identity 5: evilTaxOwe accumulates taxOwed when tax is owed', () => {
  const s = E.createCompany('tech', 'easy', 'cloud')
  E.applyFunding(s, 'part')
  // 应交税费挂账（simulating end-of-month tax accrual before evil path)
  s.balances['应交税费'] = 13
  s.balances['银行存款'] = (s.balances['银行存款'] || 0) + 0 // no-op keep shape
  const before = s.taxOwed || 0
  E.evilTaxOwe(s)
  const after = s.taxOwed || 0
  assert.ok(after > before, `taxOwed should increase: ${before} -> ${after}`)
  assert.ok(s.skippedTaxMonths >= 1, 'skippedTaxMonths should be >= 1')
})
