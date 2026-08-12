// 经营沙盒引擎（内核）：科目余额 + 凭证 + 随机数值 + 难度容错 + 纠错调整 + 报表
// 贴近真实会计：借款次月起每月计提利息；固定资产按月折旧；权责发生制

import { getCompany } from '../data/companies.js'

// 金额格式化：保留 1 位小数（万元单位），消除浮点尾差如 27.650000000000002
export const fmtW = (v) => Number((v || 0).toFixed(1)).toFixed(1)

const INITIAL_BALANCES = () => ({
  银行存款: 0, 库存现金: 0, 应收账款: 0, 应付账款: 0, 原材料: 0, 库存商品: 0,
  生产成本: 0, 固定资产: 0, 累计折旧: 0, 累计摊销: 0, 无形资产: 0, 研发支出: 0,
  预付账款: 0, 短期借款: 0, 应付职工薪酬: 0, 应付利息: 0, 应交税费: 0,
  实收资本: 0, 股本: 0, 本年利润: 0, 主营业务收入: 0, 主营业务成本: 0,
  管理费用: 0, 财务费用: 0, 研发费用: 0, 所得税费用: 0,
})

// 科目性质：true = 借增贷减；false = 贷增借减
const NATURE = {
  银行存款: true, 库存现金: true, 应收账款: true, 原材料: true, 库存商品: true,
  生产成本: true, 固定资产: true, 无形资产: true, 研发支出: true, 预付账款: true,
  主营业务成本: true, 管理费用: true, 财务费用: true, 研发费用: true, 所得税费用: true,
  短期借款: false, 应付账款: false, 应付职工薪酬: false, 应付利息: false, 应交税费: false,
  实收资本: false, 股本: false, 本年利润: false, 累计折旧: false, 累计摊销: false, 主营业务收入: false,
}
function natureOf(account) {
  if (NATURE[account] !== undefined) return NATURE[account]
  const parent = account.split('-')[0]
  return NATURE[parent] !== undefined ? NATURE[parent] : true
}
function bump(balances, account, side, amount) {
  const isDebitNormal = natureOf(account)
  let delta = amount
  if (side === 'credit') delta = -delta
  if (!isDebitNormal) delta = -delta
  balances[account] = (balances[account] || 0) + delta
}

// ---------- 难度配置 ----------
export const DIFFICULTY = {
  easy: { id: 'easy', name: '简单模式', lives: 3, autoFix: true, randFund: false, selfEntry: false,
    hint: '系统给出分录，错了自动修正，容错 3 次' },
  hard: { id: 'hard', name: '困难模式', lives: 1, autoFix: false, randFund: true, selfEntry: true,
    hint: '自己写分录，金额随机，错 1 次扣容错，必须做调整分录' },
  hardcore: { id: 'hardcore', name: '硬核模式', lives: 0, autoFix: false, randFund: true, selfEntry: true,
    hint: '错 1 次即失败，学不到最终关' },
}

// ---------- 税务规则 ----------
export const TAX = {
  VAT_SMALL: 0.03,     // 小规模纳税人征收率
  VAT_GENERAL: 0.13,   // 一般纳税人税率（货物）
  CIT: 0.25,           // 企业所得税标准税率
  CIT_SMALL: 0.05,     // 小型微利企业优惠（年应税所得额≤300万部分，实际税负5%）
  RND_SUPER: 1.0,      // 研发费用加计扣除比例（100%，即每花1元研发，税前扣除2元）
  FORCE_THRESHOLD: 500, // 年应税销售额超 500万 强制登记为一般纳税人
}

// 合理避税（合法税务筹划）手段，与邪道偷逃税严格区分：
// - smallBenefit：利用小型微利企业优惠（年应税所得≤300万按5%而非25%）
// - rndDeduction：研发费用加计扣除（花1元研发，税前扣除2元，少缴所得税）
// - vatSmall：小规模纳税人季度≤30万免增值税（普票）
export const TAX_PLANS = {
  smallBenefit: { id: 'smallBenefit', name: '小型微利优惠', desc: '年应税所得≤300万，所得税按5%而非25%' },
  rndDeduction: { id: 'rndDeduction', name: '研发加计抵扣', desc: '研发费用加计扣除100%，税前扣除翻倍' },
  vatSmall: { id: 'vatSmall', name: '小规模免税', desc: '小规模纳税人季度销售额≤30万免征增值税' },
}

// ---------- 创建公司（空壳：资金/资产由后续剧情步骤注入） ----------
export function createCompany(companyId, diffId = 'easy') {
  const co = getCompany(companyId)
  const balances = INITIAL_BALANCES()
  const state = {
    companyId, co, month: 0, balances, ledger: [], loans: [],
    vouchers: [], errors: [], lives: DIFFICULTY[diffId].lives, difficulty: diffId,
    penalty: 0, history: [], failed: false, failedReason: '', scale: 1,
    taxType: 'small', cumSales: 0, vatOutput: 0, vatInput: 0,
    forcedGeneral: false, boost: 0, choices: {},
    // 持续经营（第七章）新增字段
    year: 1,                       // 当前经营年份（1 起）
    yearMood: 'normal',            // 本年行情：good 丰年 / bad 歉年 / normal
    evilCount: 0,                  // 累计"邪道玩法"次数
    evilEvents: [],                // 已埋下的雷：{atYear, type}（恶果延迟爆发）
    skippedTaxMonths: 0,           // 累计未缴税月数（用于爆雷时补缴+罚款）
    totalDividend: 0,              // 累计已分红净额（股东实得）
    quarterRevenue: 0,             // 本季度累计营收（用于小规模免税判定）
    usedTaxPlans: [],              // 已采用的合法筹划手段 id 列表
    // 游戏性增强字段
    receivables: [],               // 应收账款（赊销，F）
    payablesDue: [],               // 到期应付账款（F）
    reachedMilestones: [],         // 已达成里程碑 id（D）
    choiceLog: [],                 // 决策记录（B）
    eventBuff: {},                 // 当月随机事件数值缓冲（C）
    monthOrders: [],               // 当月订单（E）
    lastEvent: null,               // 最近一次随机事件（C）
  }
  return state
}

