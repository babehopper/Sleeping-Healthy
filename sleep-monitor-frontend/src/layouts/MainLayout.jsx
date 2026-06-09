import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { LayoutDashboard, Bed, Settings, Activity, Heart } from 'lucide-react'
import dayjs from 'dayjs'

const MainLayout = () => {
  const [currentTime, setCurrentTime] = useState(dayjs().format('HH:mm'))

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs().format('HH:mm'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { key: '/dashboard', icon: <LayoutDashboard size={20} />, label: '首页' },
    { key: '/sleep-records', icon: <Bed size={20} />, label: '睡眠' },
    { key: '/respiration', icon: <Activity size={20} />, label: '呼吸' },
    { key: '/environment', icon: <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>E</span>, label: '睡眠环境' },
  ]

  const handleMenuClick = (key) => {
    navigate(key)
  }

  return (
    <div className="app-container">
      <div className="sidebar-wrapper">
        <div className="sidebar-clock">
          <span className="clock-text">{currentTime}</span>
        </div>
        <div className="sidebar-container">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-button ${location.pathname === item.key ? 'active' : ''}`}
              onClick={() => handleMenuClick(item.key)}
            >
              {item.icon}
              <span className="sidebar-label">{item.label}</span>
            </button>
          ))}
          <div className="sidebar-divider"></div>
          <button
            className={`sidebar-button ${location.pathname === '/settings' ? 'active' : ''}`}
            onClick={() => handleMenuClick('/settings')}
          >
            <Settings size={20} />
            <span className="sidebar-label">设置</span>
          </button>
        </div>
      </div>

      <div className="main-content-wrapper">
        <Outlet />
      </div>
    </div>
  )
}

export default MainLayout