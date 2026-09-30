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
  analyzeDecision, financialSnapshot, complianceNow, checkProcessBadges,
} from '../lib/engine.js'
import { pickTalents, applyTalent } from '../data/talents.js'
import TalentPicker from '../components/GameStart/TalentPicker.jsx'
import { loadSave, writeSave, clearSave } from '../lib/save.js'
import { GameRuntimeError } from '../lib/errors.js'
import EntryAnimation from '../components/EntryAnimation.jsx'
import Toast from '../components/Toast.jsx'
import CompanySelector from '../components/GameStart/CompanySelector.jsx'
import ProjectSelector from '../components/GameStart/ProjectSelector.jsx'
import LoadPrompt from '../components/GameStart/LoadPrompt.jsx'
import GameStateBar from '../components/GamePlay/GameStateBar.jsx'
import StepRenderer from '../components/GamePlay/StepRenderer.jsx'
import EvilRiskIndicator from '../components/GamePlay/EvilRiskIndicator.jsx'
import AnalysisCard from '../components/GamePlay/AnalysisCard.jsx'
import CoachHint from '../components/GamePlay/CoachHint.jsx'
import DuPontChart from '../components/GamePlay/DuPontChart.jsx'
import ReportLite from '../components/GamePlay/ReportLite.jsx'
import AdjustTask from '../components/GamePlay/AdjustTask.jsx'
import StrikeDialog from '../components/GamePlay/StrikeDialog.jsx'
import GeneralConfirm from '../components/GamePlay/GeneralConfirm.jsx'
import ResultCard from '../components/GameResult/ResultCard.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[Game ErrorBoundary]', error, info) }
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

/**
 * 计算困难模式业务简报（金额/税率），保证自写分录公平判分
 */
function computeBrief(sim, action, co, diff) {
  const eco = co.economics
  const scale = sim.scale || 1
  const boost = 1 + (sim.boost || 0)
  const we = wageEfficiency(sim)
  const mf = action.type === 'sale' ? moodFactor(sim) : 1
  if (action.type === 'sale' || action.type === 'purchase' || action.type === 'purchaseCredit') {
    const base = eco.dealSize * scale * boost * mf * we * (1 + (sim.eventBuff?.purchaseUp || 0) - (sim.eventBuff?.purchaseDown || 0))
    const amount = diff.randFund ? +(base * (0.8 + Math.random() * 0.5)).toFixed(1) : +base.toFixed(1)
    const rate = sim.taxType === 'general' ? TAX.VAT_GENERAL : TAX.VAT_SMALL
    return { type: action.type, amount, rate, vat: +(amount * rate).toFixed(2), cost: +(amount * (1 - eco.margin)).toFixed(1) }
  }
  if (action.type === 'salary') return { type: 'salary', amount: +(eco.salary * scale * (1 + (sim.eventBuff?.salaryUp || 0))).toFixed(1) }
  if (action.type === 'rent') return { type: 'rent', amount: +(eco.rent * scale).toFixed(1) }
  return null
}

function mk(d, da, c, ca, desc) {
  return [
    { side: 'debit', account: d, amount: da, desc },
    { side: 'credit', account: c, amount: ca, desc },
  ]
}