// 注入启动资金（由第一章"出资方式"决策触发，真正影响后续经营规模）
// 本金（实收资本）固定 = co.initCash；借款是额外借入的，放大经营规模。
// choice: 'full' 不借款 | 'part' 借本金30% | 'low' 借本金70%
export function applyFunding(state, choice) {
  const co = state.co
  const own = co.initCash                       // 本金（股东出资）固定
  let borrow
  if (choice === 'low') borrow = +(own * 0.7).toFixed(1)
  else if (choice === 'part') borrow = +(own * 0.3).toFixed(1)
  else borrow = 0
  state.balances['银行存款'] = +(own + borrow).toFixed(1)  // 可动用资金 = 本金 + 借款
  state.balances['实收资本'] = own
  state.balances['短期借款'] = borrow
  state.scale = +((own + borrow) / own).toFixed(3)         // 借款放大经营规模
  state.loans = borrow > 0 ? [{ principal: borrow, rate: co.economics.interestRate, since: 1 }] : []
  state.choices.leverage = choice
  return state
}

// 扩张决策：借款或利润再投入，放大经营规模（影响后续工资/利息/营收）
export function applyExpand(state, { borrow = 0, own = 0 } = {}) {
  const co = state.co
  if (borrow > 0) {
    applyBusiness(state, mk('银行存款', borrow, '短期借款', borrow, '扩张：银行借款'), state.month)
    state.loans.push({ principal: borrow, rate: co.economics.interestRate, since: state.month + 1 })
  }
  if (own > 0) {
    applyBusiness(state, mk('银行存款', own, '实收资本', own, '扩张：利润再投入'), state.month)
  }
  state.scale = +((state.scale || 1) + (borrow + own) / co.initCash).toFixed(3)
  return state
}

// 设置纳税人类型（第一章决策）：small 小规模 / general 一般纳税人
export function applyTaxType(state, type) {
  state.taxType = type === 'general' ? 'general' : 'small'
  state.choices.taxType = state.taxType
  return state
}

// 销售：按纳税人类型计销项税，累计销售额与销项；返回 entries
export function vatOnSale(state, saleAmt, revenueAccount) {
  const rate = state.taxType === 'general' ? TAX.VAT_GENERAL : TAX.VAT_SMALL
  const vat = +(saleAmt * rate).toFixed(2)
  state.cumSales = +(state.cumSales + saleAmt).toFixed(2)
  state.vatOutput = +(state.vatOutput + vat).toFixed(2)
  const entries = [
    { side: 'debit', account: '银行存款', amount: +(saleAmt + vat).toFixed(2) },
    { side: 'credit', account: revenueAccount, amount: saleAmt },
    { side: 'credit', account: '应交税费-销项', amount: vat },
  ]
  return { entries, vat, saleAmt, rate }
}

// 采购：一般纳税人可抵扣进项（形成进项税资产），累计进项
export function vatOnPurchase(state, purAmt, onCredit) {
  const rate = state.taxType === 'general' ? TAX.VAT_GENERAL : 0
  const vat = +(purAmt * rate).toFixed(2)
  state.vatInput = +(state.vatInput + vat).toFixed(2)
  const debit = [{ side: 'debit', account: '库存商品', amount: purAmt }]
  if (vat > 0) debit.push({ side: 'debit', account: '应交税费-进项', amount: vat })
  const credit = onCredit
    ? [{ side: 'credit', account: '应付账款', amount: +(purAmt + vat).toFixed(2) }]
    : [{ side: 'credit', account: '银行存款', amount: +(purAmt + vat).toFixed(2) }]
  return { entries: [...debit, ...credit], vat }
}

// 年销售额超阈值 → 强制转为一般纳税人（真实税法规定）
export function maybeForceGeneral(state) {
  if (state.taxType === 'small' && state.cumSales > TAX.FORCE_THRESHOLD) {
    state.taxType = 'general'
    state.forcedGeneral = true
    state.choices.taxType = 'general'
    return true
  }
  return false
}

// 投入决策：影响后续营收规模（高投入→更高回报但有前置成本）
export function applyInvest(state, kind, level) {
  state.choices[kind] = level
  if (kind === 'market') {
    if (level === 'high') {
      const cost = +(state.co.economics.dealSize * (state.scale || 1) * 0.5).toFixed(1)
      applyBusiness(state, mk('银行存款', cost, '管理费用-营销', cost, '高投入营销'), state.month)
      state.boost = (state.boost || 0) + 0.25
    } else {
      state.boost = (state.boost || 0) + 0.05
    }
  }
  return state
}

