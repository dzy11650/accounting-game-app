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