function Game() {
  const navigate = useNavigate()
  const { state: userState, dispatch } = useUser()
  // 用 ref 避免闭包读到旧的 metaLevel/metaUnlockedTalents
  const useUserStateRef = useRef(userState)
  useUserStateRef.current = userState
  const [saved, setSaved] = useState(() => loadSave())
  const [phase, setPhase] = useState(() => (saved ? 'askLoad' : 'select')) // select | askLoad | play | ended
  const [coId, setCoId] = useState(null)
  const [diffId, setDiffId] = useState('easy')
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
  const [entryForm, setEntryForm] = useState({ dAcc: '', dAmt: '', cAcc: '', cAmt: '' })
  const [brief, setBrief] = useState(null)
  const [runtimeError, setRuntimeError] = useState(null)
  const reportRef = useRef(null)
  const [reportReady, setReportReady] = useState(false)
  const [monthOrders, setMonthOrders] = useState([])
  const [pendingStrike, setPendingStrike] = useState(null)
  const [showGeneralConfirm, setShowGeneralConfirm] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [wrongStreak, setWrongStreak] = useState(0)
  const [pendingTalent, setPendingTalent] = useState(null) // { picks, year, isNewGame? }

  const chapter = STORY[chapterIdx]
  const step = chapter?.steps[stepIdx]
  const diff = DIFFICULTY[diffId]
  const co = COMPANIES.find((c) => c.id === coId)

  useEffect(() => {
    const selfModeNow = diff.selfEntry && step?.options?.[0]?.action
    const curActionNow = step?.options?.[0]?.action
    const entryActionTypes = ['rent', 'fixed', 'purchase', 'purchaseCredit', 'sale', 'salary']
    const isEntryActionNow = curActionNow && entryActionTypes.includes(curActionNow.type)
    if (selfModeNow && isEntryActionNow && sim && co) setBrief(computeBrief(sim, curActionNow, co, diff))
    else setBrief(null)
  }, [chapterIdx, stepIdx, coId, diffId, sim, diff?.selfEntry])

  const persist = (simObj, cId, dId, cIdx, sIdx, end) => {
    writeSave({ sim: simObj, coId: cId, diffId: dId, chapterIdx: cIdx, stepIdx: sIdx, ended: !!end })
  }

  const chooseCompany = (companyId) => setPendingCompany(COMPANIES.find((x) => x.id === companyId))

  const start = (companyId, difficulty, projectId = null) => {
    try {
      const c = COMPANIES.find((x) => x.id === companyId)
      const proj = c.projects?.find((p) => p.id === projectId)
      const s = createCompany(companyId, difficulty, projectId)
      // roguelike 天赋：开局三选一（简单模式可跳过）
      // 局外成长：metaUnlockedTalents 必出 1 张；metaLevel-1 = 额外免费天赋位（上限 2）
      const freeSlots = Math.min(2, (useUserStateRef.current?.metaLevel || 1) - 1)
      const metaUnlocked = useUserStateRef.current?.metaUnlockedTalents || []
      const tp = pickTalents(difficulty, Math.random, { metaUnlocked, freeSlots })
      setPendingTalent({ picks: tp.picks, freePicks: tp.freePicks, freeSlots: tp.freeSlots, year: 0, isNewGame: true })
      setCoId(companyId); setDiffId(difficulty); setSim(s); setPhase('play')
      setStepIdx(0); setChapterIdx(0); setAdjustTasks([]); setReports(null); setShowHint(false)
      setSaved(null); clearSave(); setPendingCompany(null)
      const projLabel = proj ? ` · ${proj.emoji}${proj.name}` : ''
      setToast(`创立${c.name}${projLabel}（${DIFFICULTY[difficulty].name}）— 先决定出资方式`)
      setLastEntries(s.ledger.slice(-3))
      persist(s, companyId, difficulty, 0, 0, false)
    } catch (e) {
      setRuntimeError(new GameRuntimeError('start', e).message)
    }
  }

  const resume = (save) => {
    setSim(save.sim); setCoId(save.coId); setDiffId(save.diffId)
    setChapterIdx(save.chapterIdx || 0); setStepIdx(save.stepIdx || 0)
    setReports(null); setShowHint(false)
    if (save.ended) { setEnded(true); setResult(save.result || null) }
    else setPhase('play')
    setSaved(null)
    setLastEntries(save.sim?.ledger?.slice(-3))
  }

  const doBusiness = (s, action, overrideAmt) => {
    const eco = co.economics
    const scale = s.scale || 1
    const boost = 1 + (s.boost || 0)
    const costMult = (s.diffEcon && s.diffEcon.costMult) || 1
    const marginMult = (s.diffEcon && s.diffEcon.marginMult) || 1
    let entries = [], expected = [], desc = ''
    const r = (a, b) => +(a + Math.random() * (b - a)).toFixed(1)
    const we = wageEfficiency(s)
    const amt = (base) => diff.randFund ? r(base * 0.8, base * 1.3) : +base.toFixed(1)
    // 天赋·价格战红利：售价 +8%；天赋·安全库存：采购资金占用 +5%
    const dealAmt = (rawBase, isPurchase = false) =>
      amt(rawBase * moodFactor(s) * we * (1 + (isPurchase ? 0 : (s.salePriceBoost || 0))) * (isPurchase ? (s.stockTieMult || 1) : 1))

    if (action.type === 'rent') {
      if (s.eventBuff?.skipRent) {
        desc = '房东免租：本月房租全免，省下一笔固定开支'
        applyBusiness(s, [], desc)
        return { entries, expected, desc, s }
      }
      const months = action.months || 1
      const discount = action.discount || 0
      const grossMonthly = eco.rent * scale * costMult
      const monthlyRent = +(grossMonthly * (1 - discount)).toFixed(1)
      const deposit = +grossMonthly.toFixed(1)
      const prepaid = +(monthlyRent * months).toFixed(1)
      const totalOut = +(deposit + prepaid).toFixed(1)
      s.choices.rentMonths = months
      s.choices.rentDiscount = discount
      desc = `付押金¥${deposit}万 + 预付房租${months}个月¥${prepaid}万${discount ? `（享${Math.round(discount * 100)}%折扣）` : ''}`
      entries.push(...mk('预付账款', deposit, '银行存款', deposit, desc))
      entries.push(...mk('预付账款-房租', prepaid, '银行存款', prepaid, desc))
      if (s.balances['预付账款-房租'] == null) s.balances['预付账款-房租'] = 0
      s.balances['预付账款-房租'] = +(s.balances['预付账款-房租'] + prepaid).toFixed(2)
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
      const purchaseFactor = 1 + (s.eventBuff?.purchaseUp || 0) - (s.eventBuff?.purchaseDown || 0)
      const a = overrideAmt != null ? overrideAmt : dealAmt(eco.dealSize * scale * boost * Math.max(0.5, purchaseFactor), true)
      const res = vatOnPurchase(s, a, false)
      desc = `进货¥${a}万${s.taxType === 'general' ? `（进项税¥${res.vat}万可抵扣）` : ''}`
      entries = res.entries; expected = res.entries
      s.balances['库存商品'] = (s.balances['库存商品'] || 0) + a
    } else if (action.type === 'purchaseCredit') {
      const purchaseFactor = 1 + (s.eventBuff?.purchaseUp || 0) - (s.eventBuff?.purchaseDown || 0)
      const a = overrideAmt != null ? overrideAmt : dealAmt(eco.dealSize * scale * boost * Math.max(0.5, purchaseFactor), true)
      const res = vatOnPurchase(s, a, true)
      desc = `赊购¥${a}万${s.taxType === 'general' ? `（进项税¥${res.vat}万可抵扣）` : ''}`
      entries = res.entries; expected = res.entries
      s.balances['库存商品'] += a; s.balances['应付账款'] += a
      s.payablesDue = s.payablesDue || []
      s.payablesDue.push({ due: s.month + 3, amount: +(a + res.vat).toFixed(2) })
    } else if (action.type === 'sale') {
      const a = overrideAmt != null ? overrideAmt : dealAmt(eco.dealSize * scale * boost * (1 + (s.eventBuff?.saleUp || 0)))
      const cost = +(a * (1 - eco.margin * marginMult)).toFixed(1)
      const res = vatOnSale(s, a, co.revenueAccount)
      const forced = maybeForceGeneral(s)
      const costE = co.costOfSale(cost)
      entries = [...res.entries, ...costE]
      expected = entries
      applyBusiness(s, res.entries, `卖货¥${a}万`)
      applyBusiness(s, costE, '结转成本'); s.balances['库存商品'] -= cost
      desc = `卖货¥${a}万（销项税¥${res.vat}万）`
      s.quarterRevenue = +(s.quarterRevenue || 0) + a
      if (forced) setToast('⚠️ 年销售额超500万，已强制转为一般纳税人！税率13%且可抵扣进项')
      return { entries, expected, desc, s }
    } else if (action.type === 'salary') {
      const salaryFactor = 1 + (s.eventBuff?.salaryUp || 0)
      const a = +(eco.salary * scale * costMult * salaryFactor).toFixed(1)
      desc = `计提工资¥${a}万${salaryFactor > 1 ? '（含加薪）' : ''}`
      entries = [{ side: 'debit', account: '管理费用-工资', amount: a }, { side: 'credit', account: '应付职工薪酬', amount: a }]
      expected = entries
    }

    applyBusiness(s, entries, desc)
    return { entries, expected, desc, s }
  }

  const runSpecial = (s, a) => {
    if (a.type === 'fund') {
      applyFunding(s, a.own)
      const borrow = s.balances['短期借款']
      trackChoice(s, 'leverage', { value: a.own === 'full' ? 'full' : 'partial', borrow })
      const entries = mk('银行存款', s.balances['银行存款'], '实收资本', s.balances['实收资本'], '出资')
      if (borrow > 0) entries.push({ side: 'credit', account: '短期借款', amount: borrow, desc: '出资' })
      recordVoucher(s, { desc: '股东出资（含借款）', actual: entries, expected: entries, month: s.month })
      setToast(`出资方式：${a.own === 'low' ? '高杠杆（借70%）' : a.own === 'part' ? '借30%' : '全部自有'} — 经营规模×${s.scale}`)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'taxType') {
      applyTaxType(s, a.tax)
      trackChoice(s, 'taxType', { value: a.tax })
      setToast(`纳税人类型：${a.tax === 'general' ? '一般纳税人（税率13%，可抵扣进项）' : '小规模纳税人（征收率3%，进项不可抵扣）'}`)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'monthEnd') { doMonthEnd(s); return { handled: true, selfContained: true } }
    if (a.type === 'tax') {
      let plans = a.plans || []
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
      applyInvest(s, a.kind, a.level)
      setToast(`投入决策（${a.kind}）：${a.level === 'high' ? '高投入→后续营收+25%，但前置营销成本已发生' : '低投入→营收小幅提升，无前置成本'}`)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'evilSalary') {
      const msg = evilSalary(s); setToast(msg)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'evilTaxAdjust') {
      const msg = evilTaxAdjust(s, a.ratio); setToast(msg)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'evilTaxOwe') {
      const msg = evilTaxOwe(s); setToast(msg)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'resolveStrike') {
      const msg = resolveStrike(s, a.option); setToast(msg); setPendingStrike(null)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'evilFakeInvoice') {
      const msg = evilAct(s, 'fakeInvoice'); setToast(msg)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'loopStart' || a.type === 'loopContinue') {
      if (a.type === 'loopStart') {
        s.year = 1
        s.yearMood = rollYearMood()
        s.reachedMilestones = []
        s.choiceLog = s.choiceLog || []
        s.receivables = []
        s.payablesDue = []
      }
      if (chapter.id === 'continuing') {
        // 天赋·爆款单品：每月第 1 张订单 margin +15%
        const orders = []
        for (let i = 0; i < 3; i++) orders.push(genOrder(s, Math.random, { hitProduct: i === 0 }))
        s.monthOrders = orders
        setMonthOrders(orders)
      } else {
        setMonthOrders([])
      }
      const back = 1
      setSim(s); setStepIdx(back); persist(s, coId, diffId, chapterIdx, back, false)
      const orderCount = (s.monthOrders || []).length
      setToast(a.type === 'loopStart' ? `🚀 开始持续经营！本年行情：${MOOD_LABEL[s.yearMood]}（第1年）` : `⏭️ 进入第 ${s.month} 月经营（${MOOD_LABEL[s.yearMood] || '⛅'} 第${s.year || 1}年），本月 ${orderCount} 张订单待接`)
      return { handled: true, selfContained: true }
    }
    if (a.type === 'close') {
      setSim(s)
      finish(s)
      return { handled: true, selfContained: true }
    }
    return { handled: false }
  }

  const doSaleOnce = () => {
    try {
      const before = clone(sim)
      const s = clone(sim)
      const a = { type: 'sale', boost: 1 }
      const { entries, expected, desc } = doBusiness(s, a)
      recordVoucher(s, { desc, actual: expected, expected, month: s.month })
      s.salesThisMonth = (s.salesThisMonth || 0) + 1
      s.choices = s.choices || {}
      s.choices.sales = (s.choices.sales || 0) + 1
      setSim(s); setLastEntries(entries); setToast(`${desc} ✓（本月已做 ${s.salesThisMonth} 笔销售）`)
      setAnalysis(analyzeDecision(before, s, a, { title: `第 ${s.salesThisMonth} 笔销售` }))
      persist(s, coId, diffId, chapterIdx, stepIdx, false)
    } catch (e) {
      setRuntimeError(new GameRuntimeError('doSaleOnce', e).message)
    }
  }

  const finishSaleMonth = () => {
    const s = clone(sim)
    if ((s.salesThisMonth || 0) === 0) {
      setToast('⚠️ 本月一笔销售都没做，至少做一笔再继续吧')
      return
    }
    s.salesThisMonth = 0
    setSim(s)
    nextStep()
  }

  const requestGeneral = () => {
    try {
      const before = clone(sim)
      const s = clone(sim)
      applyTaxType(s, 'general')
      s.choices = s.choices || {}
      s.choices.taxType = 'general'
      s.usedTaxPlans = s.usedTaxPlans || []
      if (!s.usedTaxPlans.includes('generalSwitch')) s.usedTaxPlans.push('generalSwitch')
      setSim(s)
      persist(s, coId, diffId, chapterIdx, stepIdx, false)
      setShowGeneralConfirm(false)
      setToast('✓ 已转为一般纳税人：增值税率13%，今后进货的进项税可抵扣销项税')
      setAnalysis(analyzeDecision(before, s, { type: 'taxType', label: '转为一般纳税人' }, { title: '税务身份变更' }))
    } catch (e) {
      setRuntimeError(new GameRuntimeError('requestGeneral', e).message)
    }
  }

  const choose = (opt) => {
    try {
      if (!opt || !opt.action) { nextStep(); return }
      const a = opt.action
      const before = clone(sim)
      const s = clone(sim)
      const sp = runSpecial(s, a)
      if (sp.handled) {
        if (!sp.selfContained) { afterSpecial(s) } else {
          setAnalysis(analyzeDecision(before, s, a, { title: '操作被拦截' }))
        }
        return
      }
      const { entries, expected, desc } = doBusiness(s, a)
      if (diff.selfEntry) return
      recordVoucher(s, { desc, actual: expected, expected, month: s.month })
      setSim(s); setLastEntries(entries); setToast(desc + ' ✓')
      setAnalysis(analyzeDecision(before, s, a))
      afterAction(s)
    } catch (e) {
      setRuntimeError(new GameRuntimeError('choose', e).message)
    }
  }

  const submitEntry = () => {
    try {
      const a = step.options[0]?.action
      if (!a) { nextStep(); return }
      const before = clone(sim)
      const s = clone(sim)
      const sp = runSpecial(s, a)
      if (sp.handled) {
        if (!sp.selfContained) { afterSpecial(s) } else {
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
        setWrongStreak(0)
        setToast('✓ 分录正确！')
        setLastEntries(entries)
      } else {
        setWrongStreak((n) => n + 1)
        loseLife(s)
        setToast(diff.autoFix ? '记错啦，已自动修正' : `✗ 分录有误，扣 1 次容错（剩 ${s.lives}）`)
        setLastEntries(entries)
      }
      setAnalysis(analyzeDecision(before, s, a, { title: '自写分录：' + desc }))
      setEntryForm({ dAcc: '', dAmt: '', cAcc: '', cAmt: '' })
      afterAction(s)
    } catch (e) {
      setRuntimeError(new GameRuntimeError('submitEntry', e).message)
    }
  }

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

  const doMonthEnd = (passed) => {
    const before = clone(sim)
    const s = passed || clone(sim)
    monthEnd(s)
    const extras = endOfMonthExtras(s, { rollEvent: true })
    if (extras.ev) setToast(`🎲 ${extras.ev.emoji} ${extras.ev.title}：${extras.ev.desc}`)
    if (extras.miles && extras.miles.length) {
      setTimeout(() => setToast(`🏁 里程碑达成：${extras.miles.map((m) => m.emoji + m.title).join('、')}`), 1200)
    }
    const settle = settleErrors(s)
    if (settle.fatal) { fail(s, s.failedReason); return }
    setSim(s)
    // 天赋系统：跨年（year+1）且已选 <3 张时，进入天赋补给
    const prevYear = sim.year || 1
    if ((s.year || 1) > prevYear && (s.talents || []).length < 3) {
      const freeSlots2 = Math.min(2, (useUserStateRef.current?.metaLevel || 1) - 1)
      const tp2 = pickTalents(diffId, Math.random, { metaUnlocked: useUserStateRef.current?.metaUnlockedTalents || [], freeSlots: freeSlots2 })
      setPendingTalent({ picks: tp2.picks, freePicks: tp2.freePicks, freeSlots: tp2.freeSlots, year: s.year })
    }
    if (s.pendingStrike) setPendingStrike({ month: s.month })
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
    setAnalysis(analyzeDecision(before, s, { type: 'monthEnd' }, { title: `第 ${s.month} 月结账体检` }))
    // 每月检查过程成就
    const newBadges = checkProcessBadges(s)
    if (newBadges.length) setTimeout(() => setToast(`🏅 新成就：${newBadges.join('、')}`), 2400)
    if (s.failed) { fail(s, s.failedReason); return }
    if (isBankrupt(s)) { fail(s, '资不抵债，公司破产！'); return }
    nextStep()
  }

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

  const acceptOrder = (order) => {
    try {
      const s = clone(sim)
      fulfillOrder(s, order)
      s.monthOrders = (s.monthOrders || []).filter((o) => o.id !== order.id)
      s.salesThisMonth = (s.salesThisMonth || 0) + 1
      s.choices = s.choices || {}
      s.choices.sales = (s.choices.sales || 0) + 1
      setMonthOrders(s.monthOrders)
      setSim(s)
      persist(s, coId, diffId, chapterIdx, stepIdx, false)
      setToast(`✓ 已接「${order.customer}」订单（本月第 ${s.salesThisMonth} 笔销售）：销售额¥${fmtW(order.amount)}万，预计毛利¥${fmtW(order.profit)}万${order.credit > 0 ? `（赊销${order.credit}月后回款）` : '（现结）'}`)
    } catch (e) {
      setRuntimeError(new GameRuntimeError('acceptOrder', e).message)
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
    const scores = scoreMetrics(s)
    const stars = overallStars(scores)
    const res = {
      ok, stars,
      reason: ok ? `通关！净利润¥${fmtW(profit)}万 现金¥${fmtW(cash)}万` : '未达成通关条件',
      profit, cash, scores,
      insights: decisionInsights(s),
      milestones: (s.reachedMilestones || []).map((id) => MILESTONES.find((m) => m.id === id)).filter(Boolean),
      ordersFulfilled: s.choices?.ordersFulfilled || 0,
    }
    setResult(res)
    setEnded(true)
    // 局外经济：营业利润越大，金币越多（复用上方已声明的 profit）
    const coins = ok ? Math.max(20, Math.round(profit * 2)) : 10
    dispatch({ type: 'ADD_COINS', amount: coins })
    dispatch({ type: 'ADD_EXP', amount: 60 })
    // 局外经验 = 净利润 × 2（驱动局外等级 → 开局免费天赋位）
    dispatch({ type: 'ADD_META_XP', amount: Math.max(0, Math.round(profit * 2)) })
    dispatch({ type: 'COMPANY_RUN', id: coId })
    dispatch({ type: 'EARN_BADGE', id: ok ? 'boss' : 'cfo' })
    dispatch({
      type: 'RECORD_RUN',
      coId, coName: s.co?.name || coId,
      profit: +(s.balances['本年利润'] || 0).toFixed(2),
      stars: res.stars, months: s.month, date: new Date().toISOString().slice(0, 10),
    })
    res.milestones.forEach((m) => dispatch({ type: 'EARN_BADGE', id: 'ms_' + m.id }))
    if (ok && s.evilCount === 0 && s.month >= 12) dispatch({ type: 'EARN_BADGE', id: 'noEvil' })
    if (ok && diffId === 'hardcore' && (s.errors || []).length === 0) dispatch({ type: 'EARN_BADGE', id: 'cleanBook' })
    clearSave(); setSaved(null)
  }

  const fail = (s, reason) => {
    setSim(s)
    const res = { ok: false, stars: 0, reason, profit: s.balances['本年利润'] || 0, cash: s.balances['银行存款'] }
    setResult(res)
    setEnded(true)
    dispatch({ type: 'ADD_COINS', amount: 10 })
    persist(s, coId, diffId, chapterIdx, stepIdx, true)
    setResult((r) => ({ ...r, failed: true }))
  }

  const restart = () => {
    clearSave(); setSaved(null)
    setPhase('select'); setSim(null); setReports(null); setEnded(false); setResult(null); setAdjustTasks([]); setStepIdx(0); setChapterIdx(0)
  }

  // ============ 状态拷贝 ============
// 说明：引擎（engine.js）大量使用「就地修改 state」的写法（applyBusiness / monthEnd / settleTax …），
// 因此每次状态推进前必须拿到一个「与历史快照完全隔离」的深拷贝，否则 analyzeDecision 的
// before/after 对比会被就地修改污染。
// 实现：优先使用 structuredClone（原生深拷贝，比 JSON 序列化快约 1 个数量级且无函数丢失问题）；
// 不支持时回退到递归拷贝；最后才回退 JSON（JSON 方案会丢弃 co 对象里的函数属性，
// 故不作为首选）。
//
// 关键陷阱：s.co 是 companies.js 导出的公司对象，其字段（costOfSale、purchase、fixedAssets 等）
// 包含函数（如 co.costOfSale = (amt) => [...]）。structuredClone 无法克隆函数，
// 故必须保持 s.co 的原始引用，不能对它做深拷贝，否则引擎调用 co.costOfSale() 时会报错。
function deepClonePlain(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(deepClonePlain)
  const out = {}
  for (const k of Object.keys(value)) out[k] = deepClonePlain(value[k])
  return out
}

const clone = (s) => {
  if (s == null) return s
  if (typeof structuredClone === 'function') {
    try {
      const result = structuredClone(s)
      // co 字段是外部数据（含函数），保持原始引用
      result.co = s.co
      return result
    } catch (e) {
      // structuredClone 因含函数而失败，走递归拷贝
    }
  }
  try {
    const result = deepClonePlain(s)
    // 递归拷贝同样丢失了 co 里的函数，恢复原始引用
    result.co = s.co
    return result
  } catch (e) {
    // 最后兜底：JSON 会丢失函数，需恢复 co 引用
    const result = JSON.parse(JSON.stringify(s))
    result.co = s.co
    return result
  }
}

  // ============ 渲染 ============

  if (phase === 'askLoad' && saved) {
    return <LoadPrompt saveData={saved} onContinue={() => resume(saved)} onNewGame={() => { clearSave(); setSaved(null); setPhase('select') }} />
  }

  if (phase === 'select') {
    if (pendingCompany) {
      return (
        <>
          <Toast message={toast} onClose={() => setToast('')} />
          <ProjectSelector
            company={pendingCompany}
            selectedDiff={diffId}
            onSelectDiff={(d, projectId) => start(pendingCompany.id, d || 'easy', projectId)}
            onQuickStart={(projectId) => start(pendingCompany.id, diffId, projectId)}
          />
          <button className="btn ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => setPendingCompany(null)}>← 换家公司</button>
        </>
      )
    }
    return (
      <>
        <Toast message={toast} onClose={() => setToast('')} />
        <CompanySelector onSelect={chooseCompany} />
      </>
    )
  }

  if (ended) {
    // 失败/通关结果统一走 ResultCard（游戏化结算），不再依赖 ErrorBoundary 展示崩溃信息。
    // 硬核模式（容错 0 次）失败时额外强化提示并提供「返回主界面」入口。
    const isHardcoreFail = !result?.ok && diffId === 'hardcore'
    return (
      <ResultCard
        result={{
          ...result,
          reason: isHardcoreFail ? `硬核模式 · 容错 0 次，${result?.reason || '一次错误即失败'}` : result?.reason,
        }}
        sim={sim}
        onRestart={restart}
        onHome={() => { clearSave(); navigate('/') }}
        shareContext={{ coName: co?.name, projectName: sim?.projectName }}
      />
    )
  }

  if (pendingTalent && sim) {
    const chooseTalent = (talent) => {
      const s = clone(sim)
      applyTalent(s, talent)
      setSim(s)
      persist(s, coId, diffId, chapterIdx, stepIdx, false)
      setPendingTalent(null)
      setToast(`🎴 天赋生效：${talent.name} — ${talent.desc}`)
    }
    const skipTalent = () => {
      setPendingTalent(null)
      setToast('未选天赋，直接开始经营')
    }
    return (
      <>
        <Toast message={toast} onClose={() => setToast('')} />
        <TalentPicker
          picks={pendingTalent.picks}
          onSelect={chooseTalent}
          onSkip={pendingTalent.isNewGame ? skipTalent : null}
          title={pendingTalent.isNewGame ? '开局选择天赋' : `第${pendingTalent.year}年 · 天赋补给`}
          subtitle="roguelike 天赋：每年重抽，最多 3 张。选择后永久生效，会计分录随之变化。"
        />
      </>
    )
  }

  if (adjustTasks.length > 0) {
    return (
      <>
        <Toast message={toast} onClose={() => setToast('')} />
        <AdjustTask task={adjustTasks[0]} entryForm={entryForm} setEntryForm={setEntryForm} onSubmit={submitAdjust} />
      </>
    )
  }

  if (pendingStrike) {
    return (
      <>
        <Toast message={toast} onClose={() => setToast('')} />
        <StrikeDialog sim={sim} onResolve={(option) => runSpecial({ type: 'resolveStrike', option })} />
      </>
    )
  }

  if (showGeneralConfirm) {
    return (
      <>
        <Toast message={toast} onClose={() => setToast('')} />
        <GeneralConfirm onConfirm={requestGeneral} onCancel={() => setShowGeneralConfirm(false)} />
      </>
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

      <GameStateBar sim={sim} chapter={chapter} />

      {chapter?.loop && sim && sim.evilCount > 0 && (
        <EvilRiskIndicator sim={sim} />
      )}

      <CoachHint wrongStreak={wrongStreak} onDismiss={() => setWrongStreak(0)} />

      {chapter?.loop && sim && (
        <DuPontChart state={sim} />
      )}

      <div className="card" style={{ background: '#FFFDF8', borderLeft: '5px solid var(--primary)' }}>
        <div style={{ fontWeight: 700, color: 'var(--primary-deep)', fontSize: 13 }}>
          {chapter.title} · 第{sim.month}月{chapter.loop ? `（第 ${Math.ceil(sim.month / 12)} 年）` : ''}
        </div>
        <div style={{ marginTop: 6, lineHeight: 1.7 }}>
          {typeof step?.npc === 'function' ? step?.npc(sim) : step?.npc}
        </div>
        {step?.teach && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent-deep)', background: '#E9F8F6', padding: '8px 10px', borderRadius: 8 }}>💡 {step.teach}</div>
        )}
      </div>

      <StepRenderer
        step={step}
        diff={diff}
        sim={sim}
        brief={brief}
        entryForm={entryForm}
        setEntryForm={setEntryForm}
        onChoose={choose}
        onSubmitEntry={submitEntry}
        onContinue={() => nextStep()}
        onShowHint={() => setShowHint((v) => !v)}
        showHint={showHint}
      />

      {!diff.selfEntry && chapter.id === 'continuing' && step?.options?.[0]?.action?.type === 'sale' && (
        <div className="card">
          {sim.taxType === 'small' && (
            <div style={{ border: '1.5px dashed var(--accent-deep)', borderRadius: 12, padding: '10px 12px', background: '#E9F8F6', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>🧾 增值税身份：当前为「小规模纳税人」</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)', margin: '6px 0', lineHeight: 1.7 }}>
                小规模纳税人按 3% 征收率计税、<b>不能抵扣进项税</b>；而一般纳税人按 13% 计税，但<b>进货的进项税额可以抵扣销项税额</b>。
              </div>
              <button className="btn" style={{ width: '100%', background: 'var(--accent-deep)', color: '#fff' }} onClick={() => setShowGeneralConfirm(true)}>🔁 申请转为一般纳税人（可抵扣进项）</button>
            </div>
          )}
          {sim.taxType === 'general' && (
            <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 8, background: '#E3F6EF', padding: '8px 10px', borderRadius: 8 }}>
              ✅ 当前为「一般纳税人」，增值税率 13%，进货进项税可抵扣销项税。
            </div>
          )}
          <div style={{ fontWeight: 700, marginBottom: 4 }}>📥 本月销售（可多次成交，做完再"完成本月销售"）</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 8 }}>
            本月已做 <b>{sim.salesThisMonth || 0}</b> 笔销售。可反复点"卖货收款"多做几笔，或挑订单接单。
          </div>
          {monthOrders.length > 0 && (
            <>
              <div style={{ fontWeight: 600, fontSize: 13, margin: '6px 0' }}>📋 可选订单（点击接单）</div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
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
                      {/* 天赋·数据看板：显示预计现金流影响（毛利 - 赊销占用） */}
                      {sim.talentDataBoard && (
                        <span style={{ marginLeft: 8, color: 'var(--text-soft)' }}>
                          现金影响 ¥{fmtW(o.credit > 0 ? o.profit - o.amount * 0.1 : o.profit)}万{o.credit > 0 ? `（赊销占用 ${o.credit} 月）` : ''}
                        </span>
                      )}
                    </div>
                    <button className="btn-sm" onClick={() => acceptOrder(o)} style={{ width: '100%' }}>接单并记账</button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <button className="btn" style={{ flex: 1, minWidth: 140 }} onClick={doSaleOnce}>🛒 卖货收款（再做一笔）</button>
            <button className="btn" style={{ flex: 1, minWidth: 140, background: 'var(--gold)', color: '#fff' }} onClick={finishSaleMonth}>✅ 完成本月销售（{sim.salesThisMonth || 0}笔）</button>
          </div>
        </div>
      )}

      {lastEntries && <EntryAnimation entries={lastEntries} />}

      <AnalysisCard analysis={analysis} />

      {reports && (
        <div ref={reportRef} className="card" style={{ background: '#FFFDF8' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>📊 当前报表（实时）</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-deep)', marginBottom: 8 }}>
            ✅ 报表已生成，可对照检查借贷逻辑
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
          setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        } catch (err) {
          setRuntimeError(err)
        }
      }}>📊 {reportReady ? '重新生成报表' : '生成报表'}</button>
    </div>
  )
}

export default function GameWithBoundary(props) {
  return (
    <ErrorBoundary>
      <Game {...props} />
    </ErrorBoundary>
  )
}