// 结账缴税：增值税（小规模=销项；一般人=销项-进项）+ 企业所得税（利息已税前扣除形成抵税）
// plans: 合法税务筹划手段数组，例如 ['smallBenefit','rndDeduction','vatSmall']
// 注意：合理避税（合法筹划）不增加 evilCount；偷逃税请用 evilAct('tax'/'fakeInvoice')
export function settleTax(state, plans = []) {
  const planSet = new Set(plans)
  let vatPayable = state.taxType === 'general'
    ? +(state.vatOutput - state.vatInput).toFixed(2)
    : +state.vatOutput.toFixed(2)
  vatPayable = Math.max(0, vatPayable)
  // 小规模纳税人 + 季度≤30万普票：合法免征增值税
  if (state.taxType !== 'general' && planSet.has('vatSmall') && vatPayable > 0 && (state.quarterRevenue || 0) <= 30) {
    vatPayable = 0
    plans = plans.filter((p) => p !== 'vatSmall')
    planSet.delete('vatSmall')
  }

  // 应税所得额：研发费用加计扣除（合法筹划），每花1元研发税前扣除2元
  let taxableProfit = state.balances['本年利润'] || 0
  if (planSet.has('rndDeduction')) {
    const rnd = state.balances['研发费用'] || 0
    taxableProfit = +(taxableProfit - rnd).toFixed(2) // 加计100%即再扣一次研发费用
  }
  // 小型微利优惠：年应税所得≤300万按5%，否则25%（默认已按此规则，这里仅做展示标注）
  const useSmallBenefit = planSet.has('smallBenefit') && taxableProfit > 0 && taxableProfit <= 300
  const citRate = useSmallBenefit || (taxableProfit > 0 && taxableProfit <= 300) ? TAX.CIT_SMALL : TAX.CIT
  const cit = +(Math.max(0, taxableProfit) * citRate).toFixed(2)
  const entries = []
  if (vatPayable > 0) {
    entries.push(...mk('应交税费-销项', state.vatOutput, '应交税费-未交增值税', state.vatOutput, '结转销项税额'))
    if (state.taxType === 'general' && state.vatInput > 0) {
      entries.push(...mk('应交税费-未交增值税', state.vatInput, '应交税费-进项', state.vatInput, '结转进项税额'))
    }
    entries.push(...mk('应交税费-未交增值税', vatPayable, '银行存款', vatPayable, '缴纳增值税'))
  }
  if (cit > 0) {
    entries.push(...mk('所得税费用', cit, '应交税费-所得税', cit, '计提企业所得税' + (useSmallBenefit ? '（小微优惠）' : '')))
    // 结账后调用：所得税费用需立即结转至本年利润，否则本年利润虚高、恒等式失衡
    entries.push(...mk('本年利润', cit, '所得税费用', cit, '结转所得税费用至本年利润'))
    entries.push(...mk('应交税费-所得税', cit, '银行存款', cit, '缴纳企业所得税'))
  }
  applyBusiness(state, entries, '缴纳税金' + (plans.length ? '（含合法筹划）' : ''), state.month)
  state.vatOutput = 0; state.vatInput = 0
  // 记录本季营收累计（用于小规模免税判定，下一季重置）
  state.quarterRevenue = 0
  return { vatPayable, cit, taxType: state.taxType, forced: state.forcedGeneral, plans: plans.filter((p) => planSet.has(p)) }
}

// 股东分红：从本年利润中按 ratio 计提应付股利（合法分配税后利润）
export function declareDividend(state, ratio = 0.3) {
  const profit = state.balances['本年利润'] || 0
  if (profit <= 0) {
    return { ok: false, amount: 0, msg: '本年无可供分配的利润，无法分红' }
  }
  const div = +((profit * ratio).toFixed(2))
  if (div <= 0) return { ok: false, amount: 0, msg: '分红金额为0' }
  // 分红需代扣个税（股息红利20%），演示简化为从现金代扣
  const divTax = +(div * 0.2).toFixed(2)
  const net = +(div - divTax).toFixed(2)
  const entries = [
    ...mk('应付股利', div, '银行存款', div, `宣告并支付股东分红${Math.round(ratio * 100)}%`),
    ...mk('利润分配-应付股利', div, '应付股利', div, '结转应付股利'),
    ...mk('应交税费-个人所得税', divTax, '银行存款', divTax, '代扣股息红利个税20%'),
  ]
  applyBusiness(state, entries, `股东分红（${Math.round(ratio * 100)}%）`, state.month)
  state.totalDividend = +(state.totalDividend || 0) + net
  return { ok: true, amount: net, gross: div, tax: divTax, msg: `分红 ${fmtW(net)}万（代扣个税 ${fmtW(divTax)}万）` }
}

function mk(d, da, c, ca, desc) {
  return [
    { side: 'debit', account: d, amount: da, desc },
    { side: 'credit', account: c, amount: ca, desc },
  ]
}
function withMeta(e, month, i) {
  return { desc: e.desc || '', debit: e.side === 'debit' ? e.account : '', credit: e.side === 'credit' ? e.account : '', amt: e.amount, month, idx: i }
}

// 应用分录（按科目性质记账 + 写账本）
export function applyBusiness(state, entries, desc, month) {
  const ledger = [...state.ledger]
  entries.forEach((e) => bump(state.balances, e.account, e.side, e.amount))
  entries.forEach((e, i) => ledger.push(withMeta(e, month ?? state.month, ledger.length + i)))
  state.ledger = ledger
  return state
}

// 记录一张凭证（玩家自写或系统生成）。expected 为正确分录模板用于判分
export function recordVoucher(state, { desc, actual, expected, month }) {
  const correct = gradeEntries(actual, expected)
  const v = { id: state.vouchers.length + 1, month: month ?? state.month, desc, actual, expected, correct }
  state.vouchers.push(v)
  if (!correct) state.errors.push(v.id)
  return v
}

