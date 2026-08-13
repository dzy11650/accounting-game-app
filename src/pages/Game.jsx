import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../store/UserContext.jsx'
import { COMPANIES } from '../data/companies.js'
import { STORY } from '../data/story.js'
import {
  createCompany, applyBusiness, monthEnd, buildReports, isBankrupt,
  recordVoucher, settleErrors, applyAdjust, loseLife, DIFFICULTY,
  applyFunding, applyExpand, applyTaxType, vatOnSale, vatOnPurchase,
  maybeForceGeneral, applyInvest, settleTax, declareDividend, TAX, TAX_PLANS,
  liabilityTotal, operatingRevenue, MOOD_LABEL, rollYearMood, moodFactor, evilAct, fmtW,
  wageEfficiency, resolveStrike, evilSalary, evilTaxAdjust, evilTaxOwe,
  genOrder, fulfillOrder, trackChoice, decisionInsights, endOfMonthExtras,
  scoreMetrics, overallStars, MILESTONES, checkMilestones,
  analyzeDecision, financialSnapshot, complianceNow,
} from '../lib/engine.js'
import EntryAnimation from '../components/EntryAnimation.jsx'
import Toast from '../components/Toast.jsx'

const ALL_ACCOUNTS = ['银行存款', '库存商品', '原材料', '生产成本', '固定资产', '累计折旧',
  '应收账款', '应付账款', '短期借款', '应付职工薪酬', '应付利息', '应交税费',
  '实收资本', '主营业务收入', '主营业务成本', '管理费用', '财务费用']

const SAVE_KEY = 'accounting_game_save_v1'

// 错误边界：捕获渲染期异常，避免白屏，直接显示错误信息与堆栈
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    // 同时打印到控制台，方便 DevTools / Electron 排查
    console.error('[Game ErrorBoundary]', error, info)
  }
  render() {
    if (this.state.error) {
      const err = this.state.error
      return (
        <div className="page fade-in" style={{ padding: 16 }}>
          <div className="card" style={{ borderLeft: '5px solid #e74c3c', background: '#FFF5F5' }}>
            <div style={{ fontWeight: 800, color: '#e74c3c', fontSize: 16 }}>⚠️ 运行出错</div>
            <div style={{ marginTop: 8, fontWeight: 700, wordBreak: 'break-all' }}>{String(err && err.message || err)}</div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#fbeaea', padding: 10, borderRadius: 8, marginTop: 8, maxHeight: 300, overflow: 'auto' }}>
              {err && err.stack}
            </pre>
            <button className="btn mt12" onClick={() => this.setState({ error: null })}>重试</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (s && s.sim && s.coId) return s
  } catch (e) {}
  return null
}
function writeSave(snap) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snap)) } catch (e) {}
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY) } catch (e) {}
}

