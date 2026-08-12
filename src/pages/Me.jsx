import { useState } from 'react'
import { useUser } from '../store/UserContext.jsx'
import { BADGES } from '../data/badges.js'
import { TIERS } from '../data/tiers.js'
import { useNavigate } from 'react-router-dom'

// H: 记录清单按"综合分"排序；综合分 = 净利润×10 + 星级×50 + 月份×3
function runScore(r) {
  return Math.round((r.profit || 0) * 10 + (r.stars || 0) * 50 + (r.months || 0) * 3)
}
// 几个模范 NPC 作为参照线（非真实数据，仅用于激发对比）
const RANK_BASE = [
  { name: '会计学霸喵', score: 1820, avatar: '🦁' },
  { name: '算盘小能手', score: 1560, avatar: '🐯' },
  { name: '账房先生', score: 1340, avatar: '🐻' },
  { name: '小数点猎人', score: 980, avatar: '🐰' },
  { name: '借贷平衡侠', score: 760, avatar: '🦊' },
]
// 公司类型中文名（用于 G 多公司对比）
const CO_NAMES = {
  restaurant: '🍜 餐饮店', shop: '🛍️ 零售店', supermarket: '🏪 超市',
  factory: '🏭 工厂', tech: '💡 科技工作室', farm: '🌾 农场',
}

export default function Me() {
  const { state, dispatch } = useUser()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.name)

  // H: 真实本地排行榜 = 我的历史每局成绩 + 模范 NPC 参照
  const myRuns = (state.runHistory || []).map((r) => ({
    name: `${state.name}·${CO_NAMES[r.coId] || r.coName || '公司'}`,
    score: runScore(r), avatar: state.avatar, me: true, run: r,
  }))
  const rankList = [...RANK_BASE, ...myRuns].sort((a, b) => b.score - a.score)
  const myBest = myRuns.length ? myRuns.reduce((a, b) => (b.score > a.score ? b : a)) : null
  const myRank = myBest ? rankList.findIndex((r) => r.me && r.score === myBest.score) + 1 : null

  // G: 多公司对比 —— 每类公司已体验的最佳一局
  const coBest = {}
  ;(state.runHistory || []).forEach((r) => {
    if (!coBest[r.coId] || runScore(r) > runScore(coBest[r.coId])) coBest[r.coId] = r
  })
  const coCompare = Object.values(coBest).sort((a, b) => runScore(b) - runScore(a))

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

      <div className="section-title mt20">📊 经营排行榜（本地）</div>
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
          {myRank ? `我的排名：第 ${myRank} 名 · 加油冲榜！🚀` : '多玩几局就能登上排行榜啦～'}
        </div>
      </div>

      {/* G: 多公司横向对比 —— 各类公司已体验的最佳一局 */}
      <div className="section-title mt20">🏢 多公司对比</div>
      {coCompare.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-soft)', fontSize: 13 }}>
          还没有经营记录，去开一家公司吧！
        </div>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr 0.8fr', fontSize: 11, color: 'var(--text-soft)', padding: '4px 6px' }}>
            <span>公司类型</span><span>净利润(万)</span><span>星级</span><span>月份</span>
          </div>
          {coCompare.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr 0.8fr', alignItems: 'center', padding: '7px 6px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13 }}>
              <span>{CO_NAMES[r.coId] || r.coName}</span>
              <span style={{ fontWeight: 700, color: (r.profit || 0) >= 0 ? 'var(--primary-deep)' : '#E5484D' }}>{r.profit >= 0 ? '+' : ''}{r.profit}</span>
              <span>{'⭐'.repeat(r.stars || 0)}</span>
              <span>{r.months}月</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 6, lineHeight: 1.6 }}>
            提示：用不同公司类型、不同纳税人身份或出资方式多开几局，对比哪种组合最赚钱——这就是"平行经营"的乐趣。
          </div>
        </div>
      )}

      <button className="btn ghost mt12" onClick={() => navigate('/')}>🏠 回到首页</button>
      <button className="btn ghost mt12" onClick={() => { if (confirm('确定重置所有进度？')) dispatch({ type: 'RESET' }) }} style={{ color: '#FF6B6B' }}>
        ♻️ 重置进度
      </button>
    </div>
  )
}