// 判分：比较借贷两边（科目等价 + 金额相等）。expected 形如 [{side,account,amount}]
export function gradeEntries(actual, expected) {
  if (!actual || actual.length !== expected.length) return false
  const norm = (list) => list.map((e) => ({ side: e.side, account: e.account, amount: +e.amount }))
    .sort((a, b) => (a.side + a.account).localeCompare(b.side + b.account) || a.amount - b.amount)
  const a = norm(actual), b = norm(expected)
  return a.every((e, i) => e.side === b[i].side && e.account === b[i].account && Math.abs(e.amount - b[i].amount) < 0.001)
}

// ---------- 月末结账 ----------
export function monthEnd(state, opts = {}) {
  const co = state.co
  const m = state.month + 1
  state.month = m
  const newEntries = []

  co.fixedAssets.forEach((fa) => newEntries.push(...mk('管理费用-折旧', fa.monthlyDep, '累计折旧', fa.monthlyDep, `计提${fa.name}折旧`)))
  state.loans.forEach((loan) => {
    const interest = +(loan.principal * loan.rate).toFixed(2)
    if (m >= loan.since) newEntries.push(...mk('财务费用-利息', interest, '应付利息', interest, `计提借款利息(月${m})`))
  })
  // 预付房租摊销：多付房租时一次性挂"预付账款-房租"，这里按月摊销进费用（权责发生制）
  const prepRent = state.choices?.rentMonths
  if (prepRent && prepRent > 0 && (state.balances['预付账款-房租'] || 0) > 0) {
    const grossMonthly = co.economics.rent * (state.scale || 1)
    const discount = state.choices.rentDiscount || 0
    const monthlyRent = +(grossMonthly * (1 - discount)).toFixed(2)
    const remain = state.balances['预付账款-房租']
    const amort = remain >= monthlyRent ? monthlyRent : remain
    if (amort > 0) {
      newEntries.push(...mk('管理费用-房租', amort, '预付账款-房租', amort, `摊销预付房租(月${m})`))
      state.balances['预付账款-房租'] = +(remain - amort).toFixed(2)
    }
  }
  applyBusiness(state, newEntries, `第${m}月末结账`, m)

  // 结转损益：将本月损益科目余额转入「本年利润」，并清零损益科目（避免重复累计）
  const rev = sumAccount(state.balances, '主营业务收入')
  const costs = sumAccount(state.balances, '主营业务成本') + sumAccount(state.balances, '管理费用') +
    sumAccount(state.balances, '财务费用') + sumAccount(state.balances, '研发费用') + sumAccount(state.balances, '所得税费用')
  const monthProfit = +(rev - costs).toFixed(2)
  state.balances['本年利润'] = +((state.balances['本年利润'] || 0) + monthProfit).toFixed(2)
  // 清零本月损益科目（下月从 0 开始累计）。注意：应交税费-销项/进项属负债/资产，由 settleTax 正常缴纳，不可在此清零
  for (const k of ['主营业务收入', '主营业务成本', '管理费用', '财务费用', '研发费用', '所得税费用', '管理费用-折旧', '管理费用-房租', '管理费用-稽查', '管理费用-招聘', '财务费用-利息', '营业外收入-补贴']) {
    if (state.balances[k] != null) state.balances[k] = 0
  }

  state.history.push({ month: m, cash: state.balances['银行存款'], profit: state.balances['本年利润'], revenue: rev, totalAssets: totalAssets(state.balances) })

  // 持续经营：跨年（每年 1 月，且非第 1 月）重掷本年行情
  if (m > 1 && m % 12 === 1) {
    state.year = (state.year || 1) + 1
    state.yearMood = rollYearMood()
  }
  // 持续经营：每年末检测邪道爆雷（延迟多年）
  maybeEvilBlowup(state, m)

  return state
}

// 结账后纠错：检查本月错误凭证，扣款并生成调整任务（返回调整任务列表）
export function settleErrors(state) {
  const diff = DIFFICULTY[state.difficulty]
  const bad = state.vouchers.filter((v) => !v.correct && v.adjustDone !== true && !v.pardoned)
  if (bad.length === 0) return { tasks: [], penalized: 0 }

  const penalized = bad.length * (state.difficulty === 'hardcore' ? 0 : 0.5) // 罚款（硬核直接失败）
  let tasks = []
  if (diff.autoFix) {
    // 简单模式：自动修正，不罚钱，仅提示
    bad.forEach((v) => {
      v.pardoned = true
      applyBusiness(state, v.expected, `自动修正：${v.desc}`, state.month)
    })
  } else if (state.difficulty === 'hardcore') {
    state.failed = true
    state.failedReason = '硬核模式：凭证记错一次即失败'
    return { tasks: [], penalized: 0, fatal: true }
  } else {
    // 困难模式：扣现金 + 要求做调整分录
    state.balances['银行存款'] = +(state.balances['银行存款'] - penalized).toFixed(2)
    state.penalty += penalized
    tasks = bad.map((v) => ({
      vid: v.id,
      desc: v.desc,
      wrong: v.actual,
      hint: `原业务应记为：${v.expected.map((e) => `${e.side === 'debit' ? '借' : '贷'} ${e.account} ${e.amount}`).join(' / ')}`,
      done: false,
    }))
  }
  return { tasks, penalized }
}

// 应用玩家补做的调整分录
export function applyAdjust(state, vid, entries) {
  const v = state.vouchers.find((x) => x.id === vid)
  if (!v) return false
  applyBusiness(state, entries, `调整分录：修正${v.desc}`, state.month)
  v.adjustDone = true
  return true
}

// 容错：扣一次机会
export function loseLife(state) {
  state.lives -= 1
  if (state.lives < 0) {
    state.failed = true
    state.failedReason = '容错次数用尽，经营失败'
  }
  return state.lives
}

