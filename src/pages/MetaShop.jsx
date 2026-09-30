import { useNavigate } from 'react-router-dom'
import { useUser } from '../store/UserContext.jsx'
import TalentShop from '../components/Meta/TalentShop.jsx'

export default function MetaShop() {
  const navigate = useNavigate()
  const { state } = useUser()
  return (
    <div className="page fade-in">
      <div className="card" style={{ textAlign: 'center', padding: 14 }}>
        <div style={{ fontSize: 36 }}>🛒</div>
        <div style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}>局外天赋商店</div>
        <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6, lineHeight: 1.7 }}>
          每局营业利润越大，结算拿到的金币越多<br />
          金币可永久解锁天赋，下局开局三选一必出 1 张已解锁卡<br />
          已解锁 <b style={{ color: 'var(--primary)' }}>{(state.metaUnlockedTalents || []).length}</b> 张天赋
        </div>
      </div>
      <TalentShop />
      <button className="btn ghost mt12" onClick={() => navigate('/')}>🏠 回到首页</button>
      <button className="btn ghost mt12" onClick={() => navigate('/game')}>▶️ 开始经营</button>
    </div>
  )
}
