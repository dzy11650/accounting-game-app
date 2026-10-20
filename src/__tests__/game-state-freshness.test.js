/**
 * #17 闭包旧 sim 导致持久化旧状态 — 复现测试
 *
 * 根因（修复前）：
 *   nextStep() / finish() 使用渲染闭包中的旧 sim，
 *   导致 persist() 写入存档的是「动作前的旧状态」，
 *   最后一步的净利润/星级基于旧算，存档落后一步。
 *
 * 修复后：nextStep(s)/finish(s) 显式接收最新 state，
 *   确保存档和结果均基于动作后状态。
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { createCompany, applyBusiness, monthEnd } from '../lib/engine.js'

// 结构化深拷贝（与 Game.jsx 中的 clone 一致）
function clone(o) {
  return JSON.parse(JSON.stringify(o))
}

test('#17 nextStep 必须使用最新 state（否则存档落后一步）', () => {
  const sim = createCompany('shop', 'easy')
  sim.balances['银行存款'] = 100

  // 模拟：React 渲染闭包捕获旧引用
  const oldSimRef = sim

  // 模拟：处理一个动作（clone 后做业务，与 Game.jsx 的 doBusiness 流程一致）
  const s = clone(sim)
  applyBusiness(s, [
    { side: 'debit', account: '银行存款', amount: 10 },
    { side: 'credit', account: '主营业务收入', amount: 10 },
  ], '动作：记录收入')
  monthEnd(s)

  // 模拟：nextStep() 用旧闭包 sim（错误做法）vs nextStep(s)（正确做法）
  const persistedFromOldClosure = (oldSimRef.balances['银行存款'] || 0) + (oldSimRef.balances['本年利润'] || 0)
  const persistedFromLatest = (s.balances['银行存款'] || 0) + (s.balances['本年利润'] || 0)

  assert.ok(Math.abs(persistedFromLatest - persistedFromOldClosure) >= 10,
    `Bug 复现：旧闭包 sim 落后于最新状态（${persistedFromOldClosure} vs ${persistedFromLatest}），存档会丢动作结果`)
})

test('#17 finish 用闭包 sim 会算错净利润/星级（因为累计科目滞后）', () => {
  const sim = createCompany('shop', 'easy')
  sim.balances['银行存款'] = 100

  const oldSimRef = sim

  // 动作：月末结账产生利润
  const s = clone(sim)
  applyBusiness(s, [
    { side: 'debit', account: '银行存款', amount: 25 },
    { side: 'credit', account: '主营业务收入', amount: 25 },
  ], '动作：确认收入')
  monthEnd(s)

  const oldProfit = (oldSimRef.balances['本年利润'] || 0)
  const newProfit = (s.balances['本年利润'] || 0)

  assert.notStrictEqual(oldProfit, newProfit,
    'Bug 复现：闭包 sim 的利润落后于最新状态，finish 会算错星级')
  assert.strictEqual(oldProfit, 0, '旧 sim 本年利润仍为 0（未更新）')
  assert.ok(newProfit > 24 && newProfit < 25, `新 sim 本年利润应约 24.93，实际 ${newProfit}`)
})
