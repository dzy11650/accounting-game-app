/**
 * 剧情步骤渲染器
 * 根据当前 step 类型渲染不同的 UI（选项卡片、自写分录、特殊弹窗等）
 */
import React from 'react'
import EntryForm from './EntryForm.jsx'

const ENTRY_ACTION_TYPES = ['rent', 'fixed', 'purchase', 'purchaseCredit', 'sale', 'salary']

export default function StepRenderer({
  step, diff, sim, brief, entryForm, setEntryForm,
  onChoose, onSubmitEntry, onContinue, onShowHint, showHint
}) {
  if (!step) return null

  const selfMode = diff?.selfEntry && step?.options?.[0]?.action
  const curAction = step?.options?.[0]?.action
  const isEntryAction = curAction && ENTRY_ACTION_TYPES.includes(curAction.type)

  // 纯对话步骤（无选项）
  if (step.options?.length === 0) {
    return (
      <div className="card" style={{ background: '#FFFDF8', borderLeft: '5px solid var(--primary)' }}>
        <div style={{ fontWeight: 700, color: 'var(--primary-deep)', fontSize: 13 }}>
          {step.npc}
        </div>
        {step.teach && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent-deep)', background: '#E9F8F6', padding: '8px 10px', borderRadius: 8 }}>
            💡 {step.teach}
          </div>
        )}
        <button className="btn mt12" onClick={onContinue}>继续 ➜</button>
      </div>
    )
  }

  // 简单模式：选项卡片
  if (!selfMode) {
    return (
      <div className="card">
        <div className="npc-text" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
          {typeof step.npc === 'function' ? step.npc(sim) : step.npc}
        </div>
        {step.teach && (
          <div style={{ fontSize: 12, color: 'var(--accent-deep)', background: '#E9F8F6', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
            💡 {step.teach}
          </div>
        )}
        <button className="btn ghost" style={{ width: 'auto', padding: '6px 12px', fontSize: 12, marginBottom: 10 }} onClick={onShowHint}>
          {showHint ? '收起提示' : '💡 卡住了？看思路'}
        </button>
        {showHint && (
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 10, lineHeight: 1.7 }}>
            {step.teach && <div>思路：{step.teach}</div>}
            {step.options.filter((o) => o.teach).map((o, i) => (
              <div key={i} style={{ marginTop: 4 }}>{o.teach}</div>
            ))}
          </div>
        )}
        {step.options.map((opt, i) => (
          <div key={i} className="option" style={{ cursor: 'pointer', marginBottom: 8 }} onClick={() => onChoose(opt)}>
            <span className="opt-key">{i + 1}</span>
            <span>{opt.label}</span>
            {opt.recommended && !diff?.selfEntry && (
              <span className="chip" style={{ marginLeft: 'auto', background: 'var(--gold)', color: '#fff' }}>💡推荐</span>
            )}
          </div>
        ))}
      </div>
    )
  }

  // 困难/硬核模式：自写分录
  return (
    <div className="card">
      <div className="npc-text" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
        {typeof step.npc === 'function' ? step.npc(sim) : step.npc}
      </div>
      {step.teach && (
        <div style={{ fontSize: 12, color: 'var(--accent-deep)', background: '#E9F8F6', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
          💡 {step.teach}
        </div>
      )}
      {isEntryAction && brief ? (
        <div style={{ fontSize: 12, background: '#E9F8F6', color: 'var(--accent-deep)', padding: '8px 10px', borderRadius: 8, marginBottom: 10, lineHeight: 1.7 }}>
          📋 业务简报：
          {brief.type === 'sale' && `卖出货物 ¥${brief.amount}万，税率 ${(brief.rate * 100)}% → 销项税 ¥${brief.vat}万；结转成本 ¥${brief.cost}万`}
          {brief.type === 'purchase' && `现金进货 ¥${brief.amount}万${brief.vat ? `，进项税 ¥${brief.vat}万（可抵扣）` : ''}`}
          {brief.type === 'purchaseCredit' && `赊购进货 ¥${brief.amount}万${brief.vat ? `，进项税 ¥${brief.vat}万（可抵扣）` : ''}`}
          {brief.type === 'salary' && `计提工资 ¥${brief.amount}万`}
          {brief.type === 'rent' && `房租 ¥${brief.amount}万（含押金）`}
        </div>
      ) : null}
      <div style={{ fontWeight: 700, marginBottom: 8 }}>✍️ 自己写出这笔业务的分录</div>
      <EntryForm form={entryForm} setForm={setEntryForm} />
      <button className="btn mt12" onClick={onSubmitEntry}>提交分录</button>
    </div>
  )
}
