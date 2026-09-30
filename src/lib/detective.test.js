/**
 * 财务侦探玩法 — 单元测试（Node.js node --test 格式）
 */
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'

// 手动 import（ESM 动态导入）
const detective = await import('./detective.js')
const {
  injectError,
  buildRound,
  judge,
  getErrorTypeName,
  getErrorTypeIcon,
  getErrorTypeColor,
} = detective

// 错误类型常量
const ERROR_TYPE = {
  AMOUNT: 'AMOUNT',
  ACCOUNT: 'ACCOUNT',
  DIRECTION: 'DIRECTION',
  CATEGORY: 'CATEGORY',
}

// 基础模板
const BASE_TEMPLATE = {
  id: 'fund',
  title: '收到投资款',
  desc: '投资者投入现金 50 万元',
  level: 1,
  entries: [
    { side: 'debit', account: '银行存款', amount: 50 },
    { side: 'credit', account: '实收资本', amount: 50 },
  ],
}

describe('injectError', () => {
  test('AMOUNT 类型：篡改金额且借贷不平衡', () => {
    let result
    for (let i = 0; i < 20; i++) {
      result = injectError(BASE_TEMPLATE)
      if (result.errorType === ERROR_TYPE.AMOUNT) break
    }
    assert.equal(result.errorType, ERROR_TYPE.AMOUNT)
    assert.ok(result.errorIndex >= 0)
    const original = BASE_TEMPLATE.entries[result.errorIndex].amount
    const modified = result.wrong[result.errorIndex].amount
    assert.notEqual(modified, original)
    // 借贷不平衡
    const d = result.wrong.filter(e => e.side === 'debit').reduce((s, e) => s + e.amount, 0)
    const c = result.wrong.filter(e => e.side === 'credit').reduce((s, e) => s + e.amount, 0)
    assert.ok(Math.abs(d - c) > 0.001)
  })

  test('ACCOUNT 类型：替换科目', () => {
    let result
    for (let i = 0; i < 20; i++) {
      result = injectError(BASE_TEMPLATE)
      if (result.errorType === ERROR_TYPE.ACCOUNT) break
    }
    assert.equal(result.errorType, ERROR_TYPE.ACCOUNT)
    const origAccount = BASE_TEMPLATE.entries[result.errorIndex].account
    const newAccount = result.wrong[result.errorIndex].account
    assert.notEqual(newAccount, origAccount)
  })

  test('DIRECTION 类型：借贷方向颠倒', () => {
    let result
    for (let i = 0; i < 20; i++) {
      result = injectError(BASE_TEMPLATE)
      if (result.errorType === ERROR_TYPE.DIRECTION) break
    }
    assert.equal(result.errorType, ERROR_TYPE.DIRECTION)
    assert.equal(result.errorIndex, -1)
    // 借方数量应等于原贷方数量
    const originalDebit = BASE_TEMPLATE.entries.filter(e => e.side === 'debit').length
    const newDebit = result.wrong.filter(e => e.side === 'debit').length
    assert.equal(newDebit, BASE_TEMPLATE.entries.length - originalDebit)
  })

  test('CATEGORY 类型：科目类别改变，含提示和解释', () => {
    let result
    for (let i = 0; i < 20; i++) {
      result = injectError(BASE_TEMPLATE)
      if (result.errorType === ERROR_TYPE.CATEGORY) break
    }
    assert.equal(result.errorType, ERROR_TYPE.CATEGORY)
    assert.ok(result.hint)
    assert.ok(result.explanation)
  })
})

describe('buildRound', () => {
  test('生成指定数量的题目', () => {
    const round = buildRound(3)
    assert.equal(round.length, 3)
  })

  test('每题包含完整字段', () => {
    const round = buildRound(1)
    const item = round[0]
    assert.ok(item.template)
    assert.ok(Array.isArray(item.wrong))
    assert.equal(item.wrong.length, 2)
    assert.ok(item.errorType)
    assert.ok(item.hint)
    assert.equal(item.options.length, 3)
  })

  test('3 个选项中只有 1 个 isCorrect', () => {
    const round = buildRound(5)
    round.forEach((item) => {
      const correctCount = item.options.filter(o => o.isCorrect).length
      assert.equal(correctCount, 1)
    })
  })
})

describe('judge', () => {
  test('正确标记 + 正确选项 → correct=true', () => {
    const round = buildRound(1)
    const puzzle = round[0]
    const correctOpt = puzzle.options.find(o => o.isCorrect)

    // 计算需要标记的 displayIndex
    let expectedMarks
    if (puzzle.errorIndex >= 0) {
      const found = puzzle.wrong.find(e => e.orig === puzzle.errorIndex)
      expectedMarks = found ? [found.displayIndex] : []
    } else {
      expectedMarks = puzzle.wrong.map(e => e.displayIndex)
    }

    const result = judge(puzzle, expectedMarks, correctOpt.id)
    assert.equal(result.correct, true)
    assert.equal(result.marks, true)
    assert.equal(result.fixed, true)
  })

  test('错选方案 → fixed=false', () => {
    const round = buildRound(1)
    const puzzle = round[0]
    const wrongOpt = puzzle.options.find(o => !o.isCorrect)

    let expectedMarks
    if (puzzle.errorIndex >= 0) {
      const found = puzzle.wrong.find(e => e.orig === puzzle.errorIndex)
      expectedMarks = found ? [found.displayIndex] : []
    } else {
      expectedMarks = puzzle.wrong.map(e => e.displayIndex)
    }

    const result = judge(puzzle, expectedMarks, wrongOpt.id)
    assert.equal(result.fixed, false)
    assert.equal(result.correct, false)
  })
})

describe('getErrorType helpers', () => {
  test('getErrorTypeName 返回正确中文名', () => {
    assert.equal(getErrorTypeName(ERROR_TYPE.AMOUNT), '金额错误')
    assert.equal(getErrorTypeName(ERROR_TYPE.ACCOUNT), '科目错误')
    assert.equal(getErrorTypeName(ERROR_TYPE.DIRECTION), '借贷方向错误')
    assert.equal(getErrorTypeName(ERROR_TYPE.CATEGORY), '科目归类错误')
  })

  test('getErrorTypeIcon 返回正确图标', () => {
    assert.equal(getErrorTypeIcon(ERROR_TYPE.AMOUNT), '💰')
    assert.equal(getErrorTypeIcon(ERROR_TYPE.ACCOUNT), '📋')
    assert.equal(getErrorTypeIcon(ERROR_TYPE.DIRECTION), '↔️')
    assert.equal(getErrorTypeIcon(ERROR_TYPE.CATEGORY), '📁')
  })

  test('getErrorTypeColor 返回正确颜色', () => {
    assert.equal(getErrorTypeColor(ERROR_TYPE.AMOUNT), '#e74c3c')
    assert.equal(getErrorTypeColor(ERROR_TYPE.ACCOUNT), '#3498db')
  })
})
