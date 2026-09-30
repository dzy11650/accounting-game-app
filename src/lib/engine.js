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
  return delta
}

// ============ 月末需清零的损益科目白名单 ============
// 说明：
//  - 这些科目每月在 monthEnd() 结转至「本年利润」后需清零，下月从 0 重新累计。
//  - 必须同时清零所有带「-」后缀的明细子科目（如 管理费用-工资），否则子科目会逐月累积导致利润虚亏。
//  - 「所得税费用」刻意不在此列表：企业所得税由 settleTax() 计提并当场结转至「本年利润」，
//    若此处一并清零会造成跨月重复扣除、资产负债表恒等式失衡。
//  - 「应交税费-*」属负债/资产科目，由 settleTax() 正常缴纳，禁止在此清零。
const PNL_SUBJECTS_TO_RESET = [
  '主营业务收入',
  '主营业务成本',
  '管理费用',
  '财务费用',
  '研发费用',
  '营业外收入-补贴',
]

// 永不参与月末清零的科目（显式保护，防止后续误把税费类科目加入白名单）
export const PNL_KEEP_BALANCE_SUBJECTS = [
  '所得税费用',
  '应交税费',
]

/**
 * 清零本月损益科目（含明细子科目）。
 * 供 monthEnd() 在结转损益至「本年利润」之后调用。
 * @param {object} state 游戏状态（会被就地修改）
 */
export function clearPnLAccounts(state) {
  const b = state.balances || {}
  const isProtected = (acc) =>
    PNL_KEEP_BALANCE_SUBJECTS.some((k) => acc === k || acc.startsWith(k + '-'))
  // 先处理白名单主科目
  PNL_SUBJECTS_TO_RESET.forEach((k) => {
    if (b[k] != null) b[k] = 0
  })
  // 再处理所有明细子科目（如「管理费用-工资/房租/折旧」）
  Object.keys(b).forEach((full) => {
    if (isProtected(full)) return
    const matched = PNL_SUBJECTS_TO_RESET.some((k) => full.startsWith(k + '-'))
    if (matched) b[full] = 0
  })
}

// 损益科目 → 累计损益类别（供利润表实时追踪）
function pnlCat(account) {
  if (account === '主营业务收入' || account.startsWith('主营业务收入')) return 'revenue'
  if (account === '主营业务成本' || account.startsWith('主营业务成本')) return 'cost'
  if (account === '管理费用' || account.startsWith('管理费用')) return 'mgmt'
  if (account === '财务费用' || account.startsWith('财务费用')) return 'fin'
  if (account === '研发费用' || account.startsWith('研发费用')) return 'rd'
  if (account === '所得税费用' || account.startsWith('所得税费用')) return 'tax'
  return null
}

