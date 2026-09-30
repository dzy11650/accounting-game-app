/**
 * 调整分录任务弹窗
 * 月末结账后发现错误时提示玩家修正
 */
import React from 'react'
import EntryForm from './EntryForm.jsx'

export default function AdjustTask({ task, entryForm, setEntryForm, onSubmit }) {
  if (!task) return null

  return (
    <div className="page fade-in">
      <div className="card" style={{ borderLeft: '5px solid var(--gold)' }}>
        <div style={{ fontWeight: 800, color: 'var(--gold)' }}>🔧 调整分录任务</div>
        <div style={{ marginTop: 6 }}>业务：{task.desc}</div>
        <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6 }}>
          你记成了：{task.wrong.map((e) => `${e.side === 'debit' ? '借' : '贷'}${e.account}${e.amount}`).join(' / ')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--accent-deep)', background: '#E9F8F6', padding: '8px 10px', borderRadius: 8, marginTop: 6 }}>
          正确应为：{task.hint}
        </div>
        <EntryForm form={entryForm} setForm={setEntryForm} />
        <button className="btn mt12" onClick={() => onSubmit(task)}>提交调整分录</button>
      </div>
    </div>
  )
}