export function totalAssets(b) {
  return +(b['银行存款'] + b['库存现金'] + b['应收账款'] + b['原材料'] + b['库存商品'] +
    b['生产成本'] + b['固定资产'] - b['累计折旧'] + b['无形资产'] - b['累计摊销'] + b['研发支出'] + b['预付账款']).toFixed(2)
}

export function sumAccount(b, parent) {
  let s = 0
  for (const k of Object.keys(b)) if (k === parent || k.startsWith(parent + '-')) s += (b[k] || 0)
  return +s.toFixed(2)
}

// 资不抵债判定（破产）
export function isBankrupt(state) {
  const assets = totalAssets(state.balances)
  const debt = sumAccount(state.balances, '短期借款') + sumAccount(state.balances, '应付账款') +
    sumAccount(state.balances, '应付职工薪酬') + sumAccount(state.balances, '应付利息') + sumAccount(state.balances, '应交税费')
  return assets < debt || state.balances['银行存款'] < 0
}

export function buildReports(state) {
  const b = state.balances || {}
  // 统一用 sumAccount 前缀汇总，兼容 "应交税费-销项" 这类带明细后缀的科目
  const g = (k) => sumAccount(b, k)
  const assets = [
    { item: '货币资金', value: +(g('银行存款') + g('库存现金')).toFixed(2), side: 'asset' },
    { item: '应收账款', value: +g('应收账款').toFixed(2), side: 'asset' },
    { item: '存货(含原材料/库存/在产)', value: +(g('原材料') + g('库存商品') + g('生产成本')).toFixed(2), side: 'asset' },
    { item: '预付账款', value: +g('预付账款').toFixed(2), side: 'asset' },
    { item: '固定资产(净值)', value: +(g('固定资产') - g('累计折旧')).toFixed(2), side: 'asset' },
    { item: '无形资产(净值)', value: +(g('无形资产') - g('累计摊销')).toFixed(2), side: 'asset' },
    { item: '研发支出', value: +g('研发支出').toFixed(2), side: 'asset' },
  ]
  const liabilities = [
    { item: '短期借款', value: +g('短期借款').toFixed(2), side: 'liability' },
    { item: '应付账款', value: +g('应付账款').toFixed(2), side: 'liability' },
    { item: '应付职工薪酬', value: +g('应付职工薪酬').toFixed(2), side: 'liability' },
    { item: '应付利息', value: +g('应付利息').toFixed(2), side: 'liability' },
    { item: '应交税费', value: +g('应交税费').toFixed(2), side: 'liability' },
  ]
  const equity = [
    { item: '实收资本/股本', value: +(g('实收资本') + g('股本')).toFixed(2), side: 'equity' },
    { item: '本年利润', value: +g('本年利润').toFixed(2), side: 'equity' },
  ]
  const balance = { type: 'balance', rows: [...assets, ...liabilities, ...equity] }

  const revenue = +sumAccount(b, '主营业务收入').toFixed(2)
  const cost = +sumAccount(b, '主营业务成本').toFixed(2)
  const mgmt = +sumAccount(b, '管理费用').toFixed(2)
  const fin = +sumAccount(b, '财务费用').toFixed(2)
  const rd = +sumAccount(b, '研发费用').toFixed(2)
  const tax = +sumAccount(b, '所得税费用').toFixed(2)
  const netProfit = +(revenue - cost - mgmt - fin - rd - tax).toFixed(2)
  const income = {
    type: 'income',
    rows: [
      { item: '营业收入', value: revenue },
      { item: '减：营业成本', value: -cost },
      { item: '减：管理费用', value: -mgmt },
      { item: '减：财务费用', value: -fin },
      { item: '减：研发费用', value: -rd },
      { item: '减：所得税费用', value: -tax },
      { item: '净利润', value: netProfit, emphasize: true },
    ],
  }
  return { balance, income }
}

// ================= 第七章「持续经营」扩展 =================

// 重掷本年行情：good 丰年 / bad 歉年 / normal
export function rollYearMood() {
  const r = Math.random()
  if (r < 0.33) return 'good'
  if (r < 0.66) return 'bad'
  return 'normal'
}
export const MOOD_LABEL = { good: '🌟 丰年', bad: '🌧️ 歉年', normal: '⛅ 平常年' }

// 计算本年行情对销售收入的系数
export function moodFactor(state) {
  return state.yearMood === 'good' ? 1.25 : state.yearMood === 'bad' ? 0.7 : 1.0
}
// 营销投入在低/高行情下的效率系数（丰年高效、歉年低效）
export function investEff(state) {
  return state.yearMood === 'good' ? 1.4 : state.yearMood === 'bad' ? 0.5 : 1.0
}

// 邪道玩法：记录一次违规操作（不发工资 / 不交税 / 虚开发票 等）
// 返回提示文字。违规越多，后续爆雷概率越高；恶果会延迟数年后爆发。
export function evilAct(state, kind) {
  state.evilCount = (state.evilCount || 0) + 1
  if (kind === 'salary') {
    // 不发工资：省下工资成本但欠薪，埋雷
    const due = +state.balances['应付职工薪酬'].toFixed(2)
    // 不计入费用，直接记为欠薪（挂账）
    return `😈 你选择拖欠工资。当月省下成本，但欠薪已记入「应付职工薪酬」，未来劳动稽查随时可能爆发。`
  }
  if (kind === 'tax') {
    // 不交税：应交税费挂着不缴，累计 skippedTaxMonths
    const due = +sumAccount(state.balances, '应交税费').toFixed(2)
    state.skippedTaxMonths = (state.skippedTaxMonths || 0) + 1
    return `😈 你选择偷逃税款。税款挂在「应交税费」，但税务稽查后将被追缴 + 0.5倍罚款，且越拖越狠。`
  }
  if (kind === 'fakeInvoice') {
    // 虚开发票冲成本：虚增成本（少交税）但风险极高
    return `😈 你选择虚开发票冲账。短期少缴税，但虚开发票是刑事红线，随时可能爆雷。`
  }
  return `😈 你选择了一条邪道。`
}

