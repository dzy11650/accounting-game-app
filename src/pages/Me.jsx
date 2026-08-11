import { useState } from 'react'
import { useUser } from '../store/UserContext.jsx'
import { BADGES } from '../data/badges.js'
import { TIERS } from '../data/tiers.js'
import { useNavigate } from 'react-router-dom'

// 模拟排行榜数据
const RANK_BASE = [
  { name: '会计学霸喵', score: 1820, avatar: '🦁' },
  { name: '算盘小能手', score: 1560, avatar: '🐯' },
  { name: '账房先生', score: 1340, avatar: '🐻' },
  { name: '小数点猎人', score: 980, avatar: '🐰' },
  { name: '借贷平衡侠', score: 760, avatar: '🦊' },
]

export default function Me() {
  const { state, dispatch } = useUser()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.name)

  const myScore = state.coins + state.exp * 2 + state.gameBestProfit + state.companiesRun.length * 30
  const rankList = [
    ...RANK_BASE,
    { name: state.name + (state.name === '小会计' ? '' : ''), score: myScore, avatar: state.avatar, me: true },
  ].sort((a, b) => b.score - a.score)
  const myRank = rankList.findIndex((r) => r.me) + 1

  const earned = BADGES.filter((b) => state.badges.includes(b.id))
  const locked = BADGES.filter((b) => !state.badges.includes(b.id))

  const saveName = () => {
    dispatch({ type: 'SET_NAME', name: name || '小会计' })
    setEditing(false)
  }

  return (
    <div className="page fade-in">
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>{state.avatar}</div>
        {editing ? (
          <div className="mt12">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: '2px solid var(--line)', textAlign: 'center', fontWeight: 700 }}
            />
            <button className="btn mt12" onClick={saveName}>保存</button>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{state.name}</div>
            <div style={{ color: 'var(--text-soft)', fontSize: 13 }}>Lv.{state.level} · {TIERS.find((t) => t.id === state.tier)?.name}</div>
            <button className="btn ghost mt12" style={{ width: 'auto', padding: '6px 14px', fontSize: 13 }} onClick={() => setEditing(true)}>✏️ 改名</button>
          </div>
        )}
        <div className="flex gap8 mt20">
          <div className="pill coins" style={{ flex: 1, justifyContent: 'center' }}>🪙 {state.coins}</div>
          <div className="pill level" style={{ flex: 1, justifyContent: 'center' }}>⭐ 经验 {state.exp}</div>
        </div>
      </div>

      <div className="section-title">🎯 我的职称</div>
      <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
        {TIERS.map((t) => (
          <button
            key={t.id}
            className={`btn ${state.tier === t.id ? '' : 'ghost'}`}
            style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}
            onClick={() => dispatch({ type: 'SET_TIER', tier: t.id })}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="section-title mt20">🏅 徽章 ({earned.length}/{BADGES.length})</div>
      <div className="badge-grid">
        {earned.map((b) => (
          <div key={b.id} className="badge-item" title={b.desc}>
            <div className="b-emoji">{b.emoji}</div>
            <div className="b-name">{b.name}</div>
          </div>
        ))}
        {locked.map((b) => (
          <div key={b.id} className="badge-item locked" title={b.desc}>
            <div className="b-emoji">🔒</div>
            <div className="b-name">{b.name}</div>
          </div>
        ))}
      </div>

      <div className="section-title mt20">📊 排行榜</div>
      <div className="card" style={{ padding: 8 }}>
        {rankList.map((r, i) => (
          <div key={i} className={'rank-row' + (r.me ? ' me' : '')}>
            <span className="rk">{i + 1}</span>
            <span style={{ fontSize: 22 }}>{r.avatar}</span>
            <span className="nm">{r.name}{r.me ? '（我）' : ''}</span>
            <span className="sc">{r.score}</span>
          </div>
        ))}
        <div style={{ textAlign: 'center', color: 'var(--text-soft)', fontSize: 12, marginTop: 6 }}>
          我的排名：第 {myRank} 名 · 加油冲榜！🚀
        </div>
      </div>

      <button className="btn ghost mt12" onClick={() => navigate('/')}>🏠 回到首页</button>
      <button className="btn ghost mt12" onClick={() => { if (confirm('确定重置所有进度？')) dispatch({ type: 'RESET' }) }} style={{ color: '#FF6B6B' }}>
        ♻️ 重置进度
      </button>
    </div>
  )
}
