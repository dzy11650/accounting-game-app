/**
 * 天赋卡系统（roguelike 开局三选一 + 每年追加，上限 3 张）
 *
 * 设计原则：
 * - 每张卡必须能用会计语言说清楚（learn 字段）
 * - effect 是纯函数：(state, ctx) => void，只改 state，不产生副作用
 * - rarity: 'common' | 'rare' | 'cost'（代价卡）
 * - family: 6 族之一
 * - synergy: 跨族特殊羁绊（选满 2 张时触发）
 */

// 6 族定义
export const FAMILIES = {
  revenue: { id: 'revenue', name: '💰 营收族', color: '#E5484D' },
  cost: { id: 'cost', name: '🧾 成本族', color: '#F39C12' },
  finance: { id: 'finance', name: '🏦 资金族', color: '#3498DB' },
  resilience: { id: 'resilience', name: '🛡️ 韧性族', color: '#27AE60' },
  info: { id: 'info', name: '📊 信息族', color: '#9B59B6' },
  tax: { id: 'tax', name: '⚖️ 税务族', color: '#16A085' },
}

// 羁绊定义（同族 2 张 + 跨族特殊 2 组）
export const SYNERGIES = {
  // 同族羁绊
  revenue2: { need: 2, family: 'revenue', id: 'revenue2', name: '规模效应', desc: 'boost 额外 +0.05', effect: (s) => { s.boost = (s.boost || 0) + 0.05 } },
  cost2: { need: 2, family: 'cost', id: 'cost2', name: '精益管理', desc: '随机事件 bad 收益再 -5%', effect: (s) => { s.synergyCostBad = 0.95 } },
  finance2: { need: 2, family: 'finance', id: 'finance2', name: '资本厚垫', desc: '破产兜底 1 次变 2 次', effect: (s) => { s.rescueLimit = 2 } },
  resilience2: { need: 2, family: 'resilience', id: 'resilience2', name: '反脆弱', desc: '被 bad 事件命中后下月自动 saleUp +10%', effect: (s) => { s.synergyResilient = true } },
  info2: { need: 2, family: 'info', id: 'info2', name: '决策雷达', desc: '每月多 1 条经营预警 toast', effect: (s) => { s.synergyInfoAlerts = true } },
  tax2: { need: 2, family: 'tax', id: 'tax2', name: '合规护城河', desc: '稽查概率再 ×0.8', effect: (s) => { s.synergyTaxShield = 0.8 } },
  // 跨族特殊羁绊
  taxHedge: {
    need: 2, families: ['tax', 'resilience'], id: 'taxHedge', name: '金身',
    desc: '税务专家 + 风险对冲 = 稽查概率 ×0.3', effect: (s) => { s.synergyTaxShield = Math.min(s.synergyTaxShield || 1, 0.3) }
  },
  financeInfo: {
    need: 2, families: ['finance', 'info'], id: 'financeInfo', name: '资本雷达',
    desc: '资金 + 信息 = 每月末显示下月现金流预测', effect: (s) => { s.synergyCashForecast = true }
  },
}

