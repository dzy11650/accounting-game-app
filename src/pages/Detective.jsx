import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  buildRound,
  judge,
  getErrorTypeName,
  getErrorTypeIcon,
  getErrorTypeColor,
} from '../lib/detective.js'

export default function Detective() {
  const navigate = useNavigate()
  const [round, setRound] = useState(() => buildRound(5))
  const [idx, setIdx] = useState(0)
  const [marked, setMarked] = useState([])
  const [chosenId, setChosenId] = useState(null)
  const [result, setResult] = useState(null)   // 当前题提交后的判定结果
  const [finished, setFinished] = useState(false)

  const total = round.length
  const cur = round[idx]
  if (!cur) return null

  // 点击标记 / 取消标记
  const toggleMark = (displayIndex) => {
    if (finished || result !== null) return
    setMarked((prev) =>
      prev.includes(displayIndex)
        ? prev.filter((i) => i !== displayIndex)
        : [...prev, displayIndex]
    )
  }

  // 提交当前题
  const submit = () => {
    if (chosenId === null || finished) return
    const r = judge(cur, marked, chosenId)
    setResult(r)
  }

  // 下一题 / 重开
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
              onClick={() => toggleMark(e.displayIndex)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                marginBottom: 8,
                borderRadius: 8,
                cursor: result === null ? 'pointer' : 'default',
                border: highlight ? '2px solid #e74c3c' : '1px solid var(--line)',
                background: highlight ? '#FFF5F5' : '#fff',
                transition: 'all .2s',
                opacity: result !== null ? 0.7 : 1,
              }}
            >
              <span className={`badge ${e.side}`}>{e.side === 'debit' ? '借' : '贷'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{e.account}</div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{e.amount} 万元</div>
              </div>
              {highlight && <span style={{ color: '#e74c3c', fontWeight: 700, fontSize: 12 }}>✓ 已标记</span>}
            </div>
          )
        })}
      </div>

      {/* ── 提示 ── */}
      <div className="card" style={{ marginBottom: 12, background: '#FFFBEB' }}>
        <div style={{ fontSize: 13 }}>💡 {cur.hint}</div>
      </div>

      {/* ── 修正方案 ── */}
      <div className="section-title">✅ 选择修正方案</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {cur.options.map((opt) => {
          const selected = chosenId === opt.id
          return (
            <div
              key={opt.id}
              onClick={() => result === null && setChosenId(opt.id)}
              style={{
                border: selected ? '2px solid var(--accent)' : '1px solid var(--line)',
                borderRadius: 8,
                padding: 12,
                background: selected ? '#F0F9FF' : '#fff',
                cursor: result === null ? 'pointer' : 'default',
                transition: 'all .2s',
                opacity: result !== null ? 0.7 : 1,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{opt.label}</div>
              {opt.entries.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, marginBottom: 4 }}>
                  <span className={`badge ${e.side}`}>{e.side === 'debit' ? '借' : '贷'}</span>
                  <span style={{ flex: 1 }}>{e.account} · {e.amount} 万元</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* ── 提交按钮 ── */}
      {result === null && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
          <button
            className="btn"
            style={{ background: 'var(--accent-deep)', color: '#fff', minWidth: 120 }}
            onClick={submit}
            disabled={chosenId === null}
          >
            提交答案
          </button>
          <button className="btn ghost" onClick={restart} style={{ minWidth: 120, border: '1px solid var(--line)' }}>
            重新开始
          </button>
        </div>
      )}

      {/* ── 反馈 + 下一题 ── */}
      {result !== null && (
        <div className="card mt12" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>
            {result.correct ? '✅' : '❌'}
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
            {result.correct ? '完全正确！' : '还有问题'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 12 }}>
            {result.explanation}
          </div>
          <button className="btn" style={{ background: 'var(--accent)', minWidth: 160 }} onClick={next}>
            {idx + 1 >= total ? '查看结果' : '下一题 →'}
          </button>
        </div>
      )}

      {/* ── 结算 ── */}
      {finished && (
        <div className="card mt16" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>本局完成！</div>
          <div style={{ fontSize: 16, color: 'var(--text-soft)', marginBottom: 16 }}>
            得分：{score} 分
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn" style={{ background: 'var(--accent)' }} onClick={restart}>再来一局</button>
            <button className="btn ghost" onClick={() => navigate('/')}>返回首页</button>
          </div>
        </div>
      )}
    </div>
  )
}
