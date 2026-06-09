import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Login from './pages/Login'
import Register from './pages/Register'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import SleepRecords from './pages/SleepRecords'
import Settings from './pages/Settings'

import Respiration from './pages/Respiration'
import Environment from './pages/Environment'
import './index.css'

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sleep-records" element={<SleepRecords />} />
            <Route path="settings" element={<Settings />} />

            <Route path="respiration" element={<Respiration />} />
            <Route path="environment" element={<Environment />} />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  )
}

export default App
