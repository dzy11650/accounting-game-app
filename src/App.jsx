import { Routes, Route } from 'react-router-dom'
import TopBar from './components/TopBar.jsx'
import BottomNav from './components/BottomNav.jsx'
import Home from './pages/Home.jsx'
import Game from './pages/Game.jsx'
import Reports from './pages/Reports.jsx'
import Me from './pages/Me.jsx'
import MetaShop from './pages/MetaShop.jsx'
import Detective from './pages/Detective.jsx'

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<><TopBar title="会计小当家" /><Home /></>} />
        <Route path="/learn" element={<><TopBar title="经营我的公司" /><Game /></>} />
        <Route path="/game" element={<><TopBar title="经营我的公司" /><Game /></>} />
        <Route path="/reports" element={<><TopBar title="财务报表" /><Reports /></>} />
        <Route path="/me" element={<><TopBar title="我的" /><Me /></>} />
        <Route path="/metashop" element={<><TopBar title="天赋商店" /><MetaShop /></>} />
        <Route path="/detective" element={<><TopBar title="财务侦探" /><Detective /></>} />
      </Routes>
      <BottomNav />
    </div>
  )
}
