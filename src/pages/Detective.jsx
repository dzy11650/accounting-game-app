import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../store/UserContext.jsx'
import {
  buildRound,
  judge,
  getErrorTypeName,
  getErrorTypeIcon,
  getErrorTypeColor,
} from '../lib/detective.js'

export default function Detective() {
  const navigate = useNavigate()
  const { dispatch } = useUser()
  const [round, setRound] = useState(() => buildRound(5))
  const [idx, setIdx] = useState(0)
  const [marked, setMarked] = useState([])
  const [chosenId, setChosenId] = useState(null)
  const [result, setResult] = useState(null)
  const [finished, setFinished] = useState(false)

  const total = round.length
  const cur = round[idx]
  if (!cur) return null

  const toggleMark = (displayIndex) => {
    if (finished || result !== null) return
    setMarked((prev) =>
      prev.includes(displayIndex)
        ? prev.filter((i) => i !== displayIndex)
        : [...prev, displayIndex]
    )
  }

  const submit = () => {
    if (chosenId === null || finished) return
    const r = judge(cur, marked, chosenId)
    setResult(r)
  }

  const next = () => {
    if (idx + 1 >= total) {
      setFinished(true)
    } else {
      setIdx((n) => n + 1)
      setMarked([])
      setChosenId(null)
      setResult(null)
    }
  }

  const restart = () => {
    setRound(buildRound(5))
    setIdx(0)
    setMarked([])
    setChosenId(null)
    setResult(null)
    setFinished(false)
  }

  const scene = cur.template
  const wrongColor = getErrorTypeColor(cur.errorType)
  const score = finished ? Math.max(0, Math.round(100 - idx * 5)) : null

  return (
    <div className="page fade-in">
      {/* ── 顶部栏 ── */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button className="btn ghost" onClick={() => navigate(-1)} style={{ fontSize: 13 }}>← 返回</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>🔍 财务侦探</div>
            <div style={{ color: 'var(--text-soft)', fontSize: 13 }}>找出错账并修正</div>
          </div>
          <span className="chip" style={{ background: wrongColor, color: '#fff' }}>
            {getErrorTypeIcon(cur.errorType)} {getErrorTypeName(cur.errorType)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
          第 {idx + 1}/{total} 题 · {scene.level === 1 ? '新手' : scene.level === 2 ? '进阶' : '专家'}
        </div>
        <div className="progress-track mt8">
          <div
            className="progress-fill"
            style={{ width: `${(idx / total) * 100}%`, background: 'var(--accent)' }}
          />
        </div>
      </div>

      {/* ── 案件描述 ── */}
      <div className="section-title">🔎 案件详情</div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{scene.title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{scene.desc}</div>
      </div>

      {/* ── 错误分录（可点击标记） ── */}
      <div className="section-title">📝 待核查分录</div>
      <div className="card" style={{ marginBottom: 12 }}>
        {cur.wrong.map((e) => {
          const highlight = marked.includes(e.displayIndex)
          return (
            <div
              key={e.displayIndex}
              onClick={() => result === null && toggleMark(e.displayIndex)}
              className={`entry-row ${highlight ? 'highlighted' : ''}`}
              style={{
                cursor: result === null ? 'pointer' : 'default',
                opacity: result !== null ? 0.7 : 1,
              }}
            >
              <div className="entry-side debit">
                <div className="label">借方</div>
                <div className="acc">{e.debitAccount}</div>
                <div className="amt">{e.debitAmount}</div>
              </div>
              <div className="entry-side credit">
                <div className="label">贷方</div>
                <div className="acc">{e.creditAccount}</div>
                <div className="amt">{e.creditAmount}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 修正方案选择 ── */}
      <div className="section-title">💡 请选择修正方案</div>
      <div className="card">
        {cur.options.map((opt, i) => (
          <div
            key={opt.id}
            className={`option ${chosenId === opt.id ? 'selected' : ''}`}
            onClick={() => result === null && setChosenId(opt.id)}
            style={{ cursor: result === null ? 'pointer' : 'default' }}
          >
            <div className="opt-key">{String.fromCharCode(65 + i)}</div>
            <div>{opt.desc}</div>
          </div>
        ))}
      </div>

      {/* ── 操作按钮 ── */}
      <div className="mt20" style={{ display: 'flex', gap: 10 }}>
        {!result ? (
          <button
            className="btn"
            onClick={submit}
            disabled={chosenId === null || marked.length === 0}
          >
            提交答案
          </button>
        ) : (
          <button className="btn secondary" onClick={next}>
            {idx + 1 >= total ? '查看成绩' : '下一题'}
          </button>
        )}
      </div>

      {/* ── 结果反馈 ── */}
      {result && (
        <div
          className="card mt12"
          style={{
            background: result.correct ? '#E4F8F1' : '#FFEDED',
            borderLeft: result.correct ? '5px solid var(--accent)' : '5px solid #FF6B6B',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, color: result.correct ? 'var(--accent-deep)' : '#FF6B6B' }}>
            {result.correct ? '✅ 答对了！' : '❌ 答错了'}
          </div>
          {!result.correct && result.hint && (
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-soft)' }}>
              提示：{result.hint}
            </div>
          )}
        </div>
      )}

      {/* ── 结算界面 ── */}
      {finished && (
        <div className="modal-mask" onClick={restart}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 48 }}>🏆</div>
              <div style={{ fontWeight: 800, fontSize: 22, marginTop: 8 }}>案件告破！</div>
            </div>
            <div className="card" style={{ background: '#FFF1E8', marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>本次得分</div>
              <div style={{ fontWeight: 900, fontSize: 36, color: 'var(--primary-deep)' }}>{score}</div>
            </div>
            <button className="btn" onClick={restart}>再来一局</button>
          </div>
        </div>
      )}
    </div>
  )
}