// 天赋池：基础 20 张（6 族×3）+ 补充 10 张 = 30 张（每族 5 张，2c+2r+1c 混合稀有度）
// 代价卡池（rarity='cost'）：二期实现，hardcore 模式下 pickTalents 会抽入
export const TALENTS = [
  // ===== 💰 营收族（3 张）=====
  {
    id: 'flagshipStore', family: 'revenue', rarity: 'common', name: '招牌老店', emoji: '🏪',
    desc: '品牌认知度提升，所有销售规模 +15%。',
    learn: '营销投入进「管理费用」换营收规模——这是资本化前的费用化，一次性投入换长期收益。',
    effect: (s) => { s.boost = (s.boost || 0) + 0.15 },
  },
  {
    id: 'hitProduct', family: 'revenue', rarity: 'common', name: '爆款单品', emoji: '🔥',
    desc: '每月订单生成器必出 1 张高毛利单（margin +15%）。',
    learn: '毛利率 =（营收-成本）/营收。爆款靠高毛利而非高单价，库存周转更快。',
    effect: (s) => { s.talentHitProduct = true },
  },
  {
    id: 'influencer', family: 'revenue', rarity: 'rare', name: '网红体质', emoji: '📱',
    desc: 'viral 事件触发率 +50%，且 saleUp 幅度 +20%。偶发收入不可持续，别靠它做预算。',
    learn: '偶然收益进「营业外收入」，不进利润表主线——别拿它当经营基本盘。',
    effect: (s) => { s.talentInfluencer = true },
  },

  // ===== 🧾 成本族（3 张）=====
  {
    id: 'groupBuy', family: 'cost', rarity: 'common', name: '集采联盟', emoji: '📦',
    desc: '加入采购联盟，所有采购成本永久 -5%。',
    learn: '批量采购享受现金折扣，进价更低——成本科目（主营业务成本）直接下降。',
    effect: (s) => { s.purchaseDown = (s.purchaseDown || 0) + 0.05 },
  },
  {
    id: 'energyUpgrade', family: 'cost', rarity: 'common', name: '节能改造', emoji: '⚡',
    desc: '固定资产折旧月额 ×0.7。前期设备费不变，长期费用化支出更低。',
    learn: '资本性支出（固定资产） vs 费用化支出（折旧）——改设备是资产减值，不是当月费用。',
    effect: (s) => { s.depreciationMult = 0.7 },
  },
  {
    id: 'flexTeam', family: 'cost', rarity: 'rare', name: '兼职团队', emoji: '👥',
    desc: '工资成本 -10%，但事件 buff 收益 -10%。灵活用工省固定人工，但响应慢。',
    learn: '固定 vs 可变人工成本——兼职是可变成本（随量变动），全职是固定成本。',
    effect: (s) => { s.salaryMult = 0.9; s.buffMult = 0.9 },
  },

  // ===== 🏦 资金族（3 张）=====
  {
    id: 'angelInvest', family: 'finance', rarity: 'common', name: '天使投资', emoji: '👼',
    desc: '开局注入实收资本 +50%（放大 applyFunding 基数）。',
    learn: '实收资本是权益不是负债——股东出资借 银行存款 / 贷 实收资本，不产生利息。',
    effect: (s) => { s.angelBoost = 0.5 }, // applyFunding 时读取
  },
  {
    id: 'reserveFund', family: 'finance', rarity: 'common', name: '备用金', emoji: '💵',
    desc: '每月末自动从本年利润拨 10% 入「储备金」科目，破产前兜底 1 次。',
    learn: '留存收益与资本保全——留一分现金抗风险，是「资本充足率」的朴素版。',
    effect: (s) => { s.talentReserve = true },
  },
  {
    id: 'bridgeLoan', family: 'finance', rarity: 'rare', name: '过桥融资', emoji: '🏗️',
    desc: '开局赠 ¥10 万短期借款（利率 +0.2%），规模放大但有利息负担。',
    learn: '财务杠杆的代价——借款进「短期借款」（负债），利息进「财务费用」抵税但侵蚀利润。',
    effect: (s) => { s.bridgeLoan = 10; s.bridgeRateBoost = 0.002 },
  },

  // ===== 🛡️ 韧性族（3 张）=====
  {
    id: 'hedgeRisk', family: 'resilience', rarity: 'common', name: '风险对冲', emoji: '🛡️',
    desc: 'bad 随机事件概率 ×0.5。保险是费用不是资产。',
    learn: '保险费进「管理费用」（费用化），不挂在资产侧——买的是「不确定性消除」。',
    effect: (s) => { s.badEventMult = 0.5 },
  },
  {
    id: 'unionBond', family: 'resilience', rarity: 'common', name: '工会关系', emoji: '✊',
    desc: '欠薪不满度累积 ×0.6，罢工三选一中「部分补发」损失减半。',
    learn: '员工薪酬的刚性——欠薪是「应付职工薪酬」（负债），罢工是或有负债爆发。',
    effect: (s) => { s.wageDiscontentMult = 0.6; s.strikeLossMult = 0.5 },
  },
  {
    id: 'legalAdvisor', family: 'resilience', rarity: 'rare', name: '法律顾问', emoji: '⚖️',
    desc: 'taxAudit 罚款 ×0.5，稽查概率 ×0.7。专业服务换风险底线。',
    learn: '法律顾问费进「管理费用」——专业服务费是期间费用，不是资产。',
    effect: (s) => { s.auditFineMult = 0.5; s.auditProbMult = 0.7 },
  },

  // ===== 📊 信息族（3 张）=====
  {
    id: 'transparentBooks', family: 'info', rarity: 'common', name: '透明账本', emoji: '📖',
    desc: '决策分析卡多显示 2 项指标（负债率、合规度）。',
    learn: '财务分析颗粒度——多一个指标，决策多一个维度。报表不是给税务局看的，是给自己看的。',
    effect: (s) => { s.infoLevel = 2 },
  },
  {
    id: 'budgetEye', family: 'info', rarity: 'common', name: '预算之眼', emoji: '👁️',
    desc: '每月末提前显示下月固定费用合计（折旧+利息+工资）。',
    learn: '权责发生制·预提——费用按受益期确认，不看出没出现金。提前知道才能安排。',
    effect: (s) => { s.talentBudgetEye = true },
  },
  {
    id: 'dataBoard', family: 'info', rarity: 'rare', name: '数据看板', emoji: '📈',
    desc: '订单面板显示每张单的预计现金流影响（不只是毛利）。',
    learn: '营收 ≠ 现金流入——赊销单回款 3 个月，毛利高不代表当期有钱。',
    effect: (s) => { s.talentDataBoard = true },
  },

  // ===== ⚖️ 税务族（3 张）=====
  {
    id: 'taxExpert', family: 'tax', rarity: 'common', name: '税务专家', emoji: '🧾',
    desc: '稽查概率 ×0.5，调账罚款 0.5→0.3 倍。',
    learn: '合规边界——依法纳税是义务，筹划是权利。专家帮你踩线但不越线。',
    effect: (s) => { s.auditProbMult = Math.min(s.auditProbMult || 1, 0.5); s.fineMult = 0.3 },
  },
  {
    id: 'rndPro', family: 'tax', rarity: 'common', name: '研发加计 Pro', emoji: '🔬',
    desc: '研发加计 100%→120%（仅科技类企业）。',
    learn: '税收优惠的门槛——加计扣除是国家鼓励创新的「财政补贴」，不是白捡的钱。',
    effect: (s) => { s.rndSuperBoost = 0.2 },
  },
  {
    id: 'microWhite', family: 'tax', rarity: 'rare', name: '小微白名单', emoji: '✅',
    desc: '小微企业优惠自动适用（不用手动选 plan）。年所得 ≤300 万自动按 5% 所得税。',
    learn: '政策自动享受——合规的小微企业默认享受优惠，不用申请。',
    effect: (s) => { s.talentMicroWhite = true },
  },
  {
    id: 'govSubsidy', family: 'finance', rarity: 'rare', name: '政府贴息', emoji: '🏛️',
    desc: '借款利息 -50%（财政贴息补助冲减财务费用）。',
    learn: '政府补助——贴息直接冲减「财务费用-利息」，比直接给现金更划算（省的是持续支出）。',
    effect: (s) => { s.interestMult = 0.5 },
  },
  {
    id: 'peerBench', family: 'info', rarity: 'rare', name: '同行对标', emoji: '🏁',
    desc: '结算时给出同公司类型 NPC 对照线，直观看自己赢在哪。',
    learn: '相对评价——财务指标脱离行业看没意义，同类型公司对比才有意义。',
    effect: (s) => { s.talentPeerBench = true },
  },

// 抽卡函数：按难度出 3 张
// easy: 3 张 common
// hard: 2 张 common + 1 张 rare
// hardcore: 1 张 common + 1 张 rare + 1 张 cost（代价卡，二期实现，先返回 common+rare+random）
  // ===== 补充第 2 批（10 张，每族 +1 common / +1 rare 交替）=====
  {
    id: 'allIn', family: 'revenue', rarity: 'cost', name: '全押爆款', emoji: '🎲',
    desc: '每 3 月 30% 概率流水翻倍，否则当月营收 -20%。',
    learn: '方差与期望——收益 = 0.3×2 + 0.7×0.8 = 1.06，期望略正但波动大。高方差策略适合有现金流缓冲时。',
    effect: (s) => { s.rndAllIn = true },
  },
  {
    id: 'aggressiveOutsourcing', family: 'cost', rarity: 'cost', name: '极限外包', emoji: '📑',
    desc: '成本 -20%，但邪道风险（罢工/稽查概率）+10%。',
    learn: '成本转嫁——外包省的是当期费用，但合规与劳工风险转为或有负债，迟早要还。',
    effect: (s) => { s.costCutMult = 0.8; s.evilRiskBoost = 0.1 },
  },
  {
    id: 'performanceBet', family: 'finance', rarity: 'cost', name: '对赌条款', emoji: '📉',
    desc: '实收资本 +80%，但年终若亏损则强制追加借款 ¥15 万。',
    learn: '或有负债与业绩承诺——赌赢了权益厚，赌输了负债压顶，是「双刃剑」式资本结构。',
    effect: (s) => { s.angelBoost = 0.8; s.performanceBet = true },
  },
  {
    id: 'highRiskEvent', family: 'resilience', rarity: 'cost', name: '激进扩张', emoji: '⚠️',
    desc: '营收 +20%，但 bad 事件频率 +30%。',
    learn: '风险与收益成正比——扩张放大所有变量，好的坏的都放大。',
    effect: (s) => { s.salePriceBoost = 0.2; s.badEventFreqMult = 1.3 },
  },
  {
    id: 'greyZone', family: 'tax', rarity: 'cost', name: '灰色地带', emoji: '🌫️',
    desc: '当期所得税 -20%，但稽查概率 +15%、罚款 ×1.2。',
    learn: '风险与收益的会计量化——偷税省的是当期费用，查出来要补税 + 罚款 + 滞纳金，期望值算过再决定。',
    effect: (s) => { s.taxCutMult = 0.8; s.auditProbBoost = 0.15; s.auditFineMult = (s.auditFineMult || 1) * 1.2 },
  },
  {
    id: 'leverageMax', family: 'finance', rarity: 'cost', name: '高杠杆玩法', emoji: '📊',
    desc: '借款上限 +50%，但利息绝对值同步放大。',
    learn: '财务杠杆——放大收益也放大风险，利息抵税是「税盾」但绝对值在涨。',
    effect: (s) => { s.leverageBoost = 0.5 },
  },
  {
    id: 'fastTurn', family: 'revenue', rarity: 'cost', name: '快进快出', emoji: '🏃',
    desc: '回款期 3→1 月，但毛利率 -8%（低价快销）。',
    learn: '周转率与毛利率权衡——快周转省现金但让毛利，「薄利多销」的取舍。',
    effect: (s) => { s.creditTermBoost = 2; s.orderMarginBoost = -0.08 },
  },
  {
    id: 'costCut', family: 'cost', rarity: 'cost', name: '极致降本', emoji: '✂️',
    desc: '所有费用 -15%，但服务质量下降，营收 -10%。',
    learn: '成本与服务——省的是费用，丢的是客户，营收和成本要一起看。',
    effect: (s) => { s.allCostMult = 0.85; s.salePriceBoost = -0.10 },
  },
  {
    id: 'taxAggressive', family: 'tax', rarity: 'cost', name: '激进税务筹划', emoji: '🧮',
    desc: '合法筹划上限 +20%，但每次邪道稽查概率 +5%。',
    learn: '筹划与偷税的边界——合法筹划有上限，越线就是偷逃税，稽查概率随之上升。',
    effect: (s) => { s.planBoostMult = 1.2; s.evilRiskBoost = (s.evilRiskBoost || 0) + 0.05 },
  },
  {
    id: 'infoEdge', family: 'info', rarity: 'cost', name: '情报优势', emoji: '👁️',
    desc: '决策分析提前 1 步显示，但每月 +¥0.3 万咨询费。',
    learn: '信息成本——提前看到结果要付费，「数据看板」不是免费的。',
    effect: (s) => { s.consultFee = 0.3 },
  },

// 抽卡函数：按难度出 3 张
// easy: 3 张 common
// hard: 2 张 common + 1 张 rare
// hardcore: 1 张 common + 1 张 rare + 1 张 cost（代价卡）
  {
    id: 'vipChannel', family: 'revenue', rarity: 'rare', name: '大客户通道', emoji: '🤝',
    desc: '赊销回款期 3→2 个月，订单毛利 +5%。',
    learn: '应收账款周转天数缩短——回款越快，现金越少被占用；毛利 +5% 来自大客户采购规模效应。',
    effect: (s) => { s.creditTermBoost = 1; s.orderMarginBoost = 0.05 }, // credit 3 减 1；订单毛利 +5%
  },
  {
    id: 'priceLeader', family: 'revenue', rarity: 'common', name: '价格战红利', emoji: '💸',
    desc: '竞争者退出，你的售价 +8%（营收放大）。',
    learn: '价格弹性——竞争减少时提价不丢量，是「卖方市场」的红利。营收=量×价。',
    effect: (s) => { s.salePriceBoost = 0.08 },
  },
  {
    id: 'leanOps', family: 'cost', rarity: 'rare', name: '精益运营', emoji: '⚙️',
    desc: '管理费用（房租/折旧/工资以外）-8%。',
    learn: '期间费用控制——管理费用不进成本（主营业务成本），直接影响利润率。',
    effect: (s) => { s.mgmtMult = 0.92 },
  },
  {
    id: 'bulkSupplier', family: 'cost', rarity: 'common', name: '大宗直采', emoji: '🚛',
    desc: '跳过中间商，采购成本 -8%。',
    learn: '采购链层级——每一级中间商都加价，直采省下的是毛利空间。',
    effect: (s) => { s.purchaseDown = (s.purchaseDown || 0) + 0.08 },
  },
  {
    id: 'cashFlowKing', family: 'finance', rarity: 'common', name: '现金流纪律', emoji: '📏',
    desc: '每月末自动把 5% 利润转入现金储备（比备用金更轻，不占用破产兜底次数）。',
    learn: '现金为王——利润≠现金，留现金才有抗风险能力（这是「备用金」的轻量版）。',
    effect: (s) => { s.talentLightReserve = 0.05 },
  },
  {
    id: 'fastCredit', family: 'finance', rarity: 'rare', name: '快速融资', emoji: '🚀',
    desc: '借款利率 -20%（信用好，银行给优惠利率）。',
    learn: '融资成本——利率越低，财务费用越小；信用越好，融资越便宜。',
    effect: (s) => { s.loanRateMult = 0.8 },
  },
  {
    id: 'safeInventory', family: 'resilience', rarity: 'common', name: '安全库存', emoji: '📦',
    desc: '断货/跌价损失减半，但资金占用 +5%（采购额放大 5%）。',
    learn: '存货计价与周转——多备货防断货，但钱压在仓库里（资产），周转慢了。',
    effect: (s) => { s.safetyStockMult = 0.5; s.stockTieMult = 1.05 },
  },
  {
    id: 'dualSupplier', family: 'resilience', rarity: 'rare', name: '双供应商', emoji: '🔀',
    desc: '原料涨价事件影响 -50%（供应链集中度风险降低）。',
    learn: '供应链多元化——鸡蛋不放一个篮子里，单一供应商涨价的影响被摊薄。',
    effect: (s) => { s.supplierRiskMult = 0.5 },
  },
  {
    id: 'insiderInfo', family: 'info', rarity: 'common', name: '内幕消息', emoji: '🕵️',
    desc: '提前 1 个月知道下月随机事件是 good 还是 bad（不显示具体内容）。',
    learn: '预期与披露——知情方能提前调整预算（如 bad 月少进货），信息差是决策优势。',
    effect: (s) => { s.talentInsider = true },
  },
  {
    id: 'rndProMax', family: 'tax', rarity: 'common', name: '税收返补', emoji: '🧧',
    desc: '缴税后，按实缴所得税 10% 返补到现金（政府奖励）。',
    learn: '财政补贴冲减——返补进「营业外收入」，是税后的「意外之财」，不能抵减利润本身。',
    effect: (s) => { s.taxRebate = 0.1 },
  },
]
/**
 * @param {string} diffId 难度
 * @param {Function} rng 随机源
 * @param {object} opts
 * @param {string[]} opts.metaUnlocked 已用局外金币解锁的天赋 id（开局必出 1 张）
 * @param {number} opts.freeSlots 局外等级带来的额外免费天赋位（0~2）
 */