// 每年末（monthEnd 后）检测邪道爆雷：恶果延迟爆发，违规越多越易出事
// 通过返回事件描述字符串（或 null）让 UI 提示；设置 state.failed 则破产
export function maybeEvilBlowup(state, month) {
  state.pendingBlowup = null
  if ((state.evilCount || 0) === 0) return null
  // 每年 12 月（month%12===0）才有概率稽查；违规越多概率越高
  if (month % 12 !== 0) return null
  const p = Math.min(0.85, 0.12 * (state.evilCount || 0)) // 单次爆雷概率随违规数上升
  if (Math.random() > p) return null

  const year = state.year
  const taxDue = +sumAccount(state.balances, '应交税费').toFixed(2)
  const wageDue = +state.balances['应付职工薪酬'].toFixed(2)
  const events = []
  let entries = []
  // 补缴税款 + 0.5 倍罚款
  if (taxDue > 0) {
    const fine = +(taxDue * 0.5).toFixed(2)
    entries.push(...mk('所得税费用', fine, '应交税费-滞纳金', fine, `税务稽查：追缴税款¥${taxDue}万 + 罚款¥${fine}万`))
    entries.push(...mk('应交税费-滞纳金', fine, '银行存款', fine, '缴纳滞纳金罚款'))
    events.push(`税务稽查：追缴税款¥${taxDue}万、罚款¥${fine}万`)
  }
  if (wageDue > 0) {
    const fine = +(wageDue * 0.5).toFixed(2)
    entries.push(...mk('管理费用', fine, '银行存款', fine, `劳动稽查：补发欠薪¥${wageDue}万 + 赔偿¥${fine}万`))
    events.push(`劳动稽查：补发欠薪¥${wageDue}万、赔偿¥${fine}万`)
  }
  if (entries.length) {
    applyBusiness(state, entries, `邪道爆雷（第${year}年）`, month)
    state.skippedTaxMonths = 0
  }
  const msg = `💥 第${year}年爆雷！${events.join('；')}。邪道终有代价。`
  state.pendingBlowup = msg
  // 爆雷后若资不抵债则破产
  if (isBankrupt(state)) {
    state.failed = true
    state.failedReason = msg
  }
  return msg
}

// 顶部指标栏用：负债合计 / 营业收入 / 本年行情 / 邪道计数
export function liabilityTotal(state) {
  return +sumAccount(state.balances, '短期借款') + sumAccount(state.balances, '应付账款') +
    sumAccount(state.balances, '应付职工薪酬') + sumAccount(state.balances, '应付利息') +
    sumAccount(state.balances, '应交税费')
}
export function operatingRevenue(state) {
  return +sumAccount(state.balances, '主营业务收入')
}

// ================= 游戏性增强：订单 / 随机事件 / 应付账款账期 / 决策后果 / 评分 =================

// ---- E. 订单系统：玩家主动"接单"，影响当月销售与赊销 ----
// 生成一张订单：金额、毛利率、账期（0=现结，N=赊销N月后收）
export function genOrder(state, rng = Math.random) {
  const co = state.co
  const base = co.economics.dealSize * (state.scale || 1)
  const sizeRoll = 0.6 + rng() * 0.9                 // 0.6~1.5 倍基准
  const amount = +(base * sizeRoll * moodFactor(state)).toFixed(2)
  const margin = +(co.economics.margin * (0.7 + rng() * 0.6)).toFixed(2) // 毛利率波动
  const creditRoll = rng()
  const credit = creditRoll < 0.45 ? 0 : creditRoll < 0.8 ? (rng() < 0.5 ? 1 : 2) : 3
  const customers = ['便利店', '写字楼团购', '直播达人', '老客户返单', '政府定点', '连锁商超']
  const customer = customers[Math.floor(rng() * customers.length)]
  return {
    id: 'o' + Date.now() + Math.floor(rng() * 1000),
    customer, amount, margin, credit,
    // 预计毛利（用于订单卡片展示与玩家权衡）
    profit: +(amount * margin).toFixed(2),
    desc: `${customer} 订单：¥${amount}万 · 毛利${Math.round(margin * 100)}% · ${credit === 0 ? '现结' : '赊销' + credit + '月'}`,
  }
}

// 玩家接单：生成销售分录 + 结转成本，赊销挂应收账款
export function fulfillOrder(state, order) {
  const co = state.co
  const saleAmt = order.amount
  const costAmt = +(saleAmt * (1 - order.margin)).toFixed(2)
  const vat = vatOnSale(state, saleAmt, co.revenueAccount) // 默认借银行存款
  let entries = vat.entries.map((e) => ({ ...e }))
  if (order.credit > 0) {
    // 赊销：把"银行存款"替换为"应收账款"
    entries = entries.map((e) =>
      e.account === '银行存款' ? { ...e, account: '应收账款' } : e
    )
  }
  applyBusiness(state, entries, `接单销售：${order.customer}`)
  // 结转成本
  applyBusiness(state, co.costOfSale(costAmt), `结转成本：${order.customer}`)
  // 赊销账期登记（到期自动回款）
  if (order.credit > 0) {
    state.receivables = state.receivables || []
    state.receivables.push({ due: state.month + order.credit, amount: +(saleAmt + vat.vat).toFixed(2) })
  }
  state.choices = state.choices || {}
  state.choices.ordersFulfilled = (state.choices.ordersFulfilled || 0) + 1
  return state
}

