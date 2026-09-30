import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', emoji: '🏠', label: '首页', end: true },
  { to: '/game', emoji: '🏪', label: '经营' },
  { to: '/reports', emoji: '📊', label: '报表' },
  { to: '/metashop', emoji: '🛒', label: '商店' },
  { to: '/me', emoji: '🏆', label: '我的' },
  { to: '/detective', emoji: '🔍', label: '侦探' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
        >
          <span className="emoji">{it.emoji}</span>
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
