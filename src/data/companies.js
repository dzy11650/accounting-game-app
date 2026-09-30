// 公司类型配置：5 种经营模式，难度递增，专属科目与分录规则不同
// difficulty: 1 简单 ... 5 困难

export const COMPANIES = [
  {
    id: 'shop',
    name: '小生意（奶茶店）',
    emoji: '🍜',
    difficulty: 1,
    blurb: '街角奶茶店，科目少、流程简单，最适合零基础入门。',
    // 初始可选资金（万元）
    initCash: 20,
    // 经营经济参数（万元 / 月）：不同企业差别巨大
    economics: {
      rent: 0.3,            // 月房租
      salary: 0.5,          // 月工资
      interestRate: 0.005,  // 借款月利率
      dealSize: 2,          // 单笔进货/销售基准规模
      margin: 0.4,          // 毛利率
    },
    // 折旧规则：设备原值、月折旧
    fixedAssets: [{ name: '制冰机/封口机', value: 3, monthlyDep: 0.1 }],
    // 专属采购分录模板（返回 entries）
    purchase: (amt) => ([
      { side: 'debit', account: '库存商品', amount: amt },
      { side: 'credit', account: '银行存款', amount: amt },
    ]),
    // 结转成本模板
    costOfSale: (amt) => ([
      { side: 'debit', account: '主营业务成本', amount: amt },
      { side: 'credit', account: '库存商品', amount: amt },
    ]),
    // 收入科目
    revenueAccount: '主营业务收入',
    // 成本科目（利润表用）
    costAccount: '主营业务成本',
    // 经营项目：同一品类下可细分不同产品线，参数略有差异
    projects: [
      { id: 'milktea', name: '经典奶茶', emoji: '🧋', blurb: '走量快、毛利高、单价低，最适合练手。', econ: { margin: 0.45, dealSize: 2 } },
      { id: 'bake', name: '烘焙甜品', emoji: '🍰', blurb: '客单价更高、损耗大，对库存周转要求高。', econ: { margin: 0.5, dealSize: 1.5, rent: 0.35 } },
      { id: 'fruittea', name: '鲜果茶', emoji: '🍓', blurb: '原材料鲜度要求高，损耗与采购节奏更难把控。', econ: { margin: 0.42, dealSize: 2, salary: 0.6 } },
    ],
  },
  {
    id: 'tech',
    name: '科技公司',
    emoji: '💡',
    difficulty: 3,
    blurb: '做软件订阅，有研发、服务器摊销、股权融资，分录更丰富。',
    initCash: 50,
    economics: {
      rent: 0.8, salary: 1.5, interestRate: 0.006, dealSize: 3, margin: 0.6,
    },
    fixedAssets: [{ name: '服务器/办公设备', value: 10, monthlyDep: 0.4 }],
    purchase: (amt) => ([
      { side: 'debit', account: '研发支出-材料', amount: amt },
      { side: 'credit', account: '银行存款', amount: amt },
    ]),
    costOfSale: (amt) => ([
      { side: 'debit', account: '主营业务成本', amount: amt },
      { side: 'credit', account: '库存商品', amount: amt },
    ]),
    revenueAccount: '主营业务收入-订阅',
    costAccount: '主营业务成本',
    // 经营项目
    projects: [
      { id: 'saas', name: 'SaaS 订阅', emoji: '💻', blurb: '高复购、近乎零边际成本，毛利天花板最高。', econ: { margin: 0.7, dealSize: 3 } },
      { id: 'game', name: '游戏发行', emoji: '🎮', blurb: '爆款波动大、流水高但分成与买量成本高。', econ: { margin: 0.55, dealSize: 4, salary: 1.8 } },
      { id: 'ai', name: 'AI 工具', emoji: '🤖', blurb: '前沿赛道，研发与算力（服务器）投入重。', econ: { margin: 0.6, dealSize: 3, rent: 1.0 } },
    ],
    // 专属：研发资本化 -> 无形资产
    capitalizeRnd: (amt) => ([
      { side: 'debit', account: '无形资产-软件', amount: amt },
      { side: 'credit', account: '研发支出-材料', amount: amt },
    ]),
    amortize: (amt) => ([
      { side: 'debit', account: '管理费用-摊销', amount: amt },
      { side: 'credit', account: '累计摊销', amount: amt },
    ]),
  },
  {
    id: 'factory',
    name: '工厂',
    emoji: '🏭',
    difficulty: 4,
    blurb: '重资产制造，原材料→生产成本→库存商品，折旧与人工是大头。',
    initCash: 100,
    economics: {
      rent: 1.5, salary: 3, interestRate: 0.005, dealSize: 6, margin: 0.25,
    },
    fixedAssets: [{ name: '厂房设备', value: 40, monthlyDep: 1.5 }],
    purchase: (amt) => ([
      { side: 'debit', account: '原材料', amount: amt },
      { side: 'credit', account: '银行存款', amount: amt },
    ]),
    // 工厂：生产领料
    produce: (amt) => ([
      { side: 'debit', account: '生产成本', amount: amt },
      { side: 'credit', account: '原材料', amount: amt },
    ]),
    costOfSale: (amt) => ([
      { side: 'debit', account: '主营业务成本', amount: amt },
      { side: 'credit', account: '库存商品', amount: amt },
    ]),
    revenueAccount: '主营业务收入-产成品',
    costAccount: '主营业务成本',
    // 经营项目
    projects: [
      { id: 'auto', name: '汽车配件', emoji: '🚗', blurb: '订单大、账期长，应收应付与存货管理是难点。', econ: { margin: 0.22, dealSize: 7 } },
      { id: 'cloth', name: '服装制造', emoji: '👕', blurb: '季节性强、库存跌价风险高，对周转要求极高。', econ: { margin: 0.3, dealSize: 5 } },
      { id: 'food', name: '食品加工', emoji: '🍞', blurb: '原料涨跌频繁、保质期短，损耗与采购节奏难。', econ: { margin: 0.2, dealSize: 6, rent: 1.7 } },
    ],
  },
  {
    id: 'trade',
    name: '贸易公司',
    emoji: '🚚',
    difficulty: 3,
    blurb: '大宗商品买卖，常赊销赊购，应收应付与汇兑风险突出。',
    initCash: 60,
    economics: {
      rent: 0.6, salary: 1.0, interestRate: 0.005, dealSize: 4, margin: 0.3,
    },
    fixedAssets: [{ name: '仓库/车辆', value: 15, monthlyDep: 0.5 }],
    purchase: (amt, onCredit) => onCredit ? ([
      { side: 'debit', account: '库存商品', amount: amt },
      { side: 'credit', account: '应付账款', amount: amt },
    ]) : ([
      { side: 'debit', account: '库存商品', amount: amt },
      { side: 'credit', account: '银行存款', amount: amt },
    ]),
    costOfSale: (amt) => ([
      { side: 'debit', account: '主营业务成本', amount: amt },
      { side: 'credit', account: '库存商品', amount: amt },
    ]),
    revenueAccount: '主营业务收入',
    costAccount: '主营业务成本',
    // 经营项目
    projects: [
      { id: 'elec', name: '电子数码', emoji: '📱', blurb: '单价高、更新快、贬值猛，库存管理是命门。', econ: { margin: 0.28, dealSize: 5 } },
      { id: 'energy', name: '能源化工', emoji: '🛢️', blurb: '大宗波动大、常赊销赊购，汇兑与价格风险突出。', econ: { margin: 0.22, dealSize: 8, rent: 0.8 } },
      { id: 'grain', name: '农副产品', emoji: '🌾', blurb: '季节与气候影响大，收购资金密集、账期长。', econ: { margin: 0.25, dealSize: 6, salary: 1.2 } },
    ],
  },
  {
    id: 'listed',
    name: '上市公司',
    emoji: '🏢',
    difficulty: 5,
    blurb: '股份制、多轮融资、合并报表、严格披露，最完整的会计图景。',
    initCash: 200,
    economics: {
      rent: 4, salary: 8, interestRate: 0.004, dealSize: 12, margin: 0.3,
    },
    fixedAssets: [{ name: '总部大楼/设备', value: 80, monthlyDep: 3 }],
    purchase: (amt) => ([
      { side: 'debit', account: '库存商品', amount: amt },
      { side: 'credit', account: '银行存款', amount: amt },
    ]),
    costOfSale: (amt) => ([
      { side: 'debit', account: '主营业务成本', amount: amt },
      { side: 'credit', account: '库存商品', amount: amt },
    ]),
    revenueAccount: '主营业务收入',
    costAccount: '主营业务成本',
    // 经营项目
    projects: [
      { id: 'finance', name: '金融控股', emoji: '🏦', blurb: '资本运作频繁、表外业务多，合并报表最复杂。', econ: { margin: 0.32, dealSize: 14 } },
      { id: 'infra', name: '基建地产', emoji: '🏗️', blurb: '重资产、长周期、借款与预收房款勾稽关系密。', econ: { margin: 0.26, dealSize: 16, rent: 4.5 } },
      { id: 'retail', name: '连锁零售', emoji: '🛍️', blurb: '门店多、流水碎、存货与现金管理网点分散。', econ: { margin: 0.28, dealSize: 12, salary: 9 } },
    ],
    // 上市专属：发行股票
    issueStock: (amt) => ([
      { side: 'debit', account: '银行存款', amount: amt },
      { side: 'credit', account: '股本', amount: amt },
    ]),
  },
]

export function getCompany(id) {
  return COMPANIES.find((c) => c.id === id) || COMPANIES[0]
}