// ---- F. 应付账款账期：赊购形成的应付账款，到期后自动从现金扣还 ----
// monthEnd 内调用：到期应付账款转银行存款扣减
export function settleDuePayables(state) {
  const due = state.payablesDue || []
  if (!due.length) return []
  const now = state.month
  const triggered = due.filter((p) => p.due <= now)
  if (!triggered.length) return []
  const total = +(triggered.reduce((s, p) => s + p.amount, 0)).toFixed(2)
  applyBusiness(state, mk('应付账款', total, '银行存款', total, `应付账款到期偿还`), state.month)
  state.payablesDue = due.filter((p) => p.due > now)
  return triggered.map((p) => ({ ...p, amount: +p.amount.toFixed(2) }))
}

// 赊购扩展：在 vatOnPurchase 基础上登记账期并实际记账
export function purchaseOnCreditWithTerm(state, purAmt, term = 3) {
  const r = vatOnPurchase(state, purAmt, true)
  applyBusiness(state, r.entries, `赊购入库(账期${term}月)`, state.month)
  state.payablesDue = state.payablesDue || []
  state.payablesDue.push({ due: state.month + term, amount: +(purAmt + r.vat).toFixed(2) })
  return r
}

// 赊销回款：到期应收账款收回现金
export function collectReceivables(state) {
  const rec = state.receivables || []
  if (!rec.length) return []
  const now = state.month
  const triggered = rec.filter((p) => p.due <= now)
  if (!triggered.length) return []
  const total = +(triggered.reduce((s, p) => s + p.amount, 0)).toFixed(2)
  applyBusiness(state, mk('银行存款', total, '应收账款', total, `应收账款到期收回`), state.month)
  state.receivables = rec.filter((p) => p.due > now)
  return triggered.map((p) => ({ ...p, amount: +p.amount.toFixed(2) }))
}

// ---- C. 随机事件：打破第七章的重复枯燥 ----
// 事件只影响当月 economics（成本/营收系数/费用），不直接破坏会计恒等式
export function rollRandomEvent(state, rng = Math.random) {
  // 每 3 个月左右触发一次，避免过密
  if (state.month % 3 !== 0) { return null }
  // 进入新月前，清空上一个月的临时事件增益（避免永久叠加）
  state.eventBuff = {}
  const library = RANDOM_EVENTS
  if (!library.length) return null
  const pick = library[Math.floor(rng() * library.length)]
  // 应用事件数值效果（作用于 choices 临时系数，monthEnd 时读取）
  state.eventBuff = state.eventBuff || {}
  if (pick.effect) pick.effect(state)
  const ev = { id: pick.id, title: pick.title, emoji: pick.emoji, desc: pick.desc, tone: pick.tone, month: state.month }
  state.lastEvent = ev
  return ev
}

// 事件类型库：tone: good / bad / neutral
export const RANDOM_EVENTS = [
  {
    id: 'materialSpike', title: '原料涨价', emoji: '📈', tone: 'bad',
    desc: '上游原料普涨，本月采购成本上浮 20%。',
    effect: (s) => { s.eventBuff.purchaseUp = (s.eventBuff.purchaseUp || 0) + 0.2 },
  },
  {
    id: 'viral', title: '网红打卡爆单', emoji: '🔥', tone: 'good',
    desc: '你家店被网红带火，本月销售收入 +35%！',
    effect: (s) => { s.eventBuff.saleUp = (s.eventBuff.saleUp || 0) + 0.35 },
  },
  {
    id: 'inspection', title: '突击税务检查', emoji: '🚨', tone: 'bad',
    desc: '税务部门突击检查，本月需补缴一笔合规费用 ¥0.5万。',
    effect: (s) => { applyBusiness(s, mk('管理费用-稽查', 0.5, '银行存款', 0.5, '突击检查合规费'), s.month) },
  },
  {
    id: 'staffLeave', title: '骨干离职', emoji: '😵', tone: 'bad',
    desc: '一名骨干突然离职，招聘重置成本 ¥0.8万，本月效率下降。',
    effect: (s) => {
      applyBusiness(s, mk('管理费用-招聘', 0.8, '银行存款', 0.8, '骨干离职重置成本'), s.month)
      s.eventBuff.saleUp = (s.eventBuff.saleUp || 0) - 0.1
    },
  },
  {
    id: 'groupOrder', title: '大客户团购', emoji: '🤝', tone: 'good',
    desc: '一家大企业抛来团购大单，本月销售收入 +25%。',
    effect: (s) => { s.eventBuff.saleUp = (s.eventBuff.saleUp || 0) + 0.25 },
  },
  {
    id: 'rentFree', title: '房东免租', emoji: '🎁', tone: 'good',
    desc: '房东好心免收本月房租，省下一笔固定开支。',
    effect: (s) => { s.eventBuff.skipRent = true },
  },
  {
    id: 'refund', title: '客户退货', emoji: '↩️', tone: 'bad',
    desc: '一批货因质量问题被退回，本月营收 -15%。',
    effect: (s) => { s.eventBuff.saleUp = (s.eventBuff.saleUp || 0) - 0.15 },
  },
  {
    id: 'subsidy', title: '政策补贴', emoji: '💰', tone: 'good',
    desc: '小微企业获政府补贴 ¥1万，直接入账。',
    effect: (s) => { applyBusiness(s, mk('银行存款', 1, '营业外收入-补贴', 1, '政策补贴入账'), s.month) },
  },
]