// ---------- 难度配置 ----------
export const DIFFICULTY = {
  easy: { id: 'easy', name: '简单模式', lives: 3, autoFix: true, randFund: false, selfEntry: false,
    hint: '系统给出分录，错了自动修正，容错 3 次',
    // 经济难度系数：固定费用打折、毛利不缩、随机事件温和 → 利润好看
    econ: { costMult: 0.65, marginMult: 1.0, eventMult: 0.6 } },
  hard: { id: 'hard', name: '困难模式', lives: 1, autoFix: false, randFund: true, selfEntry: true,
    hint: '自己写分录，金额随机，错 1 次扣容错，必须做调整分录',
    econ: { costMult: 1.0, marginMult: 0.9, eventMult: 1.0 } },
  hardcore: { id: 'hardcore', name: '硬核模式', lives: 0, autoFix: false, randFund: true, selfEntry: true,
    hint: '错 1 次即失败，学不到最终关',
    econ: { costMult: 1.25, marginMult: 0.82, eventMult: 1.3 } },
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
// projectId：经营项目（细分产品线），可空，默认取该公司第一个项目
export function createCompany(companyId, diffId = 'easy', projectId = null) {
  const base = getCompany(companyId)
  // 合并经营项目参数：项目可微调毛利率 / 单笔规模 / 房租等
  const projects = base.projects || []
  const proj = projects.find((p) => p.id === projectId) || projects[0] || null
  const co = proj && proj.econ
    ? { ...base, economics: { ...base.economics, ...proj.econ } }
    : base
  const balances = INITIAL_BALANCES()
  const state = {
    companyId, co, month: 0, balances, ledger: [], loans: [],
    vouchers: [], errors: [], lives: DIFFICULTY[diffId].lives, difficulty: diffId,
    diffEcon: DIFFICULTY[diffId].econ || { costMult: 1, marginMult: 1, eventMult: 1 },
    penalty: 0, history: [], failed: false, failedReason: '', scale: 1,
    taxType: 'small', cumSales: 0, vatOutput: 0, vatInput: 0,
    forcedGeneral: false, boost: 0, choices: {},
    // 经营项目（细分产品线）
    projectId: proj ? proj.id : null,
    projectName: proj ? proj.name : null,
    projectEmoji: proj ? proj.emoji : null,
    // 持续经营（第七章）新增字段
    year: 1,                       // 当前经营年份（1 起）
    yearMood: 'normal',            // 本年行情：good 丰年 / bad 歉年 / normal
    evilCount: 0,                  // 累计"邪道玩法"次数
    evilEvents: [],                // 已埋下的雷：{atYear, type}（恶果延迟爆发）
    skippedTaxMonths: 0,           // 累计未缴税月数（用于爆雷时补缴+罚款）
    // —— 第七章邪道·工资拖欠扩展 ——
    wageDiscontent: 0,             // 隐藏不满度 0~100（拖欠工资累积，影响效率）
    wageStrikes: 0,                // 罢工黑历史次数（越多越易再罢工、损失越大）
    wageUnpaid: 0,                 // 累计欠薪额（万）
    strikeThisMonth: false,        // 本月是否发生罢工（影响本月效率与成本）
    pendingStrike: null,           // 罢工待处理：{month} → UI 弹窗三选一
    // —— 第七章邪道·税务偷逃扩展 ——
    taxAdjusts: 0,                 // 调账改应纳税额次数（产生分录，按次数定稽查概率）
    taxAdjustAmount: 0,            // 累计调账虚减的税额（被查到需补回）
    taxOwed: 0,                    // 直接拖欠的累计税额（产生每日万分之五滞纳金）
    taxLateFee: 0,                 // 累计滞纳金（万）
    auditHits: 0,                  // 被税务局查处次数（黑历史）
    totalDividend: 0,              // 累计已分红净额（股东实得）
    quarterRevenue: 0,             // 本季度累计营收（用于小规模免税判定）
    usedTaxPlans: [],              // 已采用的合法筹划手段 id 列表
    cum: { revenue: 0, cost: 0, mgmt: 0, fin: 0, rd: 0, tax: 0 }, // 累计损益（实时追踪，供利润表展示）
    // 游戏性增强字段
    receivables: [],               // 应收账款（赊销，F）
    payablesDue: [],               // 到期应付账款（F）
    reachedMilestones: [],         // 已达成里程碑 id（D）
    choiceLog: [],                 // 决策记录（B）
    eventBuff: {},                 // 当月随机事件数值缓冲（C）
    monthOrders: [],               // 当月订单（E）
    lastEvent: null,               // 最近一次随机事件（C）
    // —— roguelike 天赋系统 ——
    talents: [],                   // 已选天赋 id 列表（上限 3）
    synergies: [],                 // 已触发羁绊 id
    rescueLimit: 1,                // 破产兜底次数（备用金基础 1，资金羁绊 2）
    rescues: 0,                    // 已用兜底次数
    // 天赋倍率默认值（applyTalent 覆盖，monthEnd/taxAudit 等读取）
    depreciationMult: 1, interestMult: 1, loanRateMult: 1, mgmtMult: 1,
    purchaseDown: 0, salaryMult: 1, buffMult: 1, badEventMult: 1,
    auditProbMult: 1, auditFineMult: 1, fineMult: null,
    wageDiscontentMult: 1, strikeLossMult: null,
    supplierRiskMult: 1, stockTieMult: 1, safetyStockMult: 1,
    salePriceBoost: 0, creditTermBoost: 0, orderMarginBoost: 0,
    angelBoost: 0, bridgeLoan: 0, bridgeRateBoost: 0,
    taxRebate: 0, rndSuperBoost: 0,
    talentReserve: false, talentLightReserve: 0, talentHitProduct: false,
    talentInfluencer: false, talentBudgetEye: false, talentDataBoard: false,
    talentInsider: false, talentPeerBench: false, talentMicroWhite: false,
    infoLevel: 0,
  }
  return state
}

// 注入启动资金（由第一章"出资方式"决策触发，真正影响后续经营规模）
// 本金（实收资本）固定 = co.initCash；借款是额外借入的，放大经营规模。
// choice: 'full' 不借款 | 'part' 借本金30% | 'low' 借本金70%
export function applyFunding(state, choice) {
  const co = state.co
  // 天赋：天使投资 → 实收资本基数放大
  let own = +(co.initCash * (1 + (state.angelBoost || 0))).toFixed(1)
  let borrow
  if (choice === 'low') borrow = +(own * 0.7).toFixed(1)
  else if (choice === 'part') borrow = +(own * 0.3).toFixed(1)
  else borrow = 0
  // 天赋：过桥融资 → 开局追加 ¥10 万短期借款（利率上浮）
  if (state.bridgeLoan) {
    borrow = +(borrow + state.bridgeLoan).toFixed(1)
    state.bridgeRateBoost = state.bridgeRateBoost || 0
  }
  state.balances['银行存款'] = +(own + borrow).toFixed(1)  // 可动用资金 = 本金 + 借款
  state.balances['实收资本'] = own
  state.balances['短期借款'] = borrow
  state.scale = +((own + borrow) / own).toFixed(3)         // 借款放大经营规模
  // 天赋·快速融资：借款利率 ×loanRateMult（0.8）
  const baseRate = (co.economics.interestRate + (state.bridgeRateBoost || 0)) * (state.loanRateMult || 1)
  state.loans = borrow > 0 ? [{ principal: borrow, rate: +baseRate.toFixed(5), since: 1 }] : []
  state.choices.leverage = choice
  return state
}

// 扩张决策：借款或利润再投入，放大经营规模（影响后续工资/利息/营收）
export function applyExpand(state, { borrow = 0, own = 0 } = {}) {
  const co = state.co
  if (borrow > 0) {
    applyBusiness(state, mk('银行存款', borrow, '短期借款', borrow, '扩张：银行借款'), state.month)
    state.loans.push({ principal: borrow, rate: +(co.economics.interestRate * (state.loanRateMult || 1)).toFixed(5), since: state.month + 1 })
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
  // 兜底：仅科技类企业（co.id === 'tech'）有研发活动，非科技型企业不选研发加计，
  // 避免“连锁零售/工厂也能加计扣除”的设定穿帮（前端 choose 已拦截，此处为二次防护）。
  // 天赋·研发加计 Pro：科技类企业加计比例 100%→120%（rndSuperBoost）
  const rndSuper = TAX.RND_SUPER + (state.rndSuperBoost || 0)
  if (planSet.has('rndDeduction') && state.co?.id !== 'tech') {
    planSet.delete('rndDeduction')
    plans = plans.filter((p) => p !== 'rndDeduction')
  }
  let taxableProfit = state.balances['本年利润'] || 0
  if (planSet.has('rndDeduction')) {
    const rnd = state.balances['研发费用'] || 0
    // 加计 X% = 再扣 (X/100 × 研发费用)：100% 时即再扣 1 倍研发费用
    taxableProfit = +(taxableProfit - rnd * rndSuper).toFixed(2)
  }
  // 天赋·税收返补：按实缴所得税 × taxRebate（默认 10%）返补到现金（营业外收入）
  const cit0 = +((Math.max(0, taxableProfit)) * (taxableProfit > 0 && taxableProfit <= 300 ? TAX.CIT_SMALL : TAX.CIT)).toFixed(2)
  const rebate = state.taxRebate ? +(cit0 * state.taxRebate).toFixed(2) : 0
  if (rebate > 0) {
    applyBusiness(state, mk('营业外收入-税收返补', rebate, '应交税费-税收返补', rebate, `税收返补¥${rebate}万`), state.month)
    state.balances['本年利润'] = +((state.balances['本年利润'] || 0) + rebate).toFixed(2)
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
  entries.forEach((e) => {
    const delta = bump(state.balances, e.account, e.side, e.amount)
    const cat = pnlCat(e.account)
    if (cat && state.cum) state.cum[cat] = +((state.cum[cat] || 0) + delta).toFixed(2)
  })
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

  const costMult = (state.diffEcon && state.diffEcon.costMult) || 1
  const depMult = state.depreciationMult || 1   // 天赋·节能改造
  const intMult = state.interestMult || 1        // 天赋·政府贴息
  co.fixedAssets.forEach((fa) => {
    const dep = +(fa.monthlyDep * costMult * depMult).toFixed(2)
    newEntries.push(...mk('管理费用-折旧', dep, '累计折旧', dep, `计提${fa.name}折旧`))
  })
  state.loans.forEach((loan) => {
    const interest = +(loan.principal * loan.rate * costMult * intMult).toFixed(2)
    if (m >= loan.since) newEntries.push(...mk('财务费用-利息', interest, '应付利息', interest, `计提借款利息(月${m})`))
  })
  // 预付房租摊销：多付房租时一次性挂"预付账款-房租"，这里按月摊销进费用（权责发生制）
  const prepRent = state.choices?.rentMonths
  if (prepRent && prepRent > 0 && (state.balances['预付账款-房租'] || 0) > 0) {
    const grossMonthly = co.economics.rent * (state.scale || 1) * costMult * (state.mgmtMult || 1)
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
  // 注意：所得税费用不计入此处 costs —— 企业所得税由 settleTax() 单独计提并直接结转「本年利润」（见 settleTax 内"结转所得税费用至本年利润"）。
  // 若此处再把所得税费用算进 costs 并 += monthProfit，会导致所得税被重复扣除一次（本月 settleTax 扣一次，下月 monthEnd 又把上月 settleTax 记的所得税费用算进 costs 再扣一次）。
  const costs = sumAccount(state.balances, '主营业务成本') + sumAccount(state.balances, '管理费用') +
    sumAccount(state.balances, '财务费用') + sumAccount(state.balances, '研发费用')
  const monthProfit = +(rev - costs).toFixed(2)
  state.balances['本年利润'] = +((state.balances['本年利润'] || 0) + monthProfit).toFixed(2)
  // 累计损益追踪：已改由 applyBusiness 实时累加至 state.cum（见 pnlCat），此处无需重复累加
  // 清零本月损益科目（下月从 0 开始累计）—— 逻辑已抽至 clearPnLAccounts()，见其注释中的白名单与保护科目说明
  clearPnLAccounts(state)

  // 天赋·轻量储备（现金流纪律）：拨 5% 入「储备金」，不占用破产兜底次数（rescueLimit 不变）
  const lightReservePct = state.talentLightReserve || 0
  if (lightReservePct > 0 && (state.balances['本年利润'] || 0) > 0) {
    const allocL = +((state.balances['本年利润'] * lightReservePct).toFixed(2))
    if (allocL > 0 && (state.balances['银行存款'] || 0) >= allocL) {
      applyBusiness(state, [
        { side: 'debit', account: '储备金', amount: allocL },
        { side: 'credit', account: '银行存款', amount: allocL },
      ], `轻储备拨备¥${allocL}万`, m)
    }
  }
  // 天赋·备用金：每月末自动从本年利润拨 10% 入「储备金」（利润为负则跳过）
  if (state.talentReserve && (state.balances['本年利润'] || 0) > 0) {
    const alloc = +((state.balances['本年利润'] * 0.1).toFixed(2))
    // 简化实现：直接挂「储备金」科目（资产类，NATURE 默认借增贷减），从银行存款划转
    if (alloc > 0 && (state.balances['银行存款'] || 0) >= alloc) {
      applyBusiness(state, [
        { side: 'debit', account: '储备金', amount: alloc },
        { side: 'credit', account: '银行存款', amount: alloc },
      ], `备用金拨备¥${alloc}万`, m)
    }
  }
  // 天赋·预算之眼：记录下月固定费用预估（折旧+利息+工资）
  if (state.talentBudgetEye) {
    const nextDep = co.fixedAssets.reduce((t, fa) => t + fa.monthlyDep * costMult * (state.depreciationMult || 1), 0)
    const nextInt = state.loans.reduce((t, l) => t + l.principal * l.rate * (state.interestMult || 1), 0)
    state.budgetEye = { month: m + 1, total: +(nextDep + nextInt + co.economics.salary * (state.scale || 1)).toFixed(2) }
  }

  state.history.push({ month: m, cash: state.balances['银行存款'], profit: state.balances['本年利润'], revenue: rev, totalAssets: totalAssets(state.balances) })

  // 持续经营：跨年（每年 1 月，且非第 1 月）重掷本年行情
  if (m > 1 && m % 12 === 1) {
    state.year = (state.year || 1) + 1
    state.yearMood = rollYearMood()
  }
  // 邪道·税务：每月滚动欠税滞纳金（每日万分之五，按月 30 天计）
  accrueTaxLateFee(state)
  // 邪道·工资：每月末按概率触发罢工（结果写入 pendingStrike 供 UI 弹窗）
  rollStrike(state)
  // 邪道·税务：每月小概率税务局稽查（按调账次数 / 拖欠月数放大）
  taxAudit(state, m)
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
    // 区分硬核模式与普通模式，方便 Game 层给出不同失败提示
    state.failedReason = state.difficulty === 'hardcore'
      ? '硬核模式 · 容错 0 次，一次错误即失败'
      : '容错次数用尽，经营失败'
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
  // 天赋·备用金 + 羁绊·资本厚垫：现金为负时，储备金自动兜底（次数有限）
  if (state.balances['银行存款'] < 0) {
    const reserve = state.balances['储备金'] || 0
    if (reserve > 0 && (state.rescues || 0) < (state.rescueLimit || 1)) {
      state.rescues = (state.rescues || 0) + 1
      state.balances['银行存款'] = 0
      state.balances['储备金'] = 0
      state.pendingRescueMsg = `💵 备用金兜底：储备金注入，现金回正（已用 ${state.rescues}/${state.rescueLimit || 1} 次）`
      return false
    }
  }
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

  // 利润表：优先用累计损益 cum（月末损益科目清零后仍可还原累计），回退到余额
  const cum = state.cum || {}
  const revenue = +((cum.revenue != null ? cum.revenue : sumAccount(b, '主营业务收入'))).toFixed(2)
  const cost = +((cum.cost != null ? cum.cost : sumAccount(b, '主营业务成本'))).toFixed(2)
  const mgmt = +((cum.mgmt != null ? cum.mgmt : sumAccount(b, '管理费用'))).toFixed(2)
  const fin = +((cum.fin != null ? cum.fin : sumAccount(b, '财务费用'))).toFixed(2)
  const rd = +((cum.rd != null ? cum.rd : sumAccount(b, '研发费用'))).toFixed(2)
  const tax = +((cum.tax != null ? cum.tax : sumAccount(b, '所得税费用'))).toFixed(2)
  const netProfit = +(state.balances['本年利润'] || 0).toFixed(2) // 累计净利润以「本年利润」为准（带符号）
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

  // 现金流量表（间接法·教学简化版）
  // 说明：游戏月末会把损益类科目（收入/成本/费用）清零，仅保留累计余额与「本年利润」，
  // 故无法直接法取发生额。采用间接法，全部基于“不会清零”的累计余额，
  // 并且与资产负债表恒等式勾稽：现金净增加额 = 期末货币资金余额。
  const np = +g('本年利润').toFixed(2)
  const dep = +g('累计折旧').toFixed(2)
  const amort = +g('累计摊销').toFixed(2)
  // 年中(未结账)损益科目仍有本月发生额，月末后清零；用「本年利润(累计至上月末) + 本月损益发生额」得到累计经营净额，使月中/月末勾稽都成立
  const monthPnL = +(g('主营业务收入') - g('主营业务成本') - g('管理费用') - g('财务费用') - g('研发费用') - g('所得税费用')).toFixed(2)
  const inventory = +(g('库存商品') + g('原材料') + g('生产成本')).toFixed(2) // 存货占用（期初0）
  const receivable = +g('应收账款').toFixed(2) // 应收占用（期初0）
  const payable = +(g('应付账款') + g('应付职工薪酬') + g('应交税费') + g('应付利息')).toFixed(2) // 应付增加（期初0）
  const opNet = +(np + monthPnL + dep + amort - inventory - receivable + payable).toFixed(2)
  const invOut = -(+g('固定资产').toFixed(2) + +g('无形资产').toFixed(2) + +g('研发支出').toFixed(2)) // 购建长期资产（期初0）
  const invNet = +invOut.toFixed(2)
  const finIn = +(g('短期借款') + g('实收资本') + g('股本')).toFixed(2) // 借款+出资流入（期初0）
  const finOut = -(+g('应付股利').toFixed(2) + (state.dividendPaid || 0)) // 分红流出
  const finNet = +(finIn + finOut).toFixed(2)
  const cashNet = +(opNet + invNet + finNet).toFixed(2)
  const endCash = +(g('银行存款') + g('库存现金')).toFixed(2)
  const cashflow = {
    type: 'cashflow',
    note: '间接法（基于累计余额，与资产负债表勾稽）',
    rows: [
      { item: '一、经营活动现金流量', level: 'h' },
      { item: '净利润', value: np },
      { item: '加：累计折旧', value: dep },
      { item: '加：累计摊销', value: amort },
      { item: '减：存货的增加', value: -inventory },
      { item: '减：应收账款的增加', value: -receivable },
      { item: '加：应付账款等经营性负债的增加', value: payable },
      { item: '经营活动产生的现金流量净额', value: opNet, level: 'total' },
      { item: '二、投资活动现金流量', level: 'h' },
      { item: '购建固定资产、无形资产等支付的现金', value: invOut },
      { item: '投资活动产生的现金流量净额', value: invNet, level: 'total' },
      { item: '三、筹资活动现金流量', level: 'h' },
      { item: '取得借款、吸收投资收到的现金', value: finIn },
      { item: '偿还债务、分配利润支付的现金', value: finOut },
      { item: '筹资活动产生的现金流量净额', value: finNet, level: 'total' },
      { item: '四、现金及现金等价物净增加额', value: cashNet, level: 'total' },
      { item: '期末现金及现金等价物余额', value: endCash, level: 'total' },
    ],
  }

  return { balance, income, cashflow }
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
  if (kind === 'salary') return evilSalary(state)
  if (kind === 'taxAdjust') return evilTaxAdjust(state)
  if (kind === 'taxOwe') return evilTaxOwe(state)
  if (kind === 'fakeInvoice') {
    state.evilCount = (state.evilCount || 0) + 1
    return `😈 你选择虚开发票冲账。短期虚增成本少缴税，但虚开发票是刑事红线，随时可能爆雷。`
  }
  return `😈 你选择了一条邪道。`
}

// 邪道·拖欠工资：当月不计提工资（省成本），欠薪挂账累计，隐藏不满度上升
export function evilSalary(state) {
  const due = +(state.co.economics.salary * (state.scale || 1)).toFixed(1)
  state.evilCount = (state.evilCount || 0) + 1
  state.wageUnpaid = +((state.wageUnpaid || 0) + due).toFixed(2)
  state.balances['应付职工薪酬'] = +((state.balances['应付职工薪酬'] || 0) + due).toFixed(2)
  // 不满度累积：基础涨幅 + 随机波动 + 黑历史放大（越欠越怨）
  const bump = +(16 + Math.random() * 12 + (state.wageStrikes || 0) * 4).toFixed(1)
  state.wageDiscontent = Math.min(100, +((state.wageDiscontent || 0) + bump).toFixed(1))
  return `😈 你拖欠了本月工资（欠薪累计 ¥${state.wageUnpaid}万）。员工满意度下滑，不满度升至 ${Math.round(state.wageDiscontent)}，效率开始受损，罢工风险正在累积。`
}

// 邪道·税务调账：修改应纳税额（产生真实分录把税额做低），按调账次数定稽查概率
// ratio: 本次调减比例（0~0.9），调账金额 = 当前应交税费 × ratio
export function evilTaxAdjust(state, ratio = 0.5) {
  const due = +sumAccount(state.balances, '应交税费').toFixed(2)
  if (due <= 0) return `当前没有应纳税额可调整。`
  const cut = +(due * Math.min(0.9, Math.max(0, ratio))).toFixed(2)
  state.evilCount = (state.evilCount || 0) + 1
  state.taxAdjusts = (state.taxAdjusts || 0) + 1
  state.taxAdjustAmount = +((state.taxAdjustAmount || 0) + cut).toFixed(2)
  // 调账分录：借「应交税费」减少负债，贷「所得税费用」(红字冲减利润，使当期税更低)
  const entries = [
    ...mk('应交税费', cut, '所得税费用', cut, '调账：调减本期应纳税额（违规）'),
  ]
  applyBusiness(state, entries, '税务调账（违规）', state.month)
  return `😈 你通过调账把应纳税额调减了 ¥${cut}万（累计已调减 ¥${state.taxAdjustAmount}万）。账面少缴了税，但调账次数越多，被税务局稽查的概率越高。`
}

// 邪道·直接拖欠税款：把本期应缴税额挂账不缴，每日万分之五滞纳金
export function evilTaxOwe(state) {
  const due = +sumAccount(state.balances, '应交税费').toFixed(2)
  if (due <= 0) return `当前没有应纳税额可拖欠。`
  state.evilCount = (state.evilCount || 0) + 1
  state.taxOwed = +((state.taxOwed || 0) + due).toFixed(2)
  state.skippedTaxMonths = (state.skippedTaxMonths || 0) + 1
  // 应交税费仍挂账（不缴），下月计提滞纳金
  return `😈 你直接拖欠了本期税款 ¥${due}万（累计拖欠 ¥${state.taxOwed}万）。从拖欠之日起按日加收万分之五滞纳金，越拖越贵。`
}

// 罢工解决：玩家在罢工弹窗三选一
// option: 'full' 全额补发 | 'partial' 部分(50%)补发 | 'over' 超额(150%)补发
export function resolveStrike(state, option) {
  state.wageStrikes = (state.wageStrikes || 0) + 1 // 无论哪种都记一次黑历史
  const owed = state.wageUnpaid || 0
  const cash = state.balances['银行存款'] || 0
  let pay, note
  if (option === 'partial') {
    // 天赋·工会关系（strikeLossMult）：部分补发从 50% 提到 75%（损失减半）
    const effRatio = state.strikeLossMult ? 0.75 : 0.5
    pay = +(owed * effRatio).toFixed(2)
    state.wageDiscontent = Math.max(0, +((state.wageDiscontent || 0) - 40).toFixed(1))
    state.wageUnpaid = +(owed - pay).toFixed(2)
    note = `部分补发：发放 ¥${pay}万（欠薪还剩 ¥${state.wageUnpaid}万），不满度下降但仍未平复。${state.strikeLossMult ? '（工会调解，损失减轻）' : ''}`
  } else if (option === 'over') {
    pay = +(owed * 1.5).toFixed(2)
    state.wageDiscontent = 0
    state.wageUnpaid = 0
    note = `超额补发：发放 ¥${pay}万（含 50% 安抚金），员工感激，不满度清零、欠薪结清。`
  } else { // full
    pay = +owed.toFixed(2)
    state.wageDiscontent = 0
    state.wageUnpaid = 0
    note = `全额补发：发放 ¥${pay}万，欠薪结清、不满度清零，但这次罢工已记入黑历史。`
  }
  pay = Math.min(pay, +(cash + owed).toFixed(2)) // 不会凭空变出钱
  const entries = [
    ...mk('应付职工薪酬', Math.min(owed, pay), '银行存款', Math.min(owed, pay), `罢工后补发工资(${option})`),
  ]
  if (option === 'over' && pay > owed) {
    entries.push(...mk('管理费用-工资', +(pay - owed).toFixed(2), '银行存款', +(pay - owed).toFixed(2), '罢工安抚金(超额)'))
  }
  applyBusiness(state, entries, '罢工补发', state.month)
  state.pendingStrike = null
  state.strikeThisMonth = true
  return `🪧 罢工结束。${note}`
}

// 工资效率系数：受影响于隐藏不满度与本月罢工。返回 0.3~1
export function wageEfficiency(state) {
  const d = state.wageDiscontent || 0
  let f = 1 - (d / 100) * 0.45            // 不满度最高拉低 45% 效率
  if (state.strikeThisMonth) f *= 0.4    // 罢工当月再打四折
  return +Math.max(0.25, f).toFixed(3)
}

// 每月末滚动：欠税滞纳金（每日万分之五，按月 30 天计）
export function accrueTaxLateFee(state) {
  if ((state.taxOwed || 0) <= 0) return 0
  const fee = +(state.taxOwed * 0.0005 * 30).toFixed(3)
  state.taxLateFee = +((state.taxLateFee || 0) + fee).toFixed(3)
  return fee
}

// 每月末判定是否罢工：欠薪越多、不满度越高、黑历史越多，概率越大
export function rollStrike(state) {
  state.strikeThisMonth = false
  if ((state.wageUnpaid || 0) <= 0) return false
  const d = state.wageDiscontent || 0
  const p = Math.min(0.85, 0.05 + (d / 100) * 0.45 + (state.wageStrikes || 0) * 0.08)
  if (Math.random() <= p) {
    state.strikeThisMonth = true
    state.pendingStrike = { month: state.month }
    return true
  }
  return false
}

// 税务局稽查（调账 / 拖欠）：每月小概率，按调账次数与拖欠月数放大
export function taxAudit(state, month) {
  state.pendingAudit = null
  const adjustP = Math.min(0.6, 0.08 * (state.taxAdjusts || 0))      // 调账次数越多越易查
  const oweP = Math.min(0.5, 0.06 * (state.skippedTaxMonths || 0))  // 拖欠越久越易查
  let p = Math.max(adjustP, oweP)
  // 天赋·税务专家 / 法律顾问 / 羁绊·合规护城河·金身：概率系数
  p = +(p * (state.auditProbMult || 1) * (state.synergyTaxShield || 1)).toFixed(3)
  if (p <= 0) return null
  if (Math.random() > p) return null

  const year = state.year
  const events = []
  let entries = []
  state.auditHits = (state.auditHits || 0) + 1
  // 1) 调账虚减的税额：补回 + 0.5 倍罚款
  if ((state.taxAdjustAmount || 0) > 0) {
    const back = +state.taxAdjustAmount.toFixed(2)
    const fineRate = (state.fineMult != null ? state.fineMult : 0.5) * (state.auditFineMult || 1)
    const fine = +(back * fineRate).toFixed(2)
    entries.push(...mk('所得税费用', back, '应交税费', back, `税务稽查：调账不实，补回税款¥${back}万`))
    entries.push(...mk('所得税费用', fine, '银行存款', fine, `税务稽查罚款¥${fine}万`))
    events.push(`调账被查：补回税款¥${back}万、罚款¥${fine}万`)
    state.taxAdjustAmount = 0 // 已补回，累计虚减额清零
  }
  // 2) 直接拖欠的税款：补缴 + 滞纳金
  if ((state.taxOwed || 0) > 0) {
    const back = +state.taxOwed.toFixed(2)
    const late = +(state.taxLateFee || 0).toFixed(2)
    entries.push(...mk('应交税费', back, '银行存款', back, `税务稽查：补缴拖欠税款¥${back}万`))
    if (late > 0) entries.push(...mk('管理费用-滞纳金', late, '银行存款', late, `补缴滞纳金¥${late}万`))
    events.push(`拖欠被查：补缴税款¥${back}万${late > 0 ? `、滞纳金¥${late}万` : ''}`)
    state.taxOwed = 0; state.taxLateFee = 0; state.skippedTaxMonths = 0
  }
  if (entries.length) {
    applyBusiness(state, entries, `税务稽查（第${year}年${month}月）`, month)
  }
  const msg = `🚨 第${year}年${month}月税务稽查！${events.join('；')}。`
  state.pendingAudit = msg
  if (isBankrupt(state)) { state.failed = true; state.failedReason = msg }
  return msg
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
export function genOrder(state, rng = Math.random, opts = {}) {
  const co = state.co
  const base = co.economics.dealSize * (state.scale || 1)
  const sizeRoll = 0.6 + rng() * 0.9                 // 0.6~1.5 倍基准
  // 工资效率（不满度/罢工）直接压低可承接的生意规模，影响营收与成本
  const we = wageEfficiency(state)
  const amount = +(base * sizeRoll * moodFactor(state) * we).toFixed(2)
  const marginMult = (state.diffEcon && state.diffEcon.marginMult) || 1
  let margin = +(co.economics.margin * marginMult * (0.7 + rng() * 0.6)).toFixed(2) // 毛利率波动（受难度系数影响）
  // 天赋·爆款单品：第 1 张订单（或显式指定）毛利率 +15%
  if ((state.talentHitProduct || 0) && opts.hitProduct) {
    margin = Math.min(0.95, +(margin + 0.15).toFixed(2))
  }
  let creditRoll = rng()
  let credit = creditRoll < 0.45 ? 0 : creditRoll < 0.8 ? (rng() < 0.5 ? 1 : 2) : 3
  // 天赋·大客户通道：赊销回款期 3→2（credit 减少 creditTermBoost 个月），毛利 +5%
  if (state.creditTermBoost && credit > 0) credit = Math.max(1, credit - state.creditTermBoost)
  if (state.orderMarginBoost) margin = +(margin + state.orderMarginBoost).toFixed(2)
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
  // 每 3 个月左右触发一次，避免过密；难度越高（eventMult 越大）触发越频繁
  if (state.month % 3 !== 0) { return null }
  const eventMult = (state.diffEcon && state.diffEcon.eventMult) || 1
  // eventMult<1（简单模式）按概率跳过，让新手更平稳；eventMult>=1 正常触发
  if (eventMult < 1 && rng() > eventMult) {
    state.eventBuff = {}
    return null
  }
  // 进入新月前，清空上一个月的临时事件增益（避免永久叠加）
  state.eventBuff = {}
  const pick = pickWeightedEvent(rng)
  if (!pick) return null
  // 天赋·内幕消息：本事件触发时，把"下月倾向"写入 state（下月 rollRandomEvent 前 UI 可查）
  if (state.talentInsider) {
    // 简化：直接标记本月事件的 good/bad 供"提前 1 个月"展示（UI 读 state.lastEvent + talentInsider）
  }
  // 天赋修正：风险对冲 → bad 事件概率 ×0.5（命中 bad 时按概率"化解"成无效果）
  if (pick.tone === 'bad' && state.badEventMult && rng() > state.badEventMult) {
    // 事件被对冲化解：记录但不生效
    state.lastEvent = { id: pick.id + '_hedge', title: pick.title + '（已对冲）', emoji: '🛡️', desc: pick.desc, tone: 'neutral', month: state.month, hedged: true }
    return state.lastEvent
  }
  // 天赋·网红体质：good 事件 saleUp 幅度 +20%
  if (pick.tone === 'good' && state.talentInfluencer && pick.id === 'viral') {
    // viral 事件额外放大：saleUp 再 +0.2
    if (pick.effect) pick.effect(state)
    state.eventBuff.saleUp = (state.eventBuff.saleUp || 0) + 0.2
  } else if (pick.effect) {
    pick.effect(state)
  }
  const ev = { id: pick.id, title: pick.title, emoji: pick.emoji, desc: pick.desc, tone: pick.tone, month: state.month }
  state.lastEvent = ev
  // 天赋·内幕消息：记住本月事件倾向，下月初 UI 提示"下月可能…"（简化：直接读 lastEvent.tone）
  if (state.talentInsider) state.foreshadow = { forMonth: state.month + 1, tone: pick.tone }
  return ev
}

// 事件类型库：tone: good / bad / neutral
export const RANDOM_EVENTS = [
  {
    id: 'materialSpike', title: '原料涨价', emoji: '📈', tone: 'bad',
    desc: '上游原料普涨，本月采购成本上浮 20%。',
    effect: (s) => {
      // 天赋·双供应商：涨价影响 ×supplierRiskMult（0.5）
      const spike = 0.2 * (s.supplierRiskMult || 1)
      s.eventBuff.purchaseUp = (s.eventBuff.purchaseUp || 0) + spike
    },
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
  // —— 扩展事件（供应商/客户/政策/经营/突发，覆盖更多真实场景）——
  {
    id: 'supplierCut', title: '供应商优惠', emoji: '🧾', tone: 'good',
    desc: '老供应商季度返点，本月采购成本 -10%。',
    effect: (s) => { s.eventBuff.purchaseDown = (s.eventBuff.purchaseDown || 0) + 0.1 },
  },
  {
    id: 'clientArrears', title: '客户赖账', emoji: '😤', tone: 'bad',
    desc: '一笔赊销客户拖延付款，挂应收账款 ¥1.5万，下月才能收回。',
    effect: (s) => {
      applyBusiness(s, mk('应收账款', 1.5, '银行存款', 1.5, '客户赖账回款延迟'), s.month)
    },
  },
  {
    id: 'policyCUT', title: '研发新政', emoji: '🏛️', tone: 'good',
    desc: '政府出台研发新政，研发费用加计比例临时提高，本期可多抵 ¥0.5万税。',
    effect: (s) => { applyBusiness(s, mk('应交税费', 0.5, '营业外收入-税收减免', 0.5, '研发新政多抵税'), s.month) },
  },
  {
    id: 'staffRise', title: '集体加薪', emoji: '💪', tone: 'neutral',
    desc: '员工集体要求涨薪 8%，本月工资支出上浮。',
    effect: (s) => { s.eventBuff.salaryUp = (s.eventBuff.salaryUp || 0) + 0.08 },
  },
  {
    id: 'equipmentBreak', title: '设备故障', emoji: '🔧', tone: 'bad',
    desc: '核心设备损坏，紧急维修支出 ¥1.2万，本月收入 -10%。',
    effect: (s) => {
      applyBusiness(s, mk('管理费用-维修', 1.2, '银行存款', 1.2, '设备紧急维修'), s.month)
      s.eventBuff.saleUp = (s.eventBuff.saleUp || 0) - 0.1
    },
  },
  {
    id: 'pressCoverage', title: '媒体报道', emoji: '📰', tone: 'good',
    desc: '本地媒体报道了你的经营故事，品牌曝光提升，本月收入 +20%。',
    effect: (s) => { s.eventBuff.saleUp = (s.eventBuff.saleUp || 0) + 0.2 },
  },
  {
    id: 'powerOutage', title: '突发停电', emoji: '⚡', tone: 'bad',
    desc: '区域停电半天，部分订单无法履约，本月收入 -8%。',
    effect: (s) => { s.eventBuff.saleUp = (s.eventBuff.saleUp || 0) - 0.08 },
  },
  {
    id: 'taxRemit', title: '退税到账', emoji: '🏦', tone: 'good',
    desc: '上年度汇算清缴多缴税款退回，现金 +¥0.8万。',
    effect: (s) => { applyBusiness(s, mk('银行存款', 0.8, '应交税费-退税', 0.8, '退税到账'), s.month) },
  },
]

// 事件按权重随机：good/bad 大事件权重低，日常事件权重高
const EVENT_WEIGHTS = {
  materialSpike: 1.2, viral: 1.0, inspection: 0.8, staffLeave: 1.0,
  groupOrder: 1.0, rentFree: 0.7, refund: 1.0, subsidy: 0.7,
  supplierCut: 0.9, clientArrears: 0.9, policyCUT: 0.5, staffRise: 1.0,
  equipmentBreak: 0.9, pressCoverage: 0.8, powerOutage: 0.9, taxRemit: 0.6,
}

function pickWeightedEvent(rng) {
  const ids = Object.keys(EVENT_WEIGHTS)
  const total = ids.reduce((t, id) => t + (EVENT_WEIGHTS[id] || 1), 0)
  let roll = rng() * total
  for (const id of ids) {
    roll -= (EVENT_WEIGHTS[id] || 1)
    if (roll <= 0) return RANDOM_EVENTS.find((e) => e.id === id) || RANDOM_EVENTS[0]
  }
  return RANDOM_EVENTS[0]
}

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

// ---- 过程性成就检测（月度循环每步检查，返回新达成 badge id 列表） ----
// 与 checkMilestones 并列但面向 UserContext 徽章系统
export function checkProcessBadges(state) {
  const earned = []
  const has = (id) => (state.earnedBadges || []).includes(id)
  state.earnedBadges = state.earnedBadges || []
  const give = (id, cond) => { if (cond && !has(id)) { state.earnedBadges.push(id); earned.push(id) } }
  // 零失误（硬核模式通关且无错误凭证）
  give('cleanBook', state.difficulty === 'hardcore' && (state.errors || []).length === 0 && state.failed === false)
  // 诚信经营：从未邪道且满 12 个月
  give('noEvil', (state.evilCount || 0) === 0 && (state.month || 0) >= 12)
  return earned
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

// 轻量合规度：基于邪道/违规痕迹估算 0~100
export function complianceNow(state) {
  let score = 100
  score -= (state.taxAdjusts || 0) * 8 // 调账（虚增成本）次数
  score -= (state.taxOwed || 0) > 0 ? 25 : 0 // 直接拖欠税金
  score -= Math.min((state.skippedTaxMonths || 0), 6) * 3 // 欠税月数
  score -= (state.wageDiscontent || 0) * 3 // 欠薪不满度
  score -= (state.wageStrikes || 0) * 6 // 罢工次数
  return Math.max(0, Math.min(100, Math.round(score)))
}

// 关键财务指标快照
export function financialSnapshot(state) {
  const cash = +(state.balances['银行存款'] || 0) + (state.balances['库存现金'] || 0)
  const debt = liabilityTotal(state)
  const assets = totalAssets(state.balances)
  const netProfit = +(state.balances['本年利润'] || 0)
  const debtRatio = assets > 0 ? +(debt / assets * 100).toFixed(1) : 0
  return {
    cash: +cash.toFixed(2),
    debt: +debt.toFixed(2),
    assets: +assets.toFixed(2),
    netProfit: +netProfit.toFixed(2),
    debtRatio,
    compliance: complianceNow(state),
    revenue: +operatingRevenue(state).toFixed(2),
  }
}

// 每个分支选择后的财务分析与诊断
// before/after：选择前后的 state；action：本次决策 action 对象；ctx：可选 { title }
export function analyzeDecision(before, after, action, ctx = {}) {
  const snapBefore = financialSnapshot(before)
  const snapAfter = financialSnapshot(after)
  const dCash = +(snapAfter.cash - snapBefore.cash).toFixed(2)
  const dNet = +(snapAfter.netProfit - snapBefore.netProfit).toFixed(2)
  const dDebt = +(snapAfter.debt - snapBefore.debt).toFixed(2)
  const dComp = snapAfter.compliance - snapBefore.compliance

  const impacts = []
  const add = (label, v, good) => {
    if (v === 0) return
    const dir = v > 0 ? 'up' : 'down'
    impacts.push({ label, value: v, dir, good })
  }
  // 现金变化：多数经营现金流出为"负向但合理"，用 good 标记是否健康
  add('现金流（银行存款）', dCash, action?.type === 'fund' ? dCash > 0 : dCash >= 0)
  add('累计净利（本年利润）', dNet, dNet >= 0)
  add('总负债', dDebt, dDebt <= 0)
  if (dComp !== 0) add('合规度', dComp, dComp > 0)

  // 诊断结论
  const type = action?.type || ctx.type || 'unknown'
  let diagnosis = ''
  const cashLow = snapAfter.cash < 2
  const cashNeg = snapAfter.cash < 0
  const debtHigh = snapAfter.debtRatio > 70
  const loss = snapAfter.netProfit < 0
  const compLow = snapAfter.compliance < 50

  if (cashNeg) diagnosis = '⚠️ 现金已为负，资金链断裂风险极高，下月可能无法支付工资/税款，需立即融资或压缩开支。'
  else if (compLow) diagnosis = `⚠️ 合规度仅 ${snapAfter.compliance}/100，存在违规痕迹（欠税/欠薪/调账），后续被稽查、滞纳金或罢工风险上升，建议尽快合规化。`
  else if (debtHigh) diagnosis = '⚠️ 资产负债率偏高（>70%），财务杠杆过大，利息与还款压力会吞噬利润，注意偿债节奏。'
  else if (loss) diagnosis = '📉 当前累计净利为负，处于亏损状态，需提升毛利或控制固定费用改善盈利。'
  else if (cashLow) diagnosis = '⚠️ 现金逼近警戒线（<2万），流动性紧张，建议保留足够支付工资与税款的缓冲。'
  else diagnosis = '✅ 财务状况稳健，本次决策未触及重大风险。'

  // 针对分支的专项解读
  let focus = ''
  if (type === 'sale') {
    const gp = snapAfter.revenue > 0 ? Math.max(0, (snapAfter.netProfit)) : 0
    focus = `本次销售形成营收，现金与利润同步累积；毛利率取决于（售价-采购成本）结构。持续放量可摊薄固定费用。`
  } else if (type === 'purchase') {
    focus = `进货以现金/应付换取存货，短期占用${dCash < 0 ? '现金' : '资金'}但不立即影响利润，待销售结转成本时才体现毛利。注意存货积压会拖累周转。`
  } else if (type === 'salary') {
    if (action?.evil) focus = '⚠️ 你选择了拖欠工资。员工不满意度上升，将降低工作效率（营收与利润受损），并累积罢工概率；罢工记录会放大后续风险。'
    else focus = '工资按时足额发放，团队稳定，不影响效率。人力成本是固定费用，需营收覆盖。'
  } else if (type === 'rent' || type === 'utilities') {
    focus = '房租/水电为固定费用，直接冲减当期利润，与销量无关，需靠营收规模摊薄。'
  } else if (type === 'tax') {
    const plans = action?.plans || []
    if (action?.evil === 'adjust') focus = '⚠️ 你通过调账虚增成本少缴税。短期降税，但调账次数越多，被税务稽查补税+滞纳金的概率越高，合规度下降。'
    else if (action?.evil === 'owe') focus = '⚠️ 你直接拖欠税款。每日产生万分之五滞纳金持续累积，且欠税记录拉低信用评级与合规度。'
    else if (plans.length) focus = `本次选用了合法税务筹划（${plans.join('、')}），在合规前提下降低税负，值得鼓励。`
    else focus = '本次按法定税率足额纳税，合规无风险，但未用足政策红利。'
  } else if (type === 'expand') {
    focus = `扩张${dDebt > 0 ? '增加了负债（借款）' : ''}${dCash < 0 ? '并消耗现金' : ''}，换取产能/规模上限提升，未来可承接更大订单，但需营收跟上以覆盖新增利息与折旧。`
  } else if (type === 'invest') {
    focus = action?.level === 'high'
      ? '高投入前置成本已支出，未来每笔销售规模放大 25%，属高风险高回报，需后续营收兑现。'
      : '低投入无前置成本，营收小幅提升，更稳健。'
  } else if (type === 'fund') {
    focus = `融资带来现金流入${dDebt > 0 ? '，但同时增加负债与利息负担' : ''}，用于补血或扩张，注意负债率不要失控。`
  } else if (type === 'taxType') {
    focus = action?.value === 'general'
      ? '转为一般纳税人：可抵扣进项税，适合进项充足的企业；但税率较高，需规范开票。'
      : '保持/转小规模纳税人：征收率较低、申报简单，但不得抵扣进项，规模受限（年销售额≤500万）。'
  } else if (action?.evil) {
    focus = '⚠️ 本次为"邪道"操作，短期利好现金/利润，但累积违规痕迹，后续被稽查、罢工或信用受损的概率上升。'
  } else if (type === 'monthEnd') {
    const parts = []
    if ((snapAfter.cash - snapBefore.cash) < 0) parts.push('本月现金净流出')
    else parts.push('本月现金净流入')
    if (snapAfter.debtRatio > snapBefore.debtRatio) parts.push('杠杆上升')
    if (snapAfter.compliance < snapBefore.compliance) parts.push('合规度下降（存在违规痕迹）')
    focus = `月末结账完成：计提折旧、结转损益${parts.length ? '；' + parts.join('，') : ''}。若曾拖欠工资/税款，本月已累积滞纳金或罢工风险，需关注下月现金流与合规度。`
  }

  const title = ctx.title || ({
    sale: '销售业务', purchase: '采购进货', salary: '发放工资', rent: '支付房租',
    utilities: '水电费', tax: '纳税申报', expand: '扩张投资', invest: '经营投入',
    fund: '融资筹资', taxType: '纳税人身份',
  }[type] || '经营决策')

  return {
    title,
    impacts,
    diagnosis,
    focus,
    snapshot: snapAfter,
    alert: cashNeg || debtHigh || loss || snapAfter.compliance <= 40,
  }
}
