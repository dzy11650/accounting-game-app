/**
 * 财务侦探玩法 — 最小可验证版本
 *
 * 数据来源：
 *   src/lib/engine.js 的 applyBusiness() 生成凭证的科目组合（从 teach 字段反推模板）
 *
 * 错误类型：
 *   AMOUNT      - 金额错误（金额翻倍或减半）
 *   ACCOUNT     - 科目错误（替换为形近/类别相近的科目）
 *   DIRECTION   - 借贷方向颠倒
 *   CATEGORY    - 科目归类错误（资产科目与损益科目互换）
 */

import { ERROR_TYPE } from './detective-types.js'

// ============ 分录模板（从 engine.js teach / story.js 反推）============
// 每条模板：[借方条目, 贷方条目]，amount 以万元为单位
const TEMPLATES = [
  {
    id: 'fund',
    title: '收到投资款',
    desc: '投资者投入现金 50 万元，请核查分录是否正确。',
    level: 1,
    entries: [
      { side: 'debit',  account: '银行存款', amount: 50 },
      { side: 'credit', account: '实收资本', amount: 50 },
    ],
  },
  {
    id: 'purchase_credit',
    title: '赊购原材料',
    desc: '购入原材料 10 万元，款项未付，请核查分录是否正确。',
    level: 1,
    entries: [
      { side: 'debit',  account: '原材料', amount: 10 },
      { side: 'credit', account: '应付账款', amount: 10 },
    ],
  },
  {
    id: 'sale_cash',
    title: '销售收款',
    desc: '卖出商品收到货款 8 万元，请核查分录是否正确。',
    level: 1,
    entries: [
      { side: 'debit',  account: '银行存款', amount: 8 },
      { side: 'credit', account: '主营业务收入', amount: 8 },
    ],
  },
  {
    id: 'salary',
    title: '发放工资',
    desc: '支付员工工资 3 万元，请核查分录是否正确。',
    level: 2,
    entries: [
      { side: 'debit',  account: '管理费用-工资', amount: 3 },
      { side: 'credit', account: '库存现金', amount: 3 },
    ],
  },
  {
    id: 'depreciation',
    title: '计提折旧',
    desc: '本月计提固定资产折旧 2 万元，请核查分录是否正确。',
    level: 2,
    entries: [
      { side: 'debit',  account: '管理费用-折旧', amount: 2 },
      { side: 'credit', account: '累计折旧', amount: 2 },
    ],
  },
  {
    id: 'interest',
    title: '计提借款利息',
    desc: '本月计提短期借款利息 0.5 万元，请核查分录是否正确。',
    level: 2,
    entries: [
      { side: 'debit',  account: '财务费用-利息', amount: 0.5 },
      { side: 'credit', account: '应付利息', amount: 0.5 },
    ],
  },
  {
    id: 'pay_tax',
    title: '缴纳税款',
    desc: '实际缴纳企业所得税 5 万元，请核查分录是否正确。',
    level: 3,
    entries: [
      { side: 'debit',  account: '应交税费-应交所得税', amount: 5 },
      { side: 'credit', account: '银行存款', amount: 5 },
    ],
  },
  {
    id: 'collect_receivable',
    title: '收回欠款',
    desc: '收回客户欠款 15 万元，请核查分录是否正确。',
    level: 3,
    entries: [
      { side: 'debit',  account: '银行存款', amount: 15 },
      { side: 'credit', account: '应收账款', amount: 15 },
    ],
  },
]

// ============ 科目替换表（用于注入错误）============
const ACCOUNT_SWAPS = {
  // 资产 ↔ 负债/权益误用
  '银行存款': ['库存现金', '应收账款'],
  '库存现金': ['银行存款', '固定资产'],
  '应收账款': ['应付账款', '预收账款'],
  '原材料': ['库存商品', '固定资产'],
  '库存商品': ['原材料', '管理费用'],
  '固定资产': ['累计折旧', '在建工程'],
  '累计折旧': ['固定资产'],
  '实收资本': ['短期借款', '应付账款'],
  '短期借款': ['实收资本'],
  '应付账款': ['应付职工薪酬', '实收资本'],
  '应付职工薪酬': ['管理费用', '应付账款'],
  '应付利息': ['财务费用', '应交税费'],
  '应交税费': ['所得税费用', '管理费用'],
  '主营业务收入': ['主营业务成本', '库存商品'],
  '主营业务成本': ['主营业务收入', '管理费用'],
  '管理费用': ['财务费用', '研发费用'],
  '财务费用': ['管理费用', '营业外支出'],
}

