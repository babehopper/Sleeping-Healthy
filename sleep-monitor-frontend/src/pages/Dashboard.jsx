import { useState, useEffect } from 'react'
import { Row, Col, Card, message, Button, Avatar, Modal } from 'antd'
import { Bed, User, Activity, Ruler, Scale, DoorOpen, Settings as SettingsIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { getDashboardData } from '../api/dashboard'
import { getRespirationTrend } from '../api/respiration'
import { getUserProfile } from '../api/auth'
import './Dashboard.css'

const Dashboard = () => {
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentGreeting, setCurrentGreeting] = useState('')
  const [todayAvgRespiration, setTodayAvgRespiration] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const getGreeting = () => {
    const hour = dayjs().hour()
    if (hour >= 5 && hour < 12) {
      return 'Good Morning'
    } else if (hour >= 12 && hour < 18) {
      return 'Good Afternoon'
    } else {
      return 'Good Evening'
    }
  }

  useEffect(() => {
    setCurrentGreeting(getGreeting())
    const timer = setInterval(() => {
      setCurrentGreeting(getGreeting())
    }, 60000) 
    return () => clearInterval(timer)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    navigate('/login')
  }

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      navigate('/login')
      return
    }

    const fetchData = async () => {
      try {
        const [dashboardResult, trendResult, profileResult] = await Promise.all([
          getDashboardData(userId),
          getRespirationTrend(userId, 'day', dayjs().format('YYYY-MM-DD')),
          getUserProfile(userId)
        ])
        
        if (dashboardResult.success) {
          setDashboardData(dashboardResult.data)
        } else {
          message.error(dashboardResult.message || '获取仪表盘数据失败')
        }

        if (trendResult.success && Array.isArray(trendResult.data)) {
          const todayValues = trendResult.data
            .map(item => {
              const v = item.value
              if (v === null || v === undefined || v === '' || isNaN(v)) return null
              return parseFloat(v)
            })
            .filter(v => v !== null)
          
          if (todayValues.length > 0) {
            const latestValue = todayValues[todayValues.length - 1]
            const roundedValue = Math.round(latestValue * 10) / 10
            setTodayAvgRespiration(roundedValue)
          } else {
            setTodayAvgRespiration(null)
          }
        }

        if (profileResult.success) {
          setUserProfile(profileResult.data)
        }
      } catch (error) {
        // silent fail on poll
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const timer = setInterval(fetchData, 5000)
    return () => clearInterval(timer)
  }, [navigate])

  const formatDuration = (hours) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}小时${m}分钟`
  }

  const getSleepTimelineOption = (data) => {
    const deep = data?.sleepDistribution?.deep || 2.5
    const light = data?.sleepDistribution?.light || 4.0
    const rem = data?.sleepDistribution?.rem || 1.0
    const duration = data?.sleepDuration || 7.5
    const awake = Math.max(0, duration - deep - light - rem)

    const bedtime = 23.5
    const totalH = deep + light + rem + awake
    let t = bedtime
    const deepSegs = [], lightSegs = [], remSegs = [], awakePts = []

    const cycleLen = 1.5
    const cycles = Math.ceil(totalH / cycleLen)
    const remPerCycle = rem / cycles
    const deepPerCycle = deep / cycles
    const lightPerCycle = (totalH - deep - rem - awake) / cycles
    const awakeCount = awake > 0.3 ? Math.min(3, Math.round(awake / 0.15)) : 0
    const awakeLen = awakeCount > 0 ? awake / awakeCount : 0

    for (let c = 0; c < cycles; c++) {
      const l1 = lightPerCycle * 0.55
      if (l1 > 0.03) { lightSegs.push([t, t + l1]); t += l1 }
      const d = c === 0 ? deepPerCycle * 1.3 : deepPerCycle
      if (d > 0.03) { deepSegs.push([t, t + d]); t += d }
      const l2 = lightPerCycle * 0.45
      if (l2 > 0.03) { lightSegs.push([t, t + l2]); t += l2 }
      const r = c === cycles - 1 ? remPerCycle * 1.5 : remPerCycle
      if (r > 0.03) { remSegs.push([t, t + r]); t += r }
      if (awakeCount > 0 && c >= 1 && c < 1 + awakeCount) {
        const al = Math.min(awakeLen, 0.2)
        awakePts.push({ s: t, e: t + al })
        t += al
      }
    }
    const endTime = bedtime + totalH

    const fmt = (h) => {
      const hr = Math.floor(h) % 24
      const mn = Math.round((h - Math.floor(h)) * 60)
      return `${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}`
    }

    const mkBar = (yIdx, segs, color, stageName) => ({
      type: 'custom',
      renderItem: (params, api) => {
        const y = api.coord([0, yIdx])[1]
        const barH = api.size([0, 1])[1] * 0.3
        const x1 = api.coord([api.value(1), yIdx])[0]
        const x2 = api.coord([api.value(2), yIdx])[0]
        return {
          type: 'rect',
          shape: { x: x1 + 1, y: y - barH/2, width: Math.max(x2 - x1 - 2, 2), height: barH, r: [2, 2, 2, 2] },
          style: { fill: color },
        }
      },
      encode: { x: [1, 2], y: 0 },
      data: segs.map(s => ({ value: [yIdx, s[0], s[1]], stage: stageName, start: s[0], end: s[1] })),
    })

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff', borderColor: '#e0e0e0', textStyle: { color: '#333' },
        padding: [10, 14], borderRadius: 8,
        formatter: (p) => {
          const s = p.data.start, e = p.data.end
          if (s == null) return ''
          return `${fmt(s)} - ${fmt(e)}<br/>${((e-s)).toFixed(1)}小时`
        },
      },
      grid: { left: 20, right: 20, top: 6, bottom: 6 },
      xAxis: {
        type: 'value', min: bedtime, max: endTime,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: '#999', fontSize: 10, formatter: (v) => fmt(v) },
        splitLine: { show: false }, interval: 1,
      },
      yAxis: {
        type: 'category', data: ['', '', '', ''],
        axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
      },
      series: [
        mkBar(0, deepSegs, '#1a6340', '深睡眠'),
        mkBar(1, lightSegs, '#45a86f', '浅睡眠'),
        mkBar(2, remSegs, '#7cc99a', 'REM特征'),
        { type: 'scatter', symbol: 'roundRect', symbolSize: [6, 18],
          itemStyle: { color: '#e07060', borderWidth: 0 },
          encode: { x: [0], y: [1] },
          data: awakePts.map(p => ({ value: [(p.s + p.e) / 2, 3], start: p.s, end: p.e })),
        },
      ],
    }
  }

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) return

    const checkProfile = async () => {
      try {
        const profileUpdated = localStorage.getItem('profileUpdated')
        if (profileUpdated) return

        const profile = await getUserProfile(userId)
        if (profile.success && profile.data) {
          const hasAge = profile.data.age !== null && profile.data.age !== undefined
          const hasHeight = profile.data.height !== null && profile.data.height !== undefined
          const hasWeight = profile.data.weight !== null && profile.data.weight !== undefined
          const hasPhone = profile.data.phone !== null && profile.data.phone !== undefined

          if (!hasAge || !hasHeight || !hasWeight || !hasPhone) {
            setShowProfileModal(true)
          }
        }
      } catch (error) {
        console.error('检查用户信息失败:', error)
      }
    }

    checkProfile()
  }, [])

  useEffect(() => {
    const handleProfileUpdate = () => {
      const userId = localStorage.getItem('userId')
      if (userId) {
        getUserProfile(userId).then(result => {
          if (result.success) {
            setUserProfile(result.data)
          }
        })
      }
    }

    window.addEventListener('profileUpdated', handleProfileUpdate)
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate)
  }, [])

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  const data = dashboardData || {}
  const profile = userProfile || {}
  const userData = {
    name: profile.username || '用户',
    email: profile.email || 'user@example.com',
    avatar: profile.avatar,
    height: profile.height,
    weight: profile.weight,
    age: profile.age,
  }

  const hasCompleteProfile = userData.height !== null && userData.height !== undefined &&
    userData.weight !== null && userData.weight !== undefined &&
    userData.age !== null && userData.age !== undefined

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <h1 className="greeting-text">{currentGreeting}</h1>
          <p className="greeting-sub">Welcome to Sleep Monitoring System</p>
        </div>
        <div className="dashboard-header-right">
          <span className="dashboard-date">{dayjs().format('DD MMM YYYY, dddd')}</span>
          <Button
            type="text"
            icon={<DoorOpen size={18} />}
            onClick={() => {
              localStorage.removeItem('userId')
              localStorage.removeItem('username')
              navigate('/login')
            }}
            className="dashboard-logout-btn"
          >
            Logout
          </Button>
        </div>
      </div>
      <Row gutter={12} style={{ marginBottom: 24, alignItems: 'stretch' }}>
        <Col span={6} style={{ display: 'flex' }}>
          <Card className="dashboard-user-card" style={{ height: '100%' }} onClick={() => navigate('/settings')}>
            <div className="user-card-center">
              <Avatar size={80} src={userData.avatar ? `http://localhost:5000${userData.avatar}` : undefined} icon={<User size={32} />} />
              <h3 className="user-card-name">{userData.name}</h3>
              <span className="user-card-email">{userData.email}</span>
              {hasCompleteProfile ? (
                <div className="user-body-grid">
                  <div className="user-body-item">
                    <span className="ub-value">{userData.height}<small>cm</small></span>
                    <span className="ub-label">身高</span>
                  </div>
                  <div className="user-body-item">
                    <span className="ub-value">{userData.weight}<small>kg</small></span>
                    <span className="ub-label">体重</span>
                  </div>
                  <div className="user-body-item">
                    <span className="ub-value">{userData.age}<small>岁</small></span>
                    <span className="ub-label">年龄</span>
                  </div>
                </div>
              ) : (
                <div className="user-body-grid">
                  <div className="user-body-item incomplete">
                    <span className="ub-value">-</span>
                    <span className="ub-label">请完善</span>
                  </div>
                  <div className="user-body-item incomplete">
                    <span className="ub-value">-</span>
                    <span className="ub-label">个人信息</span>
                  </div>
                  <div className="user-body-item incomplete">
                    <span className="ub-value">-</span>
                    <span className="ub-label">→设置</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col span={18}>
          <Card className="dashboard-sleep-card" style={{ height: '100%' }}>
            <div className="ds-header">
              <div className="ds-header-left">
                <div className="ds-icon-box">
                  <Bed size={28} />
                </div>
                <div className="ds-title-box">
                  <h3>睡眠记录</h3>
                  <span>最近一次睡眠</span>
                </div>
              </div>
              <div className="ds-duration">
                {formatDuration(data.sleepDuration || 7.5)}
              </div>
            </div>
            <div className="ds-chart-box">
              <ReactECharts option={getSleepTimelineOption(data)} style={{ height: 110 }} />
            </div>
            <div className="ds-chart-legend">
              <span><span className="dsc-dot" style={{background:'#1a6340'}}></span>深睡眠</span>
              <span><span className="dsc-dot" style={{background:'#45a86f'}}></span>浅睡眠</span>
              <span><span className="dsc-dot" style={{background:'#7cc99a'}}></span>REM</span>
              <span><span className="dsc-dot" style={{background:'#e07060'}}></span>清醒</span>
            </div>
            <div className="ds-footer" onClick={() => navigate('/sleep-records')}>
              <span>查看详情</span>
              <span className="ds-arrow">&rsaquo;</span>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <div className="breath-gauge-container" onClick={() => navigate('/respiration')}>
            <ReactECharts option={getBreathGaugeOption(todayAvgRespiration)} style={{ height: '100%', width: '100%' }} />
          </div>
        </Col>
        <Col span={8}>
          <Card className="dash-mini-card env-card clickable" onClick={() => navigate('/environment')}>
            <div className="dmc-icon env-bg">
              <img src="/Environment.png" alt="env" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="完善个人信息"
        visible={showProfileModal}
        footer={null}
        onCancel={() => setShowProfileModal(false)}
      >
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <SettingsIcon size={48} style={{ marginBottom: '16px', color: '#1a6340' }} />
          <p style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
            欢迎使用睡眠监测系统！为了更好地为您提供服务，请先完善您的个人信息。
          </p>
          <Button type="primary" onClick={() => { setShowProfileModal(false); navigate('/settings'); }} style={{ width: '100%' }}>
            去完善信息
          </Button>
          <p style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
            完善后首页的身份卡片将显示您的信息
          </p>
        </div>
      </Modal>
    </div>
  )
}

