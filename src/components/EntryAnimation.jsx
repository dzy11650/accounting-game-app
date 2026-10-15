import { useState } from 'react'
import TAccount from './TAccount'

// 以动画形式演示会计分录的生成过程
// entries: [{ side:'debit'|'credit', account, amount }]
export default function EntryAnimation({ entries }) {
  const [show, setShow] = useState(true)
  const [view, setView] = useState('list') // 'list' | 't-account'
  const total = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  return (
    <div className="card">
      <div className="flex between center" style={{ marginBottom: 12 }}>
        <strong>📒 会计分录演示</strong>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`btn ${view === 'list' ? 'ghost' : ''}`}
            style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
            onClick={() => setView('list')}
          >
            列表
          </button>
          <button
            className={`btn ${view === 't-account' ? 'ghost' : ''}`}
            style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
            onClick={() => setView('t-account')}
          >
            T型账
          </button>
          <button className="btn ghost" style={{ width: 'auto', padding: '6px 14px', fontSize: 13 }} onClick={() => setShow(true)}>
            ↻ 重播
          </button>
        </div>
      </div>

      {show ? (
        view === 't-account' ? (
          <TAccount entries={entries} />
        ) : (
          <>
            {entries.map((e, i) => (
              <div
                key={i}
                className={`entry-row ${e.side === 'debit' ? 'delay-1' : 'delay-2'}`}
              >
                <div className={`entry-side ${e.side}`}>
                  <div className="flex between center">
                    <span className="label">{e.side === 'debit' ? '借 DEBIT' : '贷 CREDIT'}</span>
                  </div>
                  <div className="flex between center" style={{ marginTop: 4 }}>
                    <span className="acc">{e.account}</span>
                    <span className="amt">
                      {Number(e.amount) ? '¥' + e.amount.toLocaleString() + '万' : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="entry-amount-line mt12">
              {total ? `借贷合计：¥${total.toLocaleString()}万` : '有借必有贷 · 借贷必相等'}
            </div>
          </>
        )
      ) : (
        <div style={{ color: 'var(--text-soft)', fontSize: 13 }}>
          点击「播放动画」，看一笔业务如何变成规范的借贷分录 ✨
        </div>
      )}
    </div>
  )
}
