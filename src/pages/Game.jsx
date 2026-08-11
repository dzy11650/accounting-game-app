import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../store/UserContext.jsx'
import { COMPANIES } from '../data/companies.js'
import { STORY } from '../data/story.js'
import {
  createCompany, applyBusiness, monthEnd, buildReports, isBankrupt,
  recordVoucher, settleErrors, applyAdjust, loseLife, DIFFICULTY,
  applyFunding, applyExpand, applyTaxType, vatOnSale, vatOnPurchase,
  maybeForceGeneral, applyInvest, settleTax, TAX,
} from '../lib/engine.js'
import EntryAnimation from '../components/EntryAnimation.jsx'
import Toast from '../components/Toast.jsx'

const ALL_ACCOUNTS = ['银行存款', '库存商品', '原材料', '生产成本', '固定资产', '累计折旧',
  '应收账款', '应付账款', '短期借款', '应付职工薪酬', '应付利息', '应交税费',
  '实收资本', '主营业务收入', '主营业务成本', '管理费用', '财务费用']

const SAVE_KEY = 'accounting_game_save_v1'

// 万元金额显示：先修约到小数点后1位，消除浮点累积误差（如 27.650000000000002）
const fmtW = (v) => Number((v || 0).toFixed(1)).toFixed(1)

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
  const start = (companyId, difficulty) => {
    try {
      const c = COMPANIES.find((x) => x.id === companyId)
      const s = createCompany(companyId, difficulty) // 空壳，资金由第一章出资决策注入
      setCoId(companyId); setDiffId(difficulty); setSim(s); setPhase('play')
      setStepIdx(0); setChapterIdx(0); setAdjustTasks([]); setReports(null); setShowHint(false)
      setSaved(null); clearSave()
      setToast(`创立${c.name}（${DIFFICULTY[difficulty].name}）— 先决定出资方式`)
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
    if (a.type === 'sale' || a.type === 'purchase' || a.type === 'purchaseCredit') {
      const base = eco.dealSize * scale * boost
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
    const amt = (base) => diff.randFund ? r(base * 0.8, base * 1.3) : +base.toFixed(1)

    if (action.type === 'rent') {
      // 多付/少付：预付 months 个月房租，折扣 discount（多付折扣多、少付现金流压力小）
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
      const a = overrideAmt != null ? overrideAmt : amt(eco.dealSize * scale * boost)
      const res = vatOnPurchase(s, a, false)
      desc = `进货¥${a}万${s.taxType === 'general' ? `（进项税¥${res.vat}万可抵扣）` : ''}`
      entries = res.entries; expected = res.entries
      s.balances['库存商品'] = (s.balances['库存商品'] || 0) + a
    } else if (action.type === 'purchaseCredit') {
      const a = overrideAmt != null ? overrideAmt : amt(eco.dealSize * scale * boost)
      const res = vatOnPurchase(s, a, true)
      desc = `赊购¥${a}万${s.taxType === 'general' ? `（进项税¥${res.vat}万可抵扣）` : ''}`
      entries = res.entries; expected = res.entries
      s.balances['库存商品'] += a; s.balances['应付账款'] += a
    } else if (action.type === 'sale') {
      const a = overrideAmt != null ? overrideAmt : amt(eco.dealSize * scale * boost)
      const cost = +(a * (1 - eco.margin)).toFixed(1)
      const res = vatOnSale(s, a, co.revenueAccount)
      const forced = maybeForceGeneral(s)
      const costE = co.costOfSale(cost)
      entries = [...res.entries, ...costE]
      expected = entries
      applyBusiness(s, res.entries, `卖货¥${a}万`)
      applyBusiness(s, costE, '结转成本'); s.balances['库存商品'] -= cost
      desc = `卖货¥${a}万（销项税¥${res.vat}万）`
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
      const entries = mk('银行存款', s.balances['银行存款'], '实收资本', s.balances['实收资本'], '出资')
      if (borrow > 0) entries.push({ side: 'credit', account: '短期借款', amount: borrow, desc: '出资' })
      recordVoucher(s, { desc: '股东出资（含借款）', actual: entries, expected: entries, month: s.month })
      setToast(`出资方式：${a.own === 'low' ? '高杠杆（借70%）' : a.own === 'part' ? '借30%' : '全部自有'} — 经营规模×${s.scale}`)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'taxType') {
      applyTaxType(s, a.tax) // a.tax: 'small'|'general'
      setToast(`纳税人类型：${a.tax === 'general' ? '一般纳税人（税率13%，可抵扣进项）' : '小规模纳税人（征收率3%，进项不可抵扣）'}`)
      return { handled: true, selfContained: false }
    }
    if (a.type === 'monthEnd') {
      doMonthEnd(s); return { handled: true, selfContained: true }
    }
    if (a.type === 'tax') {
      const res = settleTax(s)
      setToast(`缴税：增值税¥${res.vatPayable}万 + 企业所得税¥${res.cit}万（${res.taxType === 'general' ? '一般纳税人' : '小规模'}）${res.forced ? ' · 已强制转一般纳税人' : ''}`)
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
    // 第七章持续经营：开始 / 继续下一个月（回到本章"进货"步，重复经营）
    if (a.type === 'loopStart' || a.type === 'loopContinue') {
      const back = 1 // 回到"进货"步（step1），重复 进→销→薪→结
      setSim(s); setStepIdx(back); persist(s, coId, diffId, chapterIdx, back, false)
      setToast(a.type === 'loopStart' ? '🚀 开始持续经营！' : `⏭️ 进入第 ${s.month} 月经营`)
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
      const s = clone(sim)
      const sp = runSpecial(s, a)
      if (sp.handled) {
        if (!sp.selfContained) afterSpecial(s) // monthEnd 自行处理推进
        return
      }
      const { entries, expected, desc } = doBusiness(s, a)
      if (diff.selfEntry) return // 困难模式不应走这里
      recordVoucher(s, { desc, actual: expected, expected, month: s.month })
      setSim(s); setLastEntries(entries); setToast(desc + ' ✓')
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
      const s = clone(sim)
      const sp = runSpecial(s, a)
      if (sp.handled) {
        if (!sp.selfContained) afterSpecial(s)
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
    const s = passed || clone(sim)
    monthEnd(s)
    const settle = settleErrors(s)
    if (settle.fatal) { fail(s, s.failedReason); return }
    setSim(s)
    setToast(`第${s.month}月结账：折旧+计息${settle.penalized ? `，罚款¥${settle.penalized}万` : ''}`)
    if (settle.tasks && settle.tasks.length) {
      setAdjustTasks(settle.tasks)
      setToast('⚠️ 本月有凭证记错，需做调整分录修正！')
    }
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
    const stars = ok ? Math.max(1, Math.min(3, (cash > 10 ? 1 : 0) + (profit > 0 ? 1 : 0) + (s.lives >= (diff.lives - 1) ? 1 : 0))) : 0
    const res = { ok, stars, reason: ok ? `通关！净利润¥${fmtW(profit)}万 现金¥${fmtW(cash)}万` : '未达成通关条件', profit, cash }
    setResult(res)
    setEnded(true)
    dispatch({ type: 'ADD_COINS', amount: ok ? 50 : 20 })
    dispatch({ type: 'ADD_EXP', amount: 60 })
    dispatch({ type: 'COMPANY_RUN', id: coId })
    dispatch({ type: 'EARN_BADGE', id: ok ? 'boss' : 'cfo' })
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
    return (
      <div className="page fade-in">
        <Toast message={toast} onClose={() => setToast('')} />
        <div className="section-title">🏢 选择公司类型</div>
        {COMPANIES.map((c) => (
          <div key={c.id} className="card">
            <div style={{ fontWeight: 800 }}>{c.emoji} {c.name}</div>
            <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 4 }}>{c.blurb}</div>
            <div className="flex" style={{ marginTop: 6 }}><span className="chip">难度 {'★'.repeat(c.difficulty)}</span><span className="chip">启动 ¥{c.initCash}万</span></div>
            <div className="section-title" style={{ margin: '12px 0 8px', fontSize: 14 }}>选择难度</div>
            {Object.values(DIFFICULTY).map((d) => (
              <button key={d.id} className="btn ghost mt12" style={{ width: '100%', padding: '10px' }} onClick={() => start(c.id, d.id)}>
                {d.name} · 容错{d.lives}次 {d.selfEntry ? '· 自写分录' : '· 选项引导'}
              </button>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (ended) {
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
          {result && (
            <div className="card" style={{ background: '#FFFDF8', textAlign: 'left', marginTop: 10 }}>
              <div>净利润：¥{fmtW(result.profit)}万</div>
              <div>现金余额：¥{fmtW(result.cash)}万</div>
              <div>容错剩余：{sim?.lives ?? 0}</div>
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
          <div style={{ fontWeight: 800 }}>{co.emoji} {co.name}</div>
          <span className="chip">{diff.name}</span>
        </div>
        <div className="flex gap8 mt12">
          <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>💵 现金</span><span className="v">¥{fmtW(sim.balances['银行存款'])}万</span></div>
          <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>📈 利润</span><span className="v">¥{fmtW(sim.balances['本年利润'])}万</span></div>
          <div className="shop-stat" style={{ flex: 1, marginBottom: 0 }}><span>❤️ 容错</span><span className="v">{sim.lives}</span></div>
        </div>
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

      {/* 简单模式：选项卡片 */}
      {!selfMode && (
        <div className="card">
          {step?.options?.length ? (
            step.options.map((opt, i) => (
              <div key={i} className="option" style={{ cursor: 'pointer' }} onClick={() => choose(opt)}>
                <span className="opt-key">{i + 1}</span><span>{opt.label}</span>
                {opt.recommended && !diff.selfEntry && <span className="chip" style={{ marginLeft: 'auto', background: 'var(--gold)', color: '#fff' }}>💡推荐</span>}
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
                <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 10 }}>{step.npc}</div>
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

      {reports && (
        <div className="card" style={{ background: '#FFFDF8' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>📊 当前报表（实时）</div>
          <ReportLite report={reports.balance} />
          <ReportLite report={reports.income} />
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
      <button className="btn ghost mt12" onClick={() => { const r = buildReports(sim); setReports(r) }}>📊 生成报表</button>
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
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{report.type === 'balance' ? '资产负债表' : '利润表'}</div>
      {report.rows.map((r, i) => (
        <div key={i} className="flex between center" style={{ fontSize: 12, padding: '2px 0' }}>
          <span>{r.item}</span><span>¥{fmtW(Math.abs(r.value))}万</span>
        </div>
      ))}
    </div>
  )
}
