/**
 * #16 罢工弹窗必崩 — 复现测试
 *
 * 根因：Game.jsx 中 runSpecial 的签名是 (s, a) => {...}（两个参数），
 * 但罢工弹窗 onResolve 回调写成 runSpecial({ type: 'resolveStrike', option })（只传一个参数）。
 * 于是 s = {type,option}，a = undefined，函数体内 a.type 抛 TypeError: Cannot read properties of undefined。
 *
 * 本测试用「与 Game.jsx 相同签名的桩函数」复现该调用约定错误，
 * 并断言修复后的调用约定（runSpecial(s, a)）能正常工作。
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { createCompany, resolveStrike } from '../lib/engine.js'

// 与 Game.jsx runSpecial 完全一致的签名：(s, a) => {...}
function runSpecialStub(s, a) {
  if (a.type === 'resolveStrike') {
    const msg = resolveStrike(s, a.option)
    return { handled: true, msg }
  }
  return { handled: false }
}

test('#16 罢工弹窗：错误调用约定 runSpecial({...}) 只传一个参数会抛 TypeError', () => {
  const s = createCompany('shop', 'easy')
  s.wageUnpaid = 5
  s.wageDiscontent = 60
  s.balances['银行存款'] = 50

  // 复现 Bug：只传一个参数（当前 Game.jsx:917 的写法）
  assert.throws(
    () => runSpecialStub({ type: 'resolveStrike', option: 'full' }),
    /Cannot read properties of undefined|undefined/,
    '错误调用约定应当抛错——这正是线上崩溃的原因',
  )
})

test('#16 罢工弹窗：正确调用约定 runSpecial(s, {...}) 应正常结算罢工', () => {
  const s = createCompany('shop', 'easy')
  s.wageUnpaid = 5
  s.wageDiscontent = 60
  s.balances['银行存款'] = 50

  // 修复后的调用约定
  const r = runSpecialStub(s, { type: 'resolveStrike', option: 'full' })
  assert.strictEqual(r.handled, true, '应被 runSpecial 处理')
  assert.ok(typeof r.msg === 'string' && r.msg.length > 0, '应返回提示文案')
  assert.strictEqual(s.wageUnpaid, 0, '全额补发后欠薪应结清')
  assert.strictEqual(s.wageDiscontent, 0, '全额补发后不满度应清零')
})
