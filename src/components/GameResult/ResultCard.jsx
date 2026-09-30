/**
 * 经营结果卡片
 * 通关/失败后展示最终成绩、雷达图、决策回放
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtW } from '../../lib/engine.js'
import { buildShareText, copyText, shareText } from '../../lib/share.js'

function RadarChart({ scores }) {
  if (!scores) return null
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

export default function ResultCard({ result, sim, onRestart, shareContext, onHome }) {
  const navigate = useNavigate()
  const [shareMsg, setShareMsg] = useState('')
  const [duPontOpen, setDuPontOpen] = useState(false)

  if (!result) return null

  const coName = shareContext?.coName || sim?.co?.name || ''
  const projName = sim?.projectName || ''

  const doShare = async () => {
    const text = buildShareText(result, coName, projName)
    const native = await shareText(text, '会计小当家')
    if (native.ok) { setShareMsg('✓ 已调起系统分享'); return }
    if (native.cancelled) return
    const c = await copyText(text)
    setShareMsg(c.ok ? '✓ 成绩已复制，去粘贴给朋友吧！' : '⚠️ 复制失败，请手动截图')
    setTimeout(() => setShareMsg(''), 3000)
  }

  return (
    <div className="page fade-in">
      <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
        <div style={{ fontSize: 50 }}>{result.ok ? '🏆' : '💥'}</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 8 }}>
          {result.ok ? '经营成功！' : '经营失败'}
        </div>
        <div style={{ color: 'var(--text-soft)', marginTop: 6 }}>{result.reason}</div>

        {result.ok && (
          <div style={{ fontSize: 32, margin: '12px 0' }}>
            {'⭐'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}
          </div>
        )}

        <RadarChart scores={result.scores} />

        <div className="card" style={{ background: '#FFFDF8', textAlign: 'left', marginTop: 10 }}>
          <div>净利润：¥{fmtW(result.profit)}万</div>
          <div>现金余额：¥{fmtW(result.cash)}万</div>
          <div>累计接单：{result.ordersFulfilled || 0} 笔</div>
          <div>容错剩余：{sim?.lives ?? 0}</div>
        </div>

        {result?.insights?.length > 0 && (
          <div className="card" style={{ background: '#F4FBF9', textAlign: 'left', marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🔎 你的决策带来了什么</div>
            {result.insights.map((t, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.7 }}>{t}</div>
            ))}
          </div>
        )}

        {result?.milestones?.length > 0 && (
          <div className="card" style={{ background: '#FFFAF0', textAlign: 'left', marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🏁 达成的经营里程碑</div>
            {result.milestones.map((m, i) => (
              <div key={i} style={{ fontSize: 13, padding: '3px 0' }}>{m.emoji} {m.title} — {m.desc}</div>
            ))}
          </div>
        )}

        <button className="btn mt12" onClick={onRestart}>🔄 再开一家</button>
        {onHome && <button className="btn ghost mt12" onClick={onHome}>🏠 返回主界面</button>}
        <button className="btn ghost mt12" onClick={() => navigate('/reports')}>📊 查看报表</button>
        <button className="btn ghost mt12" style={{ width: '100%' }} onClick={doShare}>
          📣 分享本局成绩{shareMsg ? ` · ${shareMsg}` : ''}
        </button>
      </div>
    </div>
  )
}
