import { useUser } from '../store/UserContext.jsx'
import { TIERS } from '../data/tiers.js'

export default function TopBar({ title }) {
  const { state } = useUser()
  const tier = TIERS.find((t) => t.id === state.tier)
  return (
    <div className="topbar">
      <div className="title">{title}</div>
      <div className="spacer" />
      <div className="pill level" title="当前职称">🎯 {tier?.name}</div>
      <div className="pill coins">🪙 {state.coins}</div>
    </div>
  )
}