export function pickTalents(diffId, rng = Math.random, opts = {}) {
  const commons = TALENTS.filter((t) => t.rarity === 'common')
  const rares = TALENTS.filter((t) => t.rarity === 'rare')
  const costs = TALENTS.filter((t) => t.rarity === 'cost')
  const shuffled = (arr) => [...arr].sort(() => rng() - 0.5)

  let picked = []
  if (diffId === 'easy') {
    picked = shuffled(commons).slice(0, 3)
  } else if (diffId === 'hard') {
    const c = shuffled(commons); const r = shuffled(rares)
    picked = [c[0], c[1], r[0]]
  } else {
    const c = shuffled(commons); const r = shuffled(rares); const k = shuffled(costs)
    picked = [c[0], r[0], k[0] || c[1]]
  }
  // 去重
  const seen = new Set()
  picked = picked.filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
  // 补满 3 张
  if (picked.length < 3) {
    const rest = shuffled(TALENTS.filter((t) => !seen.has(t.id)))
    picked.push(...rest.slice(0, 3 - picked.length))
  }

  // —— 局外成长注入 ——
  const metaUnlocked = opts.metaUnlocked || []
  const freeSlots = opts.freeSlots || 0

  // 1) 已解锁天赋必出 1 张（替换第 1 位）
  if (metaUnlocked.length > 0) {
    const metaPick = TALENTS.find((t) => metaUnlocked.includes(t.id))
    if (metaPick) {
      picked[0] = metaPick
      seen.add(metaPick.id)
    }
  }

  // 2) 局外等级免费天赋位：freeSlots 张额外卡（追加到 picked，UI 侧允许选更多张）
  // 简化：把前 freeSlots 张标记为"免费位"，由 Game.jsx 根据 freeSlots 决定可选张数
  const freePicks = []
  const metaPool = shuffled(metaUnlocked.map((id) => TALENTS.find((t) => t.id === id)).filter(Boolean))
  for (let i = 0; i < freeSlots && i < metaPool.length; i++) {
    freePicks.push(metaPool[i])
  }

  return { picks: picked.slice(0, 3), freePicks, freeSlots }
}