// ---- D. 经营里程碑 ----
export const MILESTONES = [
  { month: 6, id: 'halfYear', emoji: '🗓️', title: '熬过半年', desc: '公司稳健运营满 6 个月' },
  { month: 12, id: 'firstYear', emoji: '🏅', title: '首年盈利', desc: '完成第一个完整经营年度' },
  { month: 24, id: 'twoYear', emoji: '🏪', title: '两年老店', desc: '持续经营满 24 个月' },
  { month: 36, id: 'threeYear', emoji: '👑', title: '三年标杆', desc: '成为行业标杆企业' },
]
// 检测本月新达成的里程碑（返回新达成列表）
export function checkMilestones(state) {
  const reached = state.reachedMilestones || []
  const fresh = MILESTONES.filter((m) => state.month >= m.month && !reached.includes(m.id))
  if (fresh.length) state.reachedMilestones = [...reached, ...fresh.map((m) => m.id)]
  return fresh
}

// ---- B. 决策后果回放：量化"你的选择带来了什么差异" ----
// 在关键决策点调用 trackChoice，记录可对比的指标快照
export function trackChoice(state, key, payload) {
  state.choiceLog = state.choiceLog || []
  state.choiceLog.push({ key, ...payload, month: state.month })
  return state
}
// 计算与"反事实"的对比提示（如小规模 vs 一般纳税人本季增值税差异）
export function decisionInsights(state) {
  const log = state.choiceLog || []
  const insights = []
  // 增值税选择对比：若选小规模，估算若选一般人要多交多少
  const taxLog = log.find((l) => l.key === 'taxType')
  if (taxLog) {
    if (taxLog.value === 'small') {
      const generalVat = state.cumSales * TAX.VAT_GENERAL
      const smallVat = state.cumSales * TAX.VAT_SMALL
      const save = +(generalVat - smallVat).toFixed(2)
      if (save > 0.1) insights.push(`🔎 你选「小规模纳税人」：相比一般纳税人，累计少缴增值税约 ¥${fmtW(save)}万（征收率3% vs 税率13%）。`)
    } else {
      insights.push(`🔎 你选「一般纳税人」：可抵扣进项税，适合进项充足、客户要专票的成长型企业。`)
    }
  }
  // 杠杆对比
  const levLog = log.find((l) => l.key === 'leverage')
  if (levLog && levLog.value !== 'full') {
    const borrow = levLog.borrow || 0
    const interest = +(borrow * state.co.economics.interestRate * 12).toFixed(2)
    insights.push(`🔎 你借款 ¥${fmtW(borrow)}万放大经营，但每年需付利息约 ¥${fmtW(interest)}万，考验现金流。`)
  }
  return insights
}

// ---- A. 通关评分指标（雷达图四维） ----
// 返回 {profit, cash, risk, compliance} 0~100 分
export function scoreMetrics(state) {
  const b = state.balances
  // 月末收入/成本已结转至「本年利润」，故累计净利润直接取之；若无则按科目反推
  const netProfit = b['本年利润'] != null
    ? +b['本年利润']
    : (+sumAccount(b, '主营业务收入') -
      (sumAccount(b, '主营业务成本') + sumAccount(b, '管理费用') + sumAccount(b, '财务费用') + sumAccount(b, '研发费用') + sumAccount(b, '所得税费用')))
  const cash = b['银行存款'] || 0
  const assets = totalAssets(b)
  const debt = liabilityTotal(state)
  // 盈利能力：以净利润/资产 衡量，封顶 100
  const roa = assets > 0 ? netProfit / assets : 0
  const profitScore = Math.max(0, Math.min(100, Math.round(roa * 300 + 30)))
  // 现金流健康：现金为正且占比合理
  const cashRatio = assets > 0 ? cash / assets : 0
  const cashScore = Math.max(0, Math.min(100, Math.round(cashRatio * 120 + (cash > 0 ? 20 : 0))))
  // 风险（杠杆）：负债率越低越好
  const leverage = assets > 0 ? debt / assets : 0
  const riskScore = Math.max(0, Math.min(100, Math.round((1 - leverage) * 100)))
  // 合规度：邪道次数越少越高 + 是否按时缴税
  const complianceScore = Math.max(0, Math.min(100, 100 - (state.evilCount || 0) * 25 - (state.skippedTaxMonths || 0) * 10))
  return {
    profit: profitScore,
    cash: cashScore,
    risk: riskScore,
    compliance: complianceScore,
    netProfit: +netProfit.toFixed(2),
    cashRaw: +cash.toFixed(2),
    assets: +assets.toFixed(2),
    debt: +debt.toFixed(2),
  }
}

// 综合星级（用于结算总结）
export function overallStars(scores) {
  const avg = (scores.profit + scores.cash + scores.risk + scores.compliance) / 4
  if (avg >= 80) return 3
  if (avg >= 55) return 2
  if (avg >= 30) return 1
  return 0
}

// 在 monthEnd 中接入里程碑/事件/应收应付（对外暴露的钩子，由 Game 调用）
export function endOfMonthExtras(state, { rollEvent = true } = {}) {
  const events = []
  // 应收账款到期收回
  const rec = collectReceivables(state)
  if (rec.length) events.push({ type: 'collect', title: '应收账款收回', amount: +(rec.reduce((s, p) => s + p.amount, 0)).toFixed(2) })
  // 应付账款到期偿还
  const pay = settleDuePayables(state)
  if (pay.length) events.push({ type: 'payable', title: '应付账款到期偿还', amount: +(pay.reduce((s, p) => s + p.amount, 0)).toFixed(2) })
  // 随机事件
  let ev = null
  if (rollEvent) ev = rollRandomEvent(state)
  // 里程碑
  const miles = checkMilestones(state)
  return { events, ev, miles }
}