const getBreathGaugeOption = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return {
      series: [{
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 6,
        max: 24,
        radius: '85%',
        axisLine: { show: false },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          show: true,
          formatter: '{noData|暂无数据}',
          offsetCenter: [0, '50%'],
          rich: {
            noData: { fontSize: 14, color: '#999' }
          }
        },
        data: [{ value: 12 }]
      }]
    }
  }
  
  const level = value >= 18 ? 'Excellent' : value >= 14 ? 'Good' : value >= 12 ? 'Normal' : 'Low'
  const color = value >= 18 ? '#2d8a56' : value >= 14 ? '#e8a840' : value >= 12 ? '#e07060' : '#c05656'
  
  return {
    series: [{
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      min: 6,
      max: 24,
      splitNumber: 6,
      axisLine: {
        lineStyle: {
          width: 12,
          color: [
            [0.25, '#e07060'],
            [0.5, '#e8a840'],
            [0.75, '#45a86f'],
            [1, '#2d8a56']
          ]
        }
      },
      pointer: {
        itemStyle: { color: color },
        length: '60%',
        width: 6
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: '#999',
        fontSize: 11,
        distance: 20
      },
      detail: {
        valueAnimation: true,
        formatter: '{value}',
        color: '#333',
        fontSize: 36,
        fontWeight: 'bold',
        offsetCenter: [0, '20%']
      },
      title: {
        offsetCenter: [0, '45%'],
        fontSize: 14,
        color: '#666',
        formatter: '今日平均呼吸率'
      },
      data: [{
        value: value,
        detail: { formatter: '{value} 次/分' },
        itemStyle: { color: color }
      }]
    }, {
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      min: 6,
      max: 24,
      radius: '85%',
      axisLine: { show: false },
      pointer: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        valueAnimation: true,
        formatter: `{level|${level}}\n{link|查看详情}\n{subtitle|最近一次呼吸率检测}`,
        fontSize: 14,
        color: color,
        offsetCenter: [0, '65%'],
        rich: {
          level: { fontSize: 16, fontWeight: 'bold', color: color },
          link: { fontSize: 12, color: '#2d8a56', textDecoration: 'underline' },
          subtitle: { fontSize: 10, color: '#999', padding: [4, 0, 0, 0] }
        }
      },
      data: [{ value: value }]
    }]
  }
}

export default Dashboard