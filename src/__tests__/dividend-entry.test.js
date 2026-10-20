/**
 * #1 declareDividend 分录错误 — 复现测试
 *
 * 根因（修复前）：
 *   entries = [
 *     ...mk('应付股利', div, '银行存款', div, ...),          // 借应付股利/贷银行 div
 *     ...mk('利润分配-应付股利', div, '应付股利', div, ...),  // 借利润分配/贷应付股利 div
 *     ...mk('应交税费-个人所得税', divTax, '银行存款', divTax, ...), // 借应交税费/贷银行 divTax
 *   ]
 *   问题：① 银行存款被贷记 div + divTax（现金总流出 = div + divTax，多扣了个税）；
 *        ② 「应交税费-个人所得税」只借记从不贷记 → 余额永久为 -divTax（负负债）；
 *        ③ 中间多出一个「应付股利」过渡科目，与 special_dividend 口径不一致。
 *
 * 正确结构（参照 special_dividend）：
 *   借 利润分配-应付股利 div / 贷 银行存款 net / 贷 应交税费-个人所得税 tax
 *   其中 net = div - tax，公司现金总流出 = net（个税由股东承担，代扣后上缴，不从利润另扣）。
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { createCompany, declareDividend, sumAccount } from '../lib/engine.js'

function setup() {
  const s = createCompany('listed', 'easy')
  s.balances['本年利润'] = 100
  s.balances['银行存款'] = 200
  s.balances['库存现金'] = 0
  return s
}

test('#1 declareDividend：现金总流出应等于 net（div-tax），不应是 div+divTax', () => {
  const s = setup()
  const cashBefore = s.balances['银行存款']
  const r = declareDividend(s, 0.3) // div=30, tax=6, net=24
  assert.strictEqual(r.ok, true)
  const cashAfter = s.balances['银行存款']
  const outflow = +(cashBefore - cashAfter).toFixed(2)
  assert.strictEqual(outflow, 24, `现金流出应为 net=24，实际 ${outflow}（若为 36 则是 div+divTax 的旧 Bug）`)
})

test('#1 declareDividend：应交税费-个人所得税应为正余额（贷记），不得为负', () => {
  const s = setup()
  declareDividend(s, 0.3)
  const pit = sumAccount(s.balances, '应交税费-个人所得税')
  assert.ok(pit >= 0, `应交税费-个人所得税余额不应为负，实际 ${pit}`)
  assert.strictEqual(+pit.toFixed(2), 6, `代扣个税应为 +6（贷记），实际 ${pit}`)
})

test('#1 declareDividend：利润分配-应付股利应借记 div，且无遗留「应付股利」过渡科目', () => {
  const s = setup()
  declareDividend(s, 0.3)
  const dist = sumAccount(s.balances, '利润分配-应付股利')
  assert.strictEqual(+dist.toFixed(2), 30, `利润分配应借记 30，实际 ${dist}`)
  const apDiv = sumAccount(s.balances, '应付股利')
  assert.strictEqual(+apDiv.toFixed(2), 0, `不应残留「应付股利」过渡科目余额，实际 ${apDiv}`)
})

test('#1 declareDividend：分录借贷平衡（applyBusiness 内部已校验）', () => {
  const s = setup()
  // 只要调用不抛错，就说明 applyBusiness 内部 assertBalanced 已通过
  assert.doesNotThrow(() => declareDividend(s, 0.3))
})
