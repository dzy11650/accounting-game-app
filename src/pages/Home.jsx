import { useNavigate } from 'react-router-dom'
import { useUser } from '../store/UserContext.jsx'
import { COMPANIES } from '../data/companies.js'
import { TIERS } from '../data/tiers.js'

export default function Home() {
  const navigate = useNavigate()
  const { state } = useUser()
  const badgePct = Math.round((state.badges.length / 7) * 100)

  return (
    <div className="page fade-in">
      <div className="hero">
        <h1>嗨，{state.name}！👋</h1>
        <p>开一家公司，在经营中自然学会会计～</p>
        <div style={{ marginTop: 14 }}>
          <div className="progress-track" style={{ background: 'rgba(255,255,255,.35)' }}>
            <div className="progress-fill" style={{ width: badgePct + '%', background: '#fff' }} />
          </div>
          <div style={{ fontSize: 12, marginTop: 6, opacity: .95 }}>
            已获徽章 {state.badges.length}/7 · Lv.{state.level} · 🪙{state.coins}
          </div>
        </div>
      </div>

      <div className="section-title">🎮 开始经营</div>
      <div className="card" onClick={() => navigate('/game')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg,#FFF1E8,#E9F8F6)' }}>
        <div className="flex between center">
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>🏢 经营我的公司</div>
            <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 4 }}>
              选公司类型与难度，从创立到报表全过程实战
            </div>
          </div>
          <span style={{ fontSize: 22 }}>›</span>
        </div>
      </div>

      <div className="card" onClick={() => navigate('/detective')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg,#FFF8E8,#F0F9FF)' }}>
        <div className="flex between center">
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>🔍 财务侦探</div>
            <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 4 }}>
              找出被篡改的会计分录，强化借贷平衡意识
            </div>
          </div>
          <span style={{ fontSize: 22 }}>›</span>
        </div>
      </div>

      <div className="card" onClick={() => navigate('/metashop')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg,#FFF3D6,#E9F8F6)' }}>
        <div className="flex between center">
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>🛒 天赋商店（局外）</div>
            <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 4 }}>用金币永久解锁天赋 · 局外成长</div>
          </div>
          <span style={{ fontSize: 22 }}>›</span>
        </div>
      </div>

            <div className="card" onClick={() => navigate('/reports')} style={{ cursor: 'pointer' }}>
        <div className="flex between center">
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>📊 财务报表中心</div>
            <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 4 }}>
              查看资产负债表 / 利润表 / 现金流量表
            </div>
          </div>
          <span style={{ fontSize: 22 }}>›</span>
        </div>
      </div>

      <div className="section-title mt20">🏢 选哪种公司练手？</div>
      {COMPANIES.map((c) => (
        <div key={c.id} className="card" onClick={() => navigate('/game')} style={{ cursor: 'pointer' }}>
          <div className="flex between center">
            <div>
              <div style={{ fontWeight: 800 }}>{c.emoji} {c.name}</div>
              <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 3 }}>{c.blurb}</div>
            </div>
            <span className="chip">{'★'.repeat(c.difficulty)}</span>
          </div>
        </div>
      ))}

      <div className="section-title mt20">🎯 会计职称路径</div>
      {TIERS.map((t) => (
        <div key={t.id} className="card" onClick={() => navigate('/game')} style={{ cursor: 'pointer' }}>
          <div className="flex between center">
            <div>
              <div style={{ fontWeight: 800 }}>{t.name}</div>
              <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 3 }}>{t.desc}</div>
            </div>
            <span style={{ fontWeight: 800, color: t.color }}>›</span>
          </div>
        </div>
      ))}
    </div>
  )
}