// ============ 工具函数 ============
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 从模板中随机注入一种错误，返回 { wrongEntries, errorType, errorIndex, hint, explanation }
 * @param template { id, title, desc, level, entries[] }
 * @returns { wrong, errorType, errorIndex, hint, explanation }
 */
export function injectError(template) {
  const types = Object.values(ERROR_TYPE)
  const errorType = types[Math.floor(Math.random() * types.length)]
  const entries = template.entries.map((e) => ({ ...e }))

  let errorIndex = -1
  let hint = ''
  let explanation = ''

  switch (errorType) {
    case ERROR_TYPE.AMOUNT: {
      // 篡改其中一条的金额（翻倍或减半，保留 1 位小数）
      errorIndex = Math.floor(Math.random() * entries.length)
      const factor = Math.random() > 0.5 ? 2 : 0.1
      const original = entries[errorIndex].amount
      entries[errorIndex].amount = +(original * factor).toFixed(1)
      hint = '先做一件最基本的事：借贷两方加起来相等吗？'
      explanation = `原金额为 ${original} 万元，被改为 ${entries[errorIndex].amount} 万元，导致借贷不平衡。`
      break
    }
    case ERROR_TYPE.ACCOUNT: {
      // 篡改其中一个科目（从同类科目中替换）
      errorIndex = Math.floor(Math.random() * entries.length)
      const origAccount = entries[errorIndex].account
      // 优先用精确 key；带 - 后缀的明细科目回退到父科目；再兜底到全表
      const parent = origAccount.split('-')[0]
      const swapList = ACCOUNT_SWAPS[origAccount] || ACCOUNT_SWAPS[parent] || Object.keys(ACCOUNT_SWAPS)
      const newAccount = swapList[Math.floor(Math.random() * swapList.length)]
      if (newAccount !== origAccount) entries[errorIndex].account = newAccount
      hint = `注意核对「${origAccount}」这个科目用得对不对。`
      explanation = `应使用「${origAccount}」，错记成了「${entries[errorIndex].account}」。会计科目有严格的归属类别，不能混用。`
      break
    }
    case ERROR_TYPE.DIRECTION: {
      // 把两条分录的借贷方向都对调
      entries.forEach((e) => {
        e.side = e.side === 'debit' ? 'credit' : 'debit'
      })
      errorIndex = -1 // 两条都错
      hint = '费用增加应该借记还是贷记？现金减少应该借记还是贷记？'
      explanation = '借贷方向完全颠倒，等于把"花钱"记成了"赚钱"，"收入"记成了"支出"。'
      break
    }
    case ERROR_TYPE.CATEGORY: {
      // 把损益类科目替换为同金额但不同类别的科目
      errorIndex = Math.floor(Math.random() * entries.length)
      const origAccount = entries[errorIndex].account
      const parent = origAccount.split('-')[0]
      const swapList = ACCOUNT_SWAPS[origAccount] || ACCOUNT_SWAPS[parent] || Object.keys(ACCOUNT_SWAPS)
      // 确保替换后类别发生变化（资产↔损益）
      let newAccount = swapList[0]
      let attempts = 0
      while (newAccount === origAccount && getAccountCategory(origAccount) === getAccountCategory(newAccount) && attempts < 20) {
        newAccount = swapList[Math.floor(Math.random() * swapList.length)]
        attempts++
      }
      // 兜底：若遍历完仍无不同类别，直接取第一个不同科目的项
      if (newAccount === origAccount || getAccountCategory(origAccount) === getAccountCategory(newAccount)) {
        const candidate = swapList.find((s) => s !== origAccount)
        if (candidate) newAccount = candidate
      }
      entries[errorIndex].account = newAccount
      hint = `这里应该用「${origAccount}」，不是「${entries[errorIndex].account}」。收入和成本不能互相替代。`
      explanation = `「${origAccount}」是${getAccountCategory(origAccount)}类科目，而「${entries[errorIndex].account}」是${getAccountCategory(entries[errorIndex].account)}类科目，两者性质不同，不可混用。`
      break
    }
  }

  return {
    wrong: entries,
    errorType,
    errorIndex,
    hint,
    explanation,
  }
}

function getAccountCategory(account) {
  const cat = {
    资产: ['银行存款', '库存现金', '应收账款', '原材料', '库存商品', '固定资产', '累计折旧'],
    负债: ['短期借款', '应付账款', '应付职工薪酬', '应付利息', '应交税费'],
    权益: ['实收资本', '本年利润'],
    收入: ['主营业务收入'],
    费用: ['主营业务成本', '管理费用', '财务费用', '研发费用', '所得税费用'],
  }
  for (const [c, list] of Object.entries(cat)) {
    if (list.includes(account)) return c
  }
  return '其他'
}