function Game() {
  const navigate = useNavigate()
  const { state, dispatch } = useUser()
  const [saved, setSaved] = useState(() => loadSave())
  const [phase, setPhase] = useState(() => (saved ? 'askLoad' : 'select')) // select | askLoad | play | ended
  const [coId, setCoId] = useState(null)
  const [diffId, setDiffId] = useState('easy')
  // 选完公司类型、尚未选经营项目时的暂存公司
  const [pendingCompany, setPendingCompany] = useState(null)
  const [sim, setSim] = useState(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [chapterIdx, setChapterIdx] = useState(0)
  const [toast, setToast] = useState('')
  const [lastEntries, setLastEntries] = useState(null)
  const [reports, setReports] = useState(null)
  const [ended, setEnded] = useState(false)
  const [result, setResult] = useState(null)
  const [adjustTasks, setAdjustTasks] = useState([])
  const [showHint, setShowHint] = useState(false)
  // 自写分录输入
  const [entryForm, setEntryForm] = useState({ dAcc: '', dAmt: '', cAcc: '', cAmt: '' })
  // 困难模式业务简报（让玩家知道本笔业务的金额/税率，公平判分）
  const [brief, setBrief] = useState(null)
  // 点击/交互期运行时错误（便于定位"点击后白屏"等异常）
  const [runtimeError, setRuntimeError] = useState(null)
  // 报表区引用与"已生成"状态：点击生成后滚动到报表卡片，给出明确反馈
  const reportRef = useRef(null)
  const [reportReady, setReportReady] = useState(false)
  // E: 当月可选订单列表（持续经营章节主动接单）
  const [monthOrders, setMonthOrders] = useState([])
  // 罢工弹窗：pendingStrike 有值时显示三选一
  const [pendingStrike, setPendingStrike] = useState(null)
  // 每个分支选择后的财务分析与诊断
  const [analysis, setAnalysis] = useState(null)

  const chapter = STORY[chapterIdx]
  const step = chapter?.steps[stepIdx]
  const diff = DIFFICULTY[diffId]
  const co = COMPANIES.find((c) => c.id === coId)

  // 困难模式：进入自写分录步骤时，生成业务简报（金额/税率），保证判分公平
  // ⚠️ 必须放在所有提前 return 之前调用，否则在不同 phase 间切换会触发
  // "Rendered more hooks than during the previous render"（React #310）
  useEffect(() => {
    const selfModeNow = diff.selfEntry && step?.options?.[0]?.action
    const curActionNow = step?.options?.[0]?.action
    const entryActionTypes = ['rent', 'fixed', 'purchase', 'purchaseCredit', 'sale', 'salary']
    const isEntryActionNow = curActionNow && entryActionTypes.includes(curActionNow.type)
    if (selfModeNow && isEntryActionNow && sim) setBrief(computeBrief(sim, curActionNow))
    else setBrief(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterIdx, stepIdx, coId, diffId, sim, diff.selfEntry])

  // 把当前进度写入存档
  const persist = (simObj, cId, dId, cIdx, sIdx, end) => {
    writeSave({ sim: simObj, coId: cId, diffId: dId, chapterIdx: cIdx, stepIdx: sIdx, ended: !!end, savedAt: Date.now() })
  }

  // ---------- 开局 ----------
  // 第一步：选公司类型 -> 进入"选经营项目"子步骤
  const chooseCompany = (companyId) => {
    const c = COMPANIES.find((x) => x.id === companyId)
    setPendingCompany(c)
  }
  // 第二步：选经营项目 + 难度 -> 真正开局
  const start = (companyId, difficulty, projectId = null) => {
    try {
      const c = COMPANIES.find((x) => x.id === companyId)
      const proj = c.projects?.find((p) => p.id === projectId)
      const s = createCompany(companyId, difficulty, projectId) // 空壳，资金由第一章出资决策注入
      setCoId(companyId); setDiffId(difficulty); setSim(s); setPhase('play')
      setStepIdx(0); setChapterIdx(0); setAdjustTasks([]); setReports(null); setShowHint(false)
      setSaved(null); clearSave(); setPendingCompany(null)
      const projLabel = proj ? ` · ${proj.emoji}${proj.name}` : ''
      setToast(`创立${c.name}${projLabel}（${DIFFICULTY[difficulty].name}）— 先决定出资方式`)
      setLastEntries(s.ledger.slice(-3))
      persist(s, companyId, difficulty, 0, 0, false)
    } catch (e) {
      console.error('[start 出错]', e)
      setRuntimeError(`开局失败（${companyId}/${difficulty}）：${e && e.message}\n${e && e.stack}`)
    }
  }

  // 继续存档
  const resume = (save) => {
    setSim(save.sim); setCoId(save.coId); setDiffId(save.diffId)
    setChapterIdx(save.chapterIdx || 0); setStepIdx(save.stepIdx || 0)
    setReports(null); setShowHint(false)
    if (save.ended) { setEnded(true); setResult(save.result || null) }
    else setPhase('play')
    setSaved(null)
    setLastEntries(save.sim?.ledger?.slice(-3))
  }

  // 业务简报：困难模式向玩家展示本笔业务的金额、税率，保证自写分录可公平判分
  const computeBrief = (s, a) => {
    const eco = co.economics
    const scale = s.scale || 1
    const boost = 1 + (s.boost || 0)
    const we = wageEfficiency(s) // 工资效率（拖欠工资→不满度→效率降）
    const mf = (a.type === 'sale') ? moodFactor(s) : 1 // 销售受本年行情影响
    if (a.type === 'sale' || a.type === 'purchase' || a.type === 'purchaseCredit') {
      const base = eco.dealSize * scale * boost * mf * we
      const amount = diff.randFund ? +(base * (0.8 + Math.random() * 0.5)).toFixed(1) : +base.toFixed(1)
      const rate = s.taxType === 'general' ? TAX.VAT_GENERAL : TAX.VAT_SMALL
      return { type: a.type, amount, rate, vat: +(amount * rate).toFixed(2), cost: +(amount * (1 - eco.margin)).toFixed(1) }
    }
    if (a.type === 'salary') return { type: 'salary', amount: +(eco.salary * scale).toFixed(1) }
    if (a.type === 'rent') return { type: 'rent', amount: +(eco.rent * scale).toFixed(1) }
    return null
  }

  // 生成一笔业务的正确分录（expected）与实际记账
  // 所有金额按 企业经济参数 × 经营规模(s.scale) × 投入加成(boost) 计算
  const doBusiness = (s, action, overrideAmt) => {
    const eco = co.economics
    const scale = s.scale || 1
    const boost = 1 + (s.boost || 0)
    let entries = []
    let expected = []
    let desc = ''
    const r = (a, b) => +(a + Math.random() * (b - a)).toFixed(1)
    const we = wageEfficiency(s) // 工资效率影响实际可成交规模
    const amt = (base) => diff.randFund ? r(base * 0.8, base * 1.3) : +base.toFixed(1)
    // 包装：把行情与工资效率乘进基准金额
    const dealAmt = (rawBase) => amt(rawBase * moodFactor(s) * we)

    if (action.type === 'rent') {
      // 多付/少付：预付 months 个月房租，折扣 discount（多付折扣多、少付现金流压力小）
      if (s.eventBuff?.skipRent) {
        // C: 房东免租事件，本月不付房租
        desc = '房东免租：本月房租全免，省下一笔固定开支'
        entries = []
        expected = []
        applyBusiness(s, entries, desc)
        return { entries, expected, desc, s }
      }
      const months = action.months || 1
      const discount = action.discount || 0
      const grossMonthly = eco.rent * scale
      const monthlyRent = +(grossMonthly * (1 - discount)).toFixed(1) // 折扣后月租
      const deposit = +grossMonthly.toFixed(1) // 押金按原价（1个月房租）
      const prepaid = +(monthlyRent * months).toFixed(1) // 预付房租（含折扣）
      const totalOut = +(deposit + prepaid).toFixed(1)
      // 记录决策，供月末摊销使用（权责发生制）
      s.choices.rentMonths = months
      s.choices.rentDiscount = discount
      desc = `付押金¥${deposit}万 + 预付房租${months}个月¥${prepaid}万${discount ? `（享${Math.round(discount * 100)}%折扣）` : ''}`
      // 押金计入预付账款(资产)，预付房租挂"预付账款-房租"后续按月摊销
      entries.push(...mk('预付账款', deposit, '银行存款', deposit, desc))
      entries.push(...mk('预付账款-房租', prepaid, '银行存款', prepaid, desc))
      if (s.balances['预付账款-房租'] == null) s.balances['预付账款-房租'] = 0
      s.balances['预付账款-房租'] = +(s.balances['预付账款-房租'] + prepaid).toFixed(2)
      // 本月仍摊销一个月房租进费用（首月即生效）
      entries.push(...mk('管理费用-房租', monthlyRent, '预付账款-房租', monthlyRent, desc))
      s.balances['预付账款-房租'] = +(s.balances['预付账款-房租'] - monthlyRent).toFixed(2)
      expected = entries
    } else if (action.type === 'fixed') {
      const total = +(s.balances['银行存款'] * action.ratio).toFixed(1)
      const sum = co.fixedAssets.reduce((t, x) => t + x.value, 0)
      desc = `购置固定资产¥${total}万`
      co.fixedAssets.forEach((fa) => {
        const v = +(total * (fa.value / sum)).toFixed(1)
        entries.push(...mk('固定资产', v, '银行存款', v, desc))
      })
      expected = entries
    } else if (action.type === 'purchase') {
      const a = overrideAmt != null ? overrideAmt : dealAmt(eco.dealSize * scale * boost * (1 + (s.eventBuff?.purchaseUp || 0)))
      const res = vatOnPurchase(s, a, false)
      desc = `进货¥${a}万${s.taxType === 'general' ? `（进项税¥${res.vat}万可抵扣）` : ''}`
      entries = res.entries; expected = res.entries
      s.balances['库存商品'] = (s.balances['库存商品'] || 0) + a
    } else if (action.type === 'purchaseCredit') {
      const a = overrideAmt != null ? overrideAmt : dealAmt(eco.dealSize * scale * boost * (1 + (s.eventBuff?.purchaseUp || 0)))
      const res = vatOnPurchase(s, a, true)
      desc = `赊购¥${a}万${s.taxType === 'general' ? `（进项税¥${res.vat}万可抵扣）` : ''}`
      entries = res.entries; expected = res.entries
      s.balances['库存商品'] += a; s.balances['应付账款'] += a
      // F: 登记应付账款账期（3 个月后自动从现金扣还，制造现金流博弈）
      s.payablesDue = s.payablesDue || []
      s.payablesDue.push({ due: s.month + 3, amount: +(a + res.vat).toFixed(2) })
    } else if (action.type === 'sale') {
      const a = overrideAmt != null ? overrideAmt : dealAmt(eco.dealSize * scale * boost * (1 + (s.eventBuff?.saleUp || 0)))
      const cost = +(a * (1 - eco.margin)).toFixed(1)
      const res = vatOnSale(s, a, co.revenueAccount)
      const forced = maybeForceGeneral(s)
      const costE = co.costOfSale(cost)
      entries = [...res.entries, ...costE]
      expected = entries
      applyBusiness(s, res.entries, `卖货¥${a}万`)
      applyBusiness(s, costE, '结转成本'); s.balances['库存商品'] -= cost
      desc = `卖货¥${a}万（销项税¥${res.vat}万）`
      s.quarterRevenue = +(s.quarterRevenue || 0) + a // 累计本季营收（小规模免税判定）
      if (forced) setToast('⚠️ 年销售额超500万，已强制转为一般纳税人！税率13%且可抵扣进项')
      return { entries, expected, desc, s }
    } else if (action.type === 'salary') {
      const a = +(eco.salary * scale).toFixed(1)
      desc = `计提工资¥${a}万`
      entries = [{ side: 'debit', account: '管理费用-工资', amount: a }, { side: 'credit', account: '应付职工薪酬', amount: a }]
      expected = entries
    }
    applyBusiness(s, entries, desc)
    return { entries, expected, desc, s }
  }

  // 处理"特殊决策"动作：出资方式 / 纳税人类型 / 月末结账 / 缴税 / 扩张 / 投入选择
  const runSpecial = (s, a) => {
    if (a.type === 'fund') {
      applyFunding(s, a.own) // a.own: 'full'|'part'|'low'
      const borrow = s.balances['短期借款']
      trackChoice(s, 'leverage', { value: a.own === 'full' ? 'full' : 'partial', borrow }) // B: 决策后果
      const entries = mk('银行存款', s.balances['银行存款'], '实收资本', s.balances['实收资本'], '出资')
      if (borrow > 0) entries.push({ side: 'credit', account: '短期借款', amount: borrow, desc: '出资' })
      recordVoucher(s, { desc: '股东出资（含借款）', actual: entries, expected: entries, month: s.month })
      setToast(`出资方式：${a.own === 'low' ? '高杠杆（借70%）' : a.own === 'part' ? '借30%' : '全部自有'} — 经营规模×${s.scale}`)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'taxType') {
      applyTaxType(s, a.tax) // a.tax: 'small'|'general'
      trackChoice(s, 'taxType', { value: a.tax }) // B: 记录纳税人类型决策，结算时对比
      setToast(`纳税人类型：${a.tax === 'general' ? '一般纳税人（税率13%，可抵扣进项）' : '小规模纳税人（征收率3%，进项不可抵扣）'}`)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'monthEnd') {
      doMonthEnd(s); return { handled: true, selfContained: true }
    }
    if (a.type === 'tax') {
      let plans = a.plans || [] // 合法税务筹划手段数组
      // 研发加计扣除仅科技类企业可用：非 tech 时自动剔除该项（而不是拦截卡死），保证流程能继续推进
      let skippedRnd = false
      if (plans.includes('rndDeduction') && co.id !== 'tech') {
        plans = plans.filter((p) => p !== 'rndDeduction')
        skippedRnd = true
      }
      const res = settleTax(s, plans)
      const planNote = plans.length ? '（已做合法筹划，少缴税✓）' : ''
      const skipNote = skippedRnd ? ` · 已自动剔除「研发费用加计扣除」（${co.name}非科技型企业无适用研发活动）` : ''
      s.usedTaxPlans = [...new Set([...(s.usedTaxPlans || []), ...plans])]
      setToast(`缴税：增值税¥${res.vatPayable}万 + 企业所得税¥${res.cit}万（${res.taxType === 'general' ? '一般纳税人' : '小规模'}）${res.forced ? ' · 已强制转一般纳税人' : ''}${planNote}${skipNote}`)
      return { handled: true, selfContained: false }
    }
    // 股东分红：从税后利润中按 ratio 分配（可选比例）
    if (a.type === 'dividend') {
      const ratio = a.ratio || 0
      if (ratio <= 0) {
        setToast('📈 本年利润留存公司，暂不分红（可用于后续扩张或抵御歉年）')
        return { handled: true, selfContained: false }
      }
      const res = declareDividend(s, ratio)
      if (!res.ok) setToast('💡 ' + res.msg)
      else {
        setToast(`🎉 股东分红：实得 ${fmtW(res.amount)}万（含税分红 ${fmtW(res.gross)}万，代扣个税 ${fmtW(res.tax)}万）`)
        s.usedTaxPlans = s.usedTaxPlans || []
      }
      return { handled: true, selfContained: false }
    }
    if (a.type === 'expand') {
      applyExpand(s, a)
      setToast(`扩张：规模放大至 ×${s.scale}，后续工资/利息/营收同步变化`)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'invest') {
      applyInvest(s, a.kind, a.level) // a.kind='market', a.level='high'|'low'
      setToast(`投入决策（${a.kind}）：${a.level === 'high' ? '高投入→后续营收+25%，但前置营销成本已发生' : '低投入→营收小幅提升，无前置成本'}`)
      return { handled: true, selfContained: false }
    }
    // 第七章邪道玩法：不发工资 / 不交税（调账或拖欠）/ 虚开发票
    if (a.type === 'evilSalary') {
      // 不发工资：当月不计提工资费用（省成本），欠薪挂账，隐藏不满度上升，后续可能罢工
      const msg = evilSalary(s)
      setToast(msg)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'evilTaxAdjust') {
      // 税务调账：修改应纳税额（产生分录），按调账次数定稽查概率
      const msg = evilTaxAdjust(s, a.ratio)
      setToast(msg)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'evilTaxOwe') {
      // 直接拖欠税款：挂账不缴，每日万分之五滞纳金
      const msg = evilTaxOwe(s)
      setToast(msg)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'resolveStrike') {
      // 罢工后三选一：full 全额 / partial 部分 / over 超额
      const msg = resolveStrike(s, a.option)
      setToast(msg)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'evilFakeInvoice') {
      // 虚开发票冲成本：短期虚增成本少缴税，刑事红线
      const msg = evilAct(s, 'fakeInvoice')
      setToast(msg)
      return { handled: true, selfContained: false }
    }
    // 第七章持续经营：开始 / 继续下一个月（回到本章"进货"步，重复经营）
    if (a.type === 'loopStart' || a.type === 'loopContinue') {
      if (a.type === 'loopStart') {
        s.year = 1
        s.yearMood = rollYearMood() // 第 1 年行情开局即定
        s.reachedMilestones = []
        s.choiceLog = s.choiceLog || []
        s.receivables = []
        s.payablesDue = []
      }
      // E: 每月初刷新 3 张可选订单（玩家主动接单）
      if (chapter.id === 'continuing') {
        const orders = Array.from({ length: 3 }, () => genOrder(s))
        s.monthOrders = orders
        setMonthOrders(orders)
      } else {
        setMonthOrders([])
      }
      const back = 1 // 回到"进货"步（step1），重复 进→销→薪→结
      setSim(s); setStepIdx(back); persist(s, coId, diffId, chapterIdx, back, false)
      const orderCount = (s.monthOrders || []).length
      setToast(a.type === 'loopStart' ? `🚀 开始持续经营！本年行情：${MOOD_LABEL[s.yearMood]}（第1年）` : `⏭️ 进入第 ${s.month} 月经营（${MOOD_LABEL[s.yearMood] || '⛅'} 第${s.year || 1}年），本月 ${orderCount} 张订单待接`)
      return { handled: true, selfContained: true }
    }
    // 结业清算：出最终成绩单
    if (a.type === 'close') {
      setSim(s)
      finish(s)
      return { handled: true, selfContained: true }
    }
    return { handled: false }
  }

  // ---------- 简单模式：选选项 ----------
  const choose = (opt) => {
    try {
      if (!opt || !opt.action) { nextStep(); return }
      const a = opt.action
      const before = clone(sim)
      const s = clone(sim)
      const sp = runSpecial(s, a)
      if (sp.handled) {
        if (!sp.selfContained) {
          afterSpecial(s)
        } else {
          // 被拦截（如非科技公司选研发加计）：仍给出分析但不前进
          setAnalysis(analyzeDecision(before, s, a, { title: '操作被拦截' }))
        }
        return
      }
      const { entries, expected, desc } = doBusiness(s, a)
      if (diff.selfEntry) return // 困难模式不应走这里
      recordVoucher(s, { desc, actual: expected, expected, month: s.month })
      setSim(s); setLastEntries(entries); setToast(desc + ' ✓')
      setAnalysis(analyzeDecision(before, s, a))
      afterAction(s)
    } catch (e) {
      console.error('[choose 出错]', e)
      setRuntimeError(`选择出错：${e && e.message}\n${e && e.stack}`)
    }
  }

  // ---------- 困难/硬核：提交自写分录 ----------
  const submitEntry = () => {
    try {
      const a = step.options[0]?.action
      if (!a) { nextStep(); return }
      const before = clone(sim)
      const s = clone(sim)
      const sp = runSpecial(s, a)
      if (sp.handled) {
        if (!sp.selfContained) {
          afterSpecial(s)
        } else {
          setAnalysis(analyzeDecision(before, s, a, { title: '操作被拦截' }))
        }
        return
      }
      const { entries, expected, desc } = doBusiness(s, a, brief?.amount)
      const actual = [
        { side: 'debit', account: entryForm.dAcc, amount: +entryForm.dAmt },
        { side: 'credit', account: entryForm.cAcc, amount: +entryForm.cAmt },
      ]
      const v = recordVoucher(s, { desc, actual, expected, month: s.month })
      setSim(s)
      if (v.correct) {
        setToast('✓ 分录正确！')
        setLastEntries(entries)
      } else {
        loseLife(s)
        setToast(diff.autoFix ? '记错啦，已自动修正' : `✗ 分录有误，扣 1 次容错（剩 ${s.lives}）`)
        setLastEntries(entries) // 展示正确分录
      }
      setAnalysis(analyzeDecision(before, s, a, { title: '自写分录：' + desc }))
      setEntryForm({ dAcc: '', dAmt: '', cAcc: '', cAmt: '' })
      afterAction(s)
    } catch (e) {
      console.error('[submitEntry 出错]', e)
      setRuntimeError(`提交分录出错：${e && e.message}\n${e && e.stack}`)
    }
  }

  // 特殊动作（出资/扩张）之后：检查破产并推进
  const afterSpecial = (s) => {
    if (isBankrupt(s)) { fail(s, '资不抵债，公司破产！'); return }
    if (s.failed) { fail(s, s.failedReason); return }
    setSim(s); persist(s, coId, diffId, chapterIdx, stepIdx, false)
    nextStep()
  }

  const afterAction = (s) => {
    if (isBankrupt(s)) { fail(s, '资不抵债，公司破产！'); return }
    if (s.failed) { fail(s, s.failedReason); return }
    nextStep()
  }

  // ---------- 结账并纠错 ----------
  const doMonthEnd = (passed) => {
    const before = clone(sim) // 结账前快照（用于月度体检对比）
    const s = passed || clone(sim)
    monthEnd(s)
    // C/D/F: 月末钩子——应收账款收回、应付账款到期、随机事件、里程碑
    const extras = endOfMonthExtras(s, { rollEvent: true })
    if (extras.ev) setToast(`🎲 ${extras.ev.emoji} ${extras.ev.title}：${extras.ev.desc}`)
    if (extras.miles && extras.miles.length) {
      setTimeout(() => setToast(`🏁 里程碑达成：${extras.miles.map((m) => m.emoji + m.title).join('、')}`), 1200)
    }
    const settle = settleErrors(s)
    if (settle.fatal) { fail(s, s.failedReason); return }
    setSim(s)
    // 罢工弹窗：本月触发罢工时，先弹窗让玩家三选一，再继续
    if (s.pendingStrike) {
      setPendingStrike({ month: s.month })
    }
    let msg = `第${s.month}月结账：折旧+计息${settle.penalized ? `，罚款¥${settle.penalized}万` : ''}`
    if (extras.events && extras.events.length) {
      msg += '；' + extras.events.map((e) => `${e.title}¥${fmtW(e.amount)}万`).join('，')
    }
    if (settle.tasks && settle.tasks.length) {
      setAdjustTasks(settle.tasks)
      msg += '；⚠️ 本月有凭证记错，需做调整分录修正！'
    }
    if (s.pendingBlowup) msg += `；${s.pendingBlowup}`
    setToast(msg)
    if (s.pendingBlowup) s.pendingBlowup = null
    // 月度体检：结账后展示本月财务分析与诊断
    setAnalysis(analyzeDecision(before, s, { type: 'monthEnd' }, { title: `第 ${s.month} 月结账体检` }))
    if (s.failed) { fail(s, s.failedReason); return }
    if (isBankrupt(s)) { fail(s, '资不抵债，公司破产！'); return }
    nextStep()
  }

  // 提交调整分录
  const submitAdjust = (task) => {
    const s = clone(sim)
    const entries = [
      { side: 'debit', account: entryForm.dAcc, amount: +entryForm.dAmt },
      { side: 'credit', account: entryForm.cAcc, amount: +entryForm.cAmt },
    ]
    applyAdjust(s, task.vid, entries)
    setAdjustTasks((t) => t.filter((x) => x.vid !== task.vid))
    setEntryForm({ dAcc: '', dAmt: '', cAcc: '', cAmt: '' })
    setToast('✓ 调整分录已应用')
    setSim(s)
  }

  // E: 玩家接单
  const acceptOrder = (order) => {
    try {
      const s = clone(sim)
      fulfillOrder(s, order)
      s.monthOrders = (s.monthOrders || []).filter((o) => o.id !== order.id)
      setMonthOrders(s.monthOrders)
      setSim(s)
      persist(s, coId, diffId, chapterIdx, stepIdx, false)
      setToast(`✓ 已接「${order.customer}」订单：销售额¥${fmtW(order.amount)}万，预计毛利¥${fmtW(order.profit)}万${order.credit > 0 ? `（赊销${order.credit}月后回款）` : '（现结）'}`)
    } catch (e) {
      console.error('[acceptOrder 出错]', e)
      setRuntimeError(`接单出错：${e && e.message}\n${e && e.stack}`)
    }
  }

  const nextStep = () => {
    if (stepIdx + 1 < chapter.steps.length) {
      const n = stepIdx + 1
      setStepIdx(n)
      persist(sim, coId, diffId, chapterIdx, n, false)
    } else if (chapterIdx + 1 < STORY.length) {
      const ci = chapterIdx + 1
      setChapterIdx(ci); setStepIdx(0)
      persist(sim, coId, diffId, ci, 0, false)
    } else {
      finish(sim)
    }
  }

  const finish = (s) => {
    const r = buildReports(s)
    setReports(r)
    const profit = s.balances['本年利润'] || 0
    const cash = s.balances['银行存款']
    const ok = cash >= 0 && !s.failed
    // A: 四维评分（盈利/现金流/风险/合规）
    const scores = scoreMetrics(s)
    const stars = overallStars(scores)
    const res = {
      ok, stars,
      reason: ok ? `通关！净利润¥${fmtW(profit)}万 现金¥${fmtW(cash)}万` : '未达成通关条件',
      profit, cash, scores,
      insights: decisionInsights(s),                 // B: 决策后果回放
      milestones: (s.reachedMilestones || []).map((id) => MILESTONES.find((m) => m.id === id)).filter(Boolean), // D
      ordersFulfilled: s.choices?.ordersFulfilled || 0,
    }
    setResult(res)
    setEnded(true)
    dispatch({ type: 'ADD_COINS', amount: ok ? 50 : 20 })
    dispatch({ type: 'ADD_EXP', amount: 60 })
    dispatch({ type: 'COMPANY_RUN', id: coId })
    dispatch({ type: 'EARN_BADGE', id: ok ? 'boss' : 'cfo' })
    // H: 记录本局通关成绩（本地排行榜 / 多公司对比）
    dispatch({
      type: 'RECORD_RUN',
      coId, coName: sim.co?.name || coId,
      profit: +(sim.balances['本年利润'] || 0).toFixed(2),
      stars: res.stars, months: sim.month, date: new Date().toISOString().slice(0, 10),
    })
    // D: 里程碑成就解锁
    res.milestones.forEach((m) => dispatch({ type: 'EARN_BADGE', id: 'ms_' + m.id }))
    // 通关后清除存档（已完成）
    clearSave(); setSaved(null)
  }

  const fail = (s, reason) => {
    setSim(s)
    const res = { ok: false, stars: 0, reason, profit: s.balances['本年利润'] || 0, cash: s.balances['银行存款'] }
    setResult(res)
    setEnded(true)
    dispatch({ type: 'ADD_COINS', amount: 10 })
    // 失败保留存档，允许重开/加载
    persist(s, coId, diffId, chapterIdx, stepIdx, true)
    setResult((r) => ({ ...r, failed: true }))
  }

  const restart = () => {
    clearSave(); setSaved(null)
    setPhase('select'); setSim(null); setReports(null); setEnded(false); setResult(null); setAdjustTasks([]); setStepIdx(0); setChapterIdx(0)
  }
  const clone = (s) => JSON.parse(JSON.stringify(s))

  function mk(d, da, c, ca, desc) {
    return [
      { side: 'debit', account: d, amount: da, desc },
      { side: 'credit', account: c, amount: ca, desc },
    ]
  }

  // ============ 渲染 ============
  if (phase === 'askLoad' && saved) {
    const savedCo = COMPANIES.find((c) => c.id === saved.coId)
    const savedDiff = DIFFICULTY[saved.diffId]
    return (
      <div className="page fade-in">
        <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
          <div style={{ fontSize: 46 }}>📂</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>检测到之前的经营存档</div>
          <div style={{ color: 'var(--text-soft)', marginTop: 6 }}>
            {savedCo?.emoji} {savedCo?.name} · {savedDiff?.name}
          </div>
          <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 2 }}>
            进度：第 {saved.chapterIdx + 1} 章第 {saved.stepIdx + 1} 步
          </div>
          <button className="btn mt12" onClick={() => resume(saved)}>▶️ 继续上次的经营</button>
          <button className="btn ghost mt12" onClick={() => { clearSave(); setSaved(null); setPhase('select') }}>🔄 重新开一家（清空存档）</button>
        </div>
      </div>
    )
  }

  if (phase === 'select') {
    // 子步骤：已选公司类型，进入"选经营项目"
    if (pendingCompany) {
      const c = pendingCompany
      const projects = c.projects || []
      return (
        <div className="page fade-in">
          <Toast message={toast} onClose={() => setToast('')} />
          <button className="btn ghost" style={{ marginBottom: 10 }} onClick={() => setPendingCompany(null)}>← 换家公司</button>
          <div className="section-title">🏢 {c.emoji} {c.name} · 选经营项目</div>
          <div style={{ color: 'var(--text-soft)', fontSize: 12, marginBottom: 8 }}>
            同一类公司也分不同产品线，参数与难点略有差异，挑一个你熟悉的吧～
          </div>
          {projects.length === 0 ? (
            <div className="card">该产品线暂未细分经营项目，直接选择难度开始。</div>
          ) : projects.map((p) => (
            <div key={p.id} className="card">
              <div style={{ fontWeight: 800 }}>{p.emoji} {p.name}</div>
              <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 4 }}>{p.blurb}</div>
              {p.econ && (
                <div className="flex" style={{ marginTop: 6 }}>
                  {p.econ.margin != null && <span className="chip">毛利 {Math.round(p.econ.margin * 100)}%</span>}
                  {p.econ.dealSize != null && <span className="chip">单笔 ¥{p.econ.dealSize}万</span>}
                </div>
              )}
              <div className="section-title" style={{ margin: '12px 0 8px', fontSize: 14 }}>选择难度</div>
              {Object.values(DIFFICULTY).map((d) => (
                <button key={d.id} className="btn ghost mt12" style={{ width: '100%', padding: '10px' }} onClick={() => start(c.id, d.id, p.id)}>
                  {d.name} · 容错{d.lives}次 {d.selfEntry ? '· 自写分录' : '· 选项引导'}
                </button>
              ))}
            </div>
          ))}
          {projects.length > 0 && (
            <button className="btn mt12" style={{ width: '100%' }} onClick={() => start(c.id, diffId, projects[0].id)}>
              直接开干（默认 {projects[0].emoji}{projects[0].name} · {DIFFICULTY[diffId].name}）
            </button>
          )}
        </div>
      )
    }
    return (
      <div className="page fade-in">
        <Toast message={toast} onClose={() => setToast('')} />
        <div className="section-title">🏢 选择公司类型</div>
        {COMPANIES.map((c) => (
          <div key={c.id} className="card" style={{ cursor: 'pointer' }} onClick={() => chooseCompany(c.id)}>
            <div style={{ fontWeight: 800 }}>{c.emoji} {c.name}</div>
            <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 4 }}>{c.blurb}</div>
            <div className="flex" style={{ marginTop: 6 }}>
              <span className="chip">难度 {'★'.repeat(c.difficulty)}</span>
              <span className="chip">启动 ¥{c.initCash}万</span>
              {c.projects?.length > 0 && <span className="chip">{c.projects.length} 个经营项目</span>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (ended) {
    const sc = result?.scores
    return (
      <div className="page fade-in">
        <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
          <div style={{ fontSize: 50 }}>{result.ok ? '🏆' : '💥'}</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 8 }}>{result.ok ? '经营成功！' : '经营失败'}</div>
          <div style={{ color: 'var(--text-soft)', marginTop: 6 }}>{result.reason}</div>
          {result.ok && (
            <div style={{ fontSize: 32, margin: '12px 0' }}>
              {'⭐'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}
            </div>
          )}
          {/* A: 四维经营能力雷达图 */}
          {sc && <RadarChart scores={sc} />}
          {result && (
            <div className="card" style={{ background: '#FFFDF8', textAlign: 'left', marginTop: 10 }}>
              <div>净利润：¥{fmtW(result.profit)}万</div>
              <div>现金余额：¥{fmtW(result.cash)}万</div>
              <div>累计接单：{result.ordersFulfilled || 0} 笔</div>
              <div>容错剩余：{sim?.lives ?? 0}</div>
            </div>
          )}
          {/* B: 决策后果回放 + G: 平行对照引导 */}
          {result?.insights?.length > 0 && (
            <div className="card" style={{ background: '#F4FBF9', textAlign: 'left', marginTop: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🔎 你的决策带来了什么</div>
              {result.insights.map((t, i) => <div key={i} style={{ fontSize: 12, lineHeight: 1.7 }}>{t}</div>)}
              <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6, lineHeight: 1.6 }}>
                🔁 平行对照：换一家公司类型、或改用另一种纳税人身份/出资方式再开一局，对比"如果当初走另一条路"能多赚多少——本局成绩已记入「我的-排行榜/多公司对比」。
              </div>
            </div>
          )}
          {/* D: 里程碑成就 */}
          {result?.milestones?.length > 0 && (
            <div className="card" style={{ background: '#FFFAF0', textAlign: 'left', marginTop: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🏁 达成的经营里程碑</div>
              {result.milestones.map((m, i) => (
                <div key={i} style={{ fontSize: 13, padding: '3px 0' }}>{m.emoji} {m.title} — {m.desc}</div>
              ))}
            </div>
          )}
          <button className="btn mt12" onClick={restart}>🔄 再开一家</button>
          <button className="btn ghost mt12" onClick={() => navigate('/reports')}>📊 查看报表</button>
        </div>
      </div>
    )
  }

  // 调整分录任务弹层
  if (adjustTasks.length > 0) {
    const task = adjustTasks[0]
    return (
      <div className="page fade-in">
        <Toast message={toast} onClose={() => setToast('')} />
        <div className="card" style={{ borderLeft: '5px solid var(--gold)' }}>
          <div style={{ fontWeight: 800, color: 'var(--gold)' }}>🔧 调整分录任务</div>
          <div style={{ marginTop: 6 }}>业务：{task.desc}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6 }}>你记成了：{task.wrong.map((e) => `${e.side === 'debit' ? '借' : '贷'}${e.account}${e.amount}`).join(' / ')}</div>
          <div style={{ fontSize: 12, color: 'var(--accent-deep)', background: '#E9F8F6', padding: 8, borderRadius: 8, marginTop: 6 }}>正确应为：{task.hint}</div>
          <EntryForm form={entryForm} setForm={setEntryForm} />
          <button className="btn mt12" onClick={() => submitAdjust(task)}>提交调整分录</button>
        </div>
      </div>
    )
  }

  const selfMode = diff.selfEntry && step?.options?.[0]?.action
  const entryActionTypes = ['rent', 'fixed', 'purchase', 'purchaseCredit', 'sale', 'salary']
  const curAction = step?.options?.[0]?.action
  const isEntryAction = curAction && entryActionTypes.includes(curAction.type)

  // 罢工弹窗：三选一（全额 / 部分 / 超额 补发）
  if (pendingStrike) {
    const owed = sim.wageUnpaid || 0
    const d = Math.round(sim.wageDiscontent || 0)
    const resolve = (option) => {
      runSpecial({ type: 'resolveStrike', option })
      setPendingStrike(null)
    }
    return (
      <div className="page fade-in">
        <Toast message={toast} onClose={() => setToast('')} />
        <div className="card" style={{ borderLeft: '5px solid #e74c3c', background: '#FFF5F5', marginTop: 30 }}>
          <div style={{ fontSize: 30 }}>🪧</div>
          <div style={{ fontWeight: 800, color: '#e74c3c', marginTop: 4 }}>员工罢工了！</div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
            因长期拖欠工资，员工发起罢工。当前累计欠薪 <b>¥{fmtW(owed)}万</b>，不满度 <b>{d}/100</b>。
            罢工当月效率骤降。你决定如何回应？（无论哪种都会记入罢工黑历史，使下次更易罢工、损失更大）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <button className="btn" onClick={() => resolve('full')}>💰 全额补发（结清欠薪，不满度清零）</button>
            <button className="btn ghost" onClick={() => resolve('partial')}>⚠️ 部分补发 50%（欠薪减半，不满度下降但仍未平复）</button>
            <button className="btn ghost" onClick={() => resolve('over')}>🔥 超额补发 150%（多花 50% 安抚金，彻底挽回人心）</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page fade-in">
      {runtimeError && (
        <div className="card" style={{ borderLeft: '5px solid #e74c3c', background: '#FFF5F5', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: '#e74c3c', fontSize: 15 }}>⚠️ 交互出错</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#fbeaea', padding: 10, borderRadius: 8, marginTop: 8, maxHeight: 260, overflow: 'auto' }}>{runtimeError}</pre>
          <button className="btn mt12" onClick={() => setRuntimeError(null)}>关闭提示</button>
        </div>
      )}
      <Toast message={toast} onClose={() => setToast('')} />

      <div className="card">
        <div className="flex between center">
          <div style={{ fontWeight: 800 }}>{co.emoji} {co.name}{sim.projectEmoji ? ` · ${sim.projectEmoji}${sim.projectName}` : ''}</div>
          <span className="chip">{diff.name}</span>
        </div>
        <div className="flex gap8 mt12">
          <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>💵 现金</span><span className="v">¥{fmtW(sim.balances['银行存款'])}万</span></div>
          <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>📈 利润</span><span className="v">¥{fmtW(sim.balances['本年利润'])}万</span></div>
          <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>❤️ 容错</span><span className="v">{sim.lives}</span></div>
        </div>
        <div className="flex gap8 mt8">
          <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>🧾 营收</span><span className="v">¥{fmtW(operatingRevenue(sim))}万</span></div>
          <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>🏦 负债</span><span className="v">¥{fmtW(liabilityTotal(sim))}万</span></div>
          <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>📏 规模</span><span className="v">×{fmtW(sim.scale || 1)}</span></div>
        </div>
        {(chapter.loop) && (
          <>
            <div className="flex gap8 mt8">
              <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>🌤️ 行情</span><span className="v">{MOOD_LABEL[sim.yearMood] || '⛅ 平常年'}（第{sim.year || 1}年）</span></div>
              <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>😈 邪道</span><span className="v">{sim.evilCount || 0} 次</span></div>
            </div>
            {/* C: 当前随机事件提示条 */}
            {sim.lastEvent && (
              <div className="flex gap8 mt8" style={{ alignItems: 'center' }}>
                <div className="shop-stat" style={{ flex: 1, marginBottom: 0, background: sim.lastEvent.tone === 'good' ? '#E3F6EF' : sim.lastEvent.tone === 'bad' ? '#FDECEC' : '#FFF7E6' }}>
                  <span>{sim.lastEvent.emoji} {sim.lastEvent.title}</span>
                  <span className="v" style={{ fontSize: 11, fontWeight: 500 }}>{sim.lastEvent.desc}</span>
                </div>
              </div>
            )}
            {/* D: 里程碑进度 */}
            {MILESTONES.length > 0 && (
              <div className="flex gap8 mt8" style={{ flexWrap: 'wrap' }}>
                {MILESTONES.map((m) => {
                  const done = (sim.reachedMilestones || []).includes(m.id)
                  const near = sim.month >= m.month - 1 && !done
                  return (
                    <span key={m.id} title={m.desc}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, opacity: done ? 1 : 0.4,
                        background: done ? 'var(--gold)' : near ? '#E9F8F6' : '#f2efe8', color: done ? '#fff' : 'var(--text-soft)' }}>
                      {done ? '✓ ' : near ? '🔔 ' : '🔒 '}{m.title}
                    </span>
                  )
                })}
              </div>
            )}
          </>
        )}
        {(chapter.loop) && (sim.totalDividend > 0 || (sim.usedTaxPlans || []).length) && (
          <div className="flex gap8 mt8">
            <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>💰 累计分红</span><span className="v">¥{fmtW(sim.totalDividend || 0)}万</span></div>
            <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>🛡️ 合法筹划</span><span className="v">{(sim.usedTaxPlans || []).length ? sim.usedTaxPlans.map((p) => TAX_PLANS[p]?.name || p).join('/') : '未使用'}</span></div>
          </div>
        )}
      </div>

      <div className="card" style={{ background: '#FFFDF8', borderLeft: '5px solid var(--primary)' }}>
        <div style={{ fontWeight: 700, color: 'var(--primary-deep)', fontSize: 13 }}>
          {chapter.title} · 第{sim.month}月{chapter.loop ? `（第 ${Math.ceil(sim.month / 12)} 年）` : ''}
        </div>
        <div style={{ marginTop: 6, lineHeight: 1.7 }}>{step?.npc}</div>
        {step?.teach && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent-deep)', background: '#E9F8F6', padding: '8px 10px', borderRadius: 8 }}>💡 {step.teach}</div>
        )}
        <button className="btn ghost mt12" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }} onClick={() => setShowHint((v) => !v)}>
          {showHint ? '收起提示' : '💡 卡住了？看思路'}
        </button>
        {showHint && (step?.teach || (step?.options || []).some((o) => o.teach)) && (
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6, lineHeight: 1.7 }}>
            {step?.teach && <div>思路：{step.teach}（想想这笔业务影响了哪些科目、是增加还是减少、记借还是贷）</div>}
            {(step?.options || []).filter((o) => o.teach).map((o, i) => (
              <div key={i} style={{ marginTop: step?.teach ? 6 : 0 }}>
                {step?.teach ? `▸ ${o.label}：` : '思路：'}{o.teach}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* E: 持续经营"销售"步——主动接单面板（替换被动卖货） */}
      {!selfMode && chapter.id === 'continuing' && step?.options?.[0]?.action?.type === 'sale' && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>📥 本月订单（点击接单，把生意主动权握在手里）</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 10 }}>
            下方订单可全接也可挑着接。赊销订单会挂「应收账款」，数月后自动回款；不接单也可直接点"卖货收款"按默认成交一笔。
          </div>
          {monthOrders.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-soft)', padding: '8px 0' }}>本月订单都已接完，或本月无新订单。</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {monthOrders.map((o) => (
                <div key={o.id} style={{ border: '1.5px solid var(--line)', borderRadius: 12, padding: '10px 12px', background: o.credit > 0 ? '#FFF8F0' : '#F4FBF9' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{o.emoji || '🧾'} {o.customer}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', margin: '4px 0' }}>
                    销售额 ¥{fmtW(o.amount)}万 · 毛利率 {Math.round(o.margin * 100)}% · 预计毛利 ¥{fmtW(o.profit)}万
                  </div>
                  <div style={{ fontSize: 11, marginBottom: 6 }}>
                    {o.credit > 0
                      ? <span style={{ color: 'var(--accent-deep)', background: '#E9F8F6', padding: '2px 8px', borderRadius: 6 }}>赊销 {o.credit} 月后回款</span>
                      : <span style={{ color: '#1a8f6a', background: '#E3F6EF', padding: '2px 8px', borderRadius: 6 }}>现结</span>}
                  </div>
                  <button className="btn-sm" onClick={() => acceptOrder(o)} style={{ width: '100%' }}>接单并记账</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 简单模式：选项卡片 */}
      {!selfMode && (
        <div className="card">
          {step?.options?.length ? (
            step.options.map((opt, i) => (
              <div key={i}>
                <div className="option" style={{ cursor: 'pointer' }} onClick={() => choose(opt)}>
                  <span className="opt-key">{i + 1}</span><span>{opt.label}</span>
                  {opt.recommended && !diff.selfEntry && <span className="chip" style={{ marginLeft: 'auto', background: 'var(--gold)', color: '#fff' }}>💡推荐</span>}
                </div>
                {diff.selfEntry === false && opt.demoEntries && (
                  <div style={{ fontSize: 11, color: 'var(--accent-deep)', background: '#E9F8F6', padding: '6px 10px', borderRadius: 8, margin: '0 0 8px 28px', lineHeight: 1.6 }}>
                    📖 演示分录：{opt.demoEntries.map((e, k) => `${e.side === 'debit' ? '借' : '贷'} ${e.account} ¥${e.amount}万`).join('，')}
                  </div>
                )}
              </div>
            ))
          ) : (
            (step?.action || step?.options?.[0]?.action) ? (
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>请填写这笔业务的分录：</div>
                <EntryForm form={entryForm} setForm={setEntryForm} />
                <button className="btn mt12" onClick={submitEntry}>提交分录</button>
              </div>
            ) : <button className="btn" onClick={() => nextStep()}>继续 ➜</button>
          )}
        </div>
      )}

      {/* 困难/硬核：自写分录 / 特殊决策确认 */}
      {selfMode && (
        <div className="card">
          {isEntryAction ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>✍️ 自己写出这笔业务的分录</div>
              {brief && (
                <div style={{ fontSize: 12, background: '#E9F8F6', color: 'var(--accent-deep)', padding: '8px 10px', borderRadius: 8, marginBottom: 10, lineHeight: 1.7 }}>
                  📋 业务简报：{brief.type === 'sale' && `卖出货物 ¥${brief.amount}万，税率 ${(brief.rate * 100)}% → 销项税 ¥${brief.vat}万；结转成本 ¥${brief.cost}万`}
                  {brief.type === 'purchase' && `现金进货 ¥${brief.amount}万${brief.vat ? `，进项税 ¥${brief.vat}万（可抵扣）` : ''}`}
                  {brief.type === 'purchaseCredit' && `赊购进货 ¥${brief.amount}万${brief.vat ? `，进项税 ¥${brief.vat}万（可抵扣）` : ''}`}
                  {brief.type === 'salary' && `计提工资 ¥${brief.amount}万`}
                  {brief.type === 'rent' && `房租 ¥${brief.amount}万（含押金）`}
                </div>
              )}
              <EntryForm form={entryForm} setForm={setEntryForm} />
              <button className="btn mt12" onClick={submitEntry}>提交分录</button>
            </>
          ) : (
            step.options.length ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>⚙️ 这个决策由你拍板</div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 10 }}>{typeof step.npc === 'function' ? step.npc(sim) : step.npc}</div>
                {step.options.map((opt, i) => (
                  <div key={i} className="option" style={{ cursor: 'pointer' }} onClick={() => choose(opt)}>
                    <span className="opt-key">{i + 1}</span><span>{opt.label}</span>
                  </div>
                ))}
              </>
            ) : <button className="btn" onClick={() => nextStep()}>继续 ➜</button>
          )}
        </div>
      )}

      {lastEntries && <EntryAnimation entries={lastEntries} />}

      {analysis && (
        <div className="card" style={{ background: analysis.alert ? '#FFF6F4' : '#F7FBF8', border: `1px solid ${analysis.alert ? '#F3C0B5' : '#BFE3D0'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontWeight: 800 }}>🔍 财务诊断 · {analysis.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>本步决策影响</div>
          </div>
          {analysis.impacts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {analysis.impacts.map((it, i) => (
                <span key={i} style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
                  background: it.good ? '#E6F6EC' : '#FDEAE6',
                  color: it.good ? '#1F8A4C' : '#C0392B',
                }}>
                  {it.label} {it.dir === 'up' ? '▲' : '▼'} {fmtW(it.value)}
                </span>
              ))}
            </div>
          )}
          {analysis.focus && (
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text)', marginBottom: 6 }}>
              {analysis.focus}
            </div>
          )}
          <div style={{
            fontSize: 12.5, fontWeight: 700, lineHeight: 1.6, marginBottom: 8,
            color: analysis.alert ? '#C0392B' : '#1F8A4C',
          }}>
            {analysis.diagnosis}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
            {[
              { k: '现金(万)', v: fmtW(analysis.snapshot.cash), warn: analysis.snapshot.cash < 2 },
              { k: '累计净利(万)', v: fmtW(analysis.snapshot.netProfit), warn: analysis.snapshot.netProfit < 0 },
              { k: '负债率', v: analysis.snapshot.debtRatio + '%', warn: analysis.snapshot.debtRatio > 70 },
              { k: '合规度', v: analysis.snapshot.compliance + '/100', warn: analysis.snapshot.compliance < 40 },
            ].map((m, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 8, padding: '6px 8px', textAlign: 'center',
                border: `1px solid ${m.warn ? '#F3C0B5' : '#ECECEC'}`,
              }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-soft)' }}>{m.k}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: m.warn ? '#C0392B' : 'var(--text)' }}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reports && (
        <div ref={reportRef} className="card" style={{ background: '#FFFDF8' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>📊 当前报表（实时）</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-deep)', marginBottom: 8 }}>
            ✅ 报表已生成，可对照检查借贷逻辑（资产=负债+权益 / 收入-费用=利润）
          </div>
          <ReportLite report={reports.balance} />
          <ReportLite report={reports.income} />
          <ReportLite report={reports.cashflow} />
        </div>
      )}

      <div className="section-title mt20">📒 账本（最新 6 笔）</div>
      {[...sim.ledger].slice(-6).reverse().map((e, i) => (
        <div key={i} className="card" style={{ padding: 10, fontSize: 12 }}>
          <div style={{ fontWeight: 600 }}>第{e.month}月 · {e.desc}</div>
          {e.debit && <div style={{ color: 'var(--primary-deep)' }}>借 {e.debit} ¥{e.amt}万</div>}
          {e.credit && <div style={{ color: 'var(--accent-deep)' }}>贷 {e.credit} ¥{e.amt}万</div>}
        </div>
      ))}

      <button className="btn ghost mt12" onClick={restart}>🔄 重开一家</button>
      <button className="btn ghost mt12" onClick={() => {
        try {
          const r = buildReports(sim)
          setReports(r)
          setReportReady(true)
          // 生成后自动滚动到报表卡片，确保用户立刻看到反馈
          setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        } catch (err) {
          setRuntimeError(err)
        }
      }}>📊 {reportReady ? '重新生成报表' : '生成报表'}</button>
    </div>
  )
}

// 导出时套上 ErrorBoundary，任何渲染期异常都会显示堆栈而非白屏
export default function GameWithBoundary(props) {
  return (
    <ErrorBoundary>
      <Game {...props} />
    </ErrorBoundary>
  )
}

// 分录填写组件（借/贷 科目 + 金额）
function EntryForm({ form, setForm }) {
  return (
    <div>
      <div className="flex gap8" style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: 'var(--primary-deep)', width: 30 }}>借</span>
        <select value={form.dAcc} onChange={(e) => setForm({ ...form, dAcc: e.target.value })} style={{ flex: 1, padding: 8, borderRadius: 8, border: '2px solid var(--line)' }}>
          <option value="">选择科目</option>{ALL_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="number" value={form.dAmt} placeholder="金额" onChange={(e) => setForm({ ...form, dAmt: e.target.value })} style={{ width: 70, padding: 8, borderRadius: 8, border: '2px solid var(--line)' }} />
      </div>
      <div className="flex gap8">
        <span style={{ fontWeight: 700, color: 'var(--accent-deep)', width: 30 }}>贷</span>
        <select value={form.cAcc} onChange={(e) => setForm({ ...form, cAcc: e.target.value })} style={{ flex: 1, padding: 8, borderRadius: 8, border: '2px solid var(--line)' }}>
          <option value="">选择科目</option>{ALL_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="number" value={form.cAmt} placeholder="金额" onChange={(e) => setForm({ ...form, cAmt: e.target.value })} style={{ width: 70, padding: 8, borderRadius: 8, border: '2px solid var(--line)' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 6 }}>借贷金额需相等</div>
    </div>
  )
}

function ReportLite({ report }) {
  const title = report.type === 'balance' ? '资产负债表' : report.type === 'income' ? '利润表' : '现金流量表'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</div>
      {report.type === 'cashflow' && report.note && (
        <div style={{ fontSize: 10.5, color: 'var(--text-soft)', marginBottom: 4 }}>（{report.note}）</div>
      )}
      {report.rows.map((r, i) => {
        if (r.level === 'h') return (
          <div key={i} style={{ fontSize: 12, fontWeight: 800, marginTop: 6, color: 'var(--accent-deep)' }}>{r.item}</div>
        )
        const isTotal = r.level === 'total' || r.emphasize
        const isSub = r.level === 'sub'
        const neg = r.value != null && r.value < 0
        return (
          <div key={i} className="flex between center" style={{
            fontSize: isTotal ? 12.5 : 12,
            fontWeight: isTotal ? 800 : (isSub ? 700 : 400),
            padding: '2px 0',
            paddingLeft: isSub || isTotal ? 8 : 0,
            borderTop: isTotal ? '1px solid #d9d2c4' : 'none',
            color: neg ? '#C0392B' : (isTotal ? 'var(--primary-deep)' : 'var(--text)'),
          }}>
            <span>{r.item}</span>
            <span>{r.value == null ? '' : '¥' + fmtW(r.value) + '万'}</span>
          </div>
        )
      })}
    </div>
  )
}

// A: 四维经营能力雷达图（纯 SVG，无依赖）
function RadarChart({ scores }) {
  const axes = [
    { key: 'profit', label: '盈利能力', value: scores.profit },
    { key: 'cash', label: '现金流', value: scores.cash },
    { key: 'risk', label: '低风险', value: scores.risk },
    { key: 'compliance', label: '合规度', value: scores.compliance },
  ]
  const cx = 90, cy = 90, R = 66
  const n = axes.length
  const pt = (i, r) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]
  }
  const poly = axes.map((a, i) => pt(i, (a.value / 100) * R).join(',')).join(' ')
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>📊 经营能力雷达</div>
      <svg width="180" height="180" viewBox="0 0 180 180" style={{ maxWidth: 220 }}>
        {[0.25, 0.5, 0.75, 1].map((g, i) => (
          <polygon key={i} points={axes.map((_, k) => pt(k, R * g).join(',')).join(' ')} fill="none" stroke="#e6e1d6" />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, R)
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e6e1d6" />
        })}
        <polygon points={poly} fill="rgba(46,138,108,0.28)" stroke="var(--primary-deep)" strokeWidth="2" />
        {axes.map((a, i) => {
          const [x, y] = pt(i, (a.value / 100) * R)
          return <circle key={i} cx={x} cy={y} r="3" fill="var(--primary-deep)" />
        })}
        {axes.map((a, i) => {
          const [x, y] = pt(i, R + 14)
          return <text key={i} x={x} y={y} fontSize="10" textAnchor="middle" fill="var(--text-soft)">{a.label}</text>
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4 }}>
        {axes.map((a) => (
          <span key={a.key} className="chip" style={{ fontSize: 11 }}>{a.label} {a.value}</span>
        ))}
      </div>
    </div>
  )
}