// 应用天赋：执行 effect + 检查羁绊
export function applyTalent(state, talent) {
  if (!talent) return state
  talent.effect(state)
  state.talents = state.talents || []
  if (!state.talents.includes(talent.id)) state.talents.push(talent.id)
  // 检查羁绊
  checkSynergy(state)
  return state
}

// 检查羁绊：同族 2 张 + 跨族特殊 2 组
export function checkSynergy(state) {
  const talents = state.talents || []
  if (talents.length < 2) return
  state.synergies = state.synergies || []
  const give = (id, cond) => {
    if (cond && !state.synergies.includes(id)) {
      state.synergies.push(id)
      const syn = Object.values(SYNERGIES).find((s) => s.id === id)
      if (syn) syn.effect(state)
    }
  }
  const famCount = (fam) => talents.filter((t) => TALENTS.find((x) => x.id === t)?.family === fam).length

  // 同族羁绊
  for (const fam of ['revenue', 'cost', 'finance', 'resilience', 'info', 'tax']) {
    give(fam + '2', famCount(fam) >= 2)
  }
  // 跨族羁绊
  give('taxHedge', famCount('tax') >= 1 && famCount('resilience') >= 1)
  give('financeInfo', famCount('finance') >= 1 && famCount('info') >= 1)
}