/**
 * 生成一局：随机选 count 个模板，每个注入错误
 * @param {number} count - 题目数量，默认 5
 * @returns {Array<{template, wrong, errorType, errorIndex, hint, explanation, options}>}
 */
export function buildRound(count = 5) {
  const picked = shuffle(TEMPLATES).slice(0, Math.min(count, TEMPLATES.length))
  return picked.map((t) => {
    const { wrong, errorType, errorIndex, hint, explanation } = injectError(t)
    // 生成 3 个修正选项（1 正确 + 2 干扰）
    const options = buildOptions(t.entries, errorType)
    // 打乱展示顺序，但必须保留 orig（原始下标）以便回溯 errorIndex
    const displayed = shuffle(
      wrong.map((e, orig) => ({ ...e, orig, displayIndex: 0 }))
    ).map((e, i) => ({ ...e, displayIndex: i }))
    return {
      template: t,
      wrong: displayed,
      errorType,
      errorIndex,
      hint,
      explanation,
      options,
    }
  })
}

/**
 * 生成修正选项：正确答案 + 2 个干扰项
 */
function buildOptions(correct, errorType) {
  const correctOpt = { id: 'opt-correct', label: '修正方案 A', entries: correct, isCorrect: true }
  const d1 = mutateEntries(correct, 'ACCOUNT')
  const d2 = mutateEntries(correct, errorType === 'DIRECTION' ? 'AMOUNT' : 'DIRECTION')
  return shuffle([
    correctOpt,
    { id: 'opt-w1', label: '修正方案 B', entries: d1, isCorrect: false },
    { id: 'opt-w2', label: '修正方案 C', entries: d2, isCorrect: false },
  ])
}

/**
 * 对分录条目进行随机篡改（用于生成干扰项）
 */
function mutateEntries(entries, type) {
  const out = entries.map((e) => ({ ...e }))
  const i = Math.floor(Math.random() * out.length)
  switch (type) {
    case 'AMOUNT':
      out[i] = { ...out[i], amount: +(out[i].amount * 1.5).toFixed(1) }
      break
    case 'ACCOUNT': {
      const key = out[i].account
      const parent = key.split('-')[0]
      const swap = ACCOUNT_SWAPS[key] || ACCOUNT_SWAPS[parent]
      out[i] = { ...out[i], account: swap ? swap[Math.floor(Math.random() * swap.length)] : out[i].account }
      break
    }
    case 'DIRECTION':
      out.forEach((e) => { e.side = e.side === 'debit' ? 'credit' : 'debit' })
      break
  }
  return out
}

/**
 * 验证玩家结果
 * @param {Object} puzzle - buildRound 返回的单题对象
 * @param {number[]} marked - 玩家点击标记的 displayIndex 数组
 * @param {string} chosenId - 玩家选中的选项 id
 * @returns {{correct, marks, fixed, type, explanation}}
 */
export function judge(puzzle, marked = [], chosenId = null) {
  // 计算需要标记的 displayIndex：把 errorIndex 映射到打乱后的 displayIndex
  let expectDisplayIndices
  if (puzzle.errorIndex >= 0) {
    const found = puzzle.wrong.find((e) => e.orig === puzzle.errorIndex)
    expectDisplayIndices = found ? [found.displayIndex] : []
  } else {
    // 方向错误：两条都错，全部标记
    expectDisplayIndices = puzzle.wrong.map((e) => e.displayIndex)
  }

  const marks = expectDisplayIndices.length === marked.length && expectDisplayIndices.every((i) => marked.includes(i))

  const chosen = puzzle.options.find((o) => o.id === chosenId)
  const fixed = !!(chosen && chosen.isCorrect)

  return {
    correct: marks && fixed,
    marks,
    fixed,
    type: {
      code: puzzle.errorType,
      name: getErrorTypeName(puzzle.errorType),
      icon: getErrorTypeIcon(puzzle.errorType),
      color: getErrorTypeColor(puzzle.errorType),
    },
    explanation: puzzle.explanation,
  }
}

// ============ 展示辅助 ============
export function getErrorTypeName(t) {
  return { AMOUNT: '金额错误', ACCOUNT: '科目错误', DIRECTION: '借贷方向错误', CATEGORY: '科目归类错误' }[t] || '未知错误'
}
export function getErrorTypeIcon(t) {
  return { AMOUNT: '💰', ACCOUNT: '📋', DIRECTION: '↔️', CATEGORY: '📁' }[t] || '❓'
}
export function getErrorTypeColor(t) {
  return { AMOUNT: '#e74c3c', ACCOUNT: '#3498db', DIRECTION: '#9b59b6', CATEGORY: '#f39c12' }[t] || '#666'
}
