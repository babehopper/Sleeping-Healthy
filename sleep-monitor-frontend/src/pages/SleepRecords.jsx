import { useState, useEffect } from 'react'
import { Card, Tag, Button, DatePicker, message, Spin } from 'antd'
import { 
  Bed, Sun, Moon, Heart, Wind, Clock, BarChart3,
  ChevronLeft, ChevronRight, Lightbulb, RefreshCw
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { getSleepRecords } from '../api/sleepRecords'
import { getDashboardData } from '../api/dashboard'
import { getSleepSuggestion } from '../api/sleepRecords'
import './SleepRecords.css'

const { MonthPicker } = DatePicker

const SleepRecords = () => {
  const [viewMode, setViewMode] = useState('day') // day, week, month
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [dailyRecords, setDailyRecords] = useState([])
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)

  const userId = localStorage.getItem('userId')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        if (userId) {
          const [recordsResult, dashboardResult] = await Promise.all([
            getSleepRecords(userId),
            getDashboardData(userId)
          ])
          
          if (recordsResult.success) {
            setDailyRecords(recordsResult.records)
          }
          if (dashboardResult.success) {
            setDashboardData(dashboardResult.data)
          }
        }
      } catch (error) {
        message.error('获取数据失败')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId])

  const handlePrev = () => {
    if (viewMode === 'day') {
      setSelectedDate(prev => prev.subtract(1, 'day'))
    } else if (viewMode === 'week') {
      setSelectedDate(prev => prev.subtract(1, 'week'))
    } else {
      setSelectedDate(prev => prev.subtract(1, 'month'))
    }
  }

  const handleNext = () => {
    if (viewMode === 'day') {
      setSelectedDate(prev => prev.add(1, 'day'))
    } else if (viewMode === 'week') {
      setSelectedDate(prev => prev.add(1, 'week'))
    } else {
      setSelectedDate(prev => prev.add(1, 'month'))
    }
  }

  const getDateDisplay = () => {
    if (viewMode === 'day') {
      return selectedDate.format('YYYY年MM月DD日')
    } else if (viewMode === 'week') {
      const start = selectedDate.startOf('week')
      const end = selectedDate.endOf('week')
      return `${start.format('MM月DD日')} - ${end.format('MM月DD日')}`
    } else {
      return selectedDate.format('YYYY年MM月')
    }
  }

  const getRecentRecord = () => {
    if (dailyRecords.length === 0) return null
    return dailyRecords[0]
  }

  const getWeekBarOption = (weekRecords) => {
    const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const weekStart = selectedDate.startOf('week')
    
    const data = weekDays.map((_, idx) => {
      const date = weekStart.add(idx, 'day')
      const record = weekRecords.find(r => dayjs(r.date).isSame(date, 'day'))
      return record?.duration || 7.0
    })

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#e0e0e0',
        textStyle: { color: '#333' },
        padding: [12, 16],
        borderRadius: 8,
        formatter: (params) => `${params[0].axisValue}<br/>睡眠时长: ${params[0].value.toFixed(1)}小时`
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: weekDays,
        axisLine: { lineStyle: { color: '#e0e0e0' } },
        axisLabel: { color: '#6b6b6b', fontSize: 12 }
      },
      yAxis: {
        type: 'value',
        name: '小时',
        nameTextStyle: { color: '#999', fontSize: 12 },
        axisLine: { show: false },
        axisLabel: { color: '#6b6b6b', fontSize: 12 },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
        min: 0,
        max: 12
      },
      series: [
        {
          type: 'bar',
          barWidth: '50%',
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: '#1a6340'
          },
          data
        }
      ]
    }
  }

  const getMonthLineOption = (monthRecords) => {
    const daysInMonth = selectedDate.daysInMonth()
    const data = []
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = selectedDate.date(i)
      const record = monthRecords.find(r => dayjs(r.date).isSame(date, 'day'))
      data.push(record?.duration || null)
    }

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#e0e0e0',
        textStyle: { color: '#333' },
        padding: [12, 16],
        borderRadius: 8,
        formatter: (params) => {
          const date = selectedDate.date(params[0].dataIndex + 1)
          const value = params[0].value
          return `${date.format('MM月DD日')}<br/>睡眠时长: ${value ? `${value.toFixed(1)}小时` : '无数据'}`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`),
        axisLine: { lineStyle: { color: '#e0e0e0' } },
        axisLabel: { color: '#6b6b6b', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        name: '小时',
        nameTextStyle: { color: '#999', fontSize: 12 },
        axisLine: { show: false },
        axisLabel: { color: '#6b6b6b', fontSize: 12 },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
        min: 0,
        max: 12
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#45a86f', width: 3 },
          itemStyle: { color: '#45a86f' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(69, 168, 111, 0.3)' },
                { offset: 1, color: 'rgba(69, 168, 111, 0.05)' }
              ]
            }
          },
          data
        }
      ]
    }
  }

  const getSleepTimelineOption = (data) => {
    const deep = data?.sleepDistribution?.deep || 2.5
    const light = data?.sleepDistribution?.light || 4.0
    const rem = data?.sleepDistribution?.rem || 1.0
    const duration = data?.sleepDuration || 7.5
    const bedtime = 23.5
    const totalH = deep + light + rem + Math.max(0, duration - deep - light - rem)
    let t = bedtime
    const deepSegs = [], lightSegs = [], remSegs = [], awakePts = []
    const cycleLen = 1.5, cycles = Math.ceil(totalH / cycleLen)
    const remPC = rem / cycles, deepPC = deep / cycles, lightPC = (totalH - deep - rem - Math.max(0, duration - deep - light - rem)) / cycles
    const awakeCt = Math.max(0, duration - deep - light - rem) > 0.3 ? Math.min(3, Math.round(Math.max(0, duration - deep - light - rem) / 0.15)) : 0
    const awakeLn = awakeCt > 0 ? Math.max(0, duration - deep - light - rem) / awakeCt : 0
    for (let c = 0; c < cycles; c++) {
      const l1 = lightPC * 0.55
      if (l1 > 0.03) { lightSegs.push([t, t + l1]); t += l1 }
      const d = c === 0 ? deepPC * 1.3 : deepPC
      if (d > 0.03) { deepSegs.push([t, t + d]); t += d }
      const l2 = lightPC * 0.45
      if (l2 > 0.03) { lightSegs.push([t, t + l2]); t += l2 }
      const r = c === cycles - 1 ? remPC * 1.5 : remPC
      if (r > 0.03) { remSegs.push([t, t + r]); t += r }
      if (awakeCt > 0 && c >= 1 && c < 1 + awakeCt) {
        const al = Math.min(awakeLn, 0.2)
        awakePts.push({ s: t, e: t + al }); t += al
      }
    }
    const endTime = bedtime + totalH
    const fmt = (h) => { const hr = Math.floor(h) % 24; const mn = Math.round((h - Math.floor(h)) * 60); return `${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}` }
    const mkBar = (yIdx, segs, color, stageName) => ({
      type: 'custom',
      renderItem: (params, api) => {
        const y = api.coord([0, yIdx])[1], barH = api.size([0, 1])[1] * 0.3
        const x1 = api.coord([api.value(1), yIdx])[0], x2 = api.coord([api.value(2), yIdx])[0]
        return { type: 'rect', shape: { x: x1 + 1, y: y - barH/2, width: Math.max(x2 - x1 - 2, 2), height: barH, r: [2,2,2,2] }, style: { fill: color } }
      },
      encode: { x: [1, 2], y: 0 },
      data: segs.map(s => ({ value: [yIdx, s[0], s[1]], stage: stageName, start: s[0], end: s[1] })),
    })
    return {
      tooltip: { trigger: 'item', backgroundColor: '#fff', borderColor: '#e0e0e0', textStyle: { color: '#333' }, padding: [10, 14], borderRadius: 8,
        formatter: (p) => { const s = p.data.start, e = p.data.end; if (s == null) return ''; return `${fmt(s)} - ${fmt(e)}<br/>${((e-s)).toFixed(1)}小时` } },
      grid: { left: 20, right: 20, top: 6, bottom: 6 },
      xAxis: { type: 'value', min: bedtime, max: endTime, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#999', fontSize: 10, formatter: (v) => fmt(v) }, splitLine: { show: false }, interval: 1 },
      yAxis: { type: 'category', data: ['', '', '', ''], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false } },
      series: [
        mkBar(0, deepSegs, '#1a6340', '深睡眠'),
        mkBar(1, lightSegs, '#45a86f', '浅睡眠'),
        mkBar(2, remSegs, '#7cc99a', 'REM特征'),
        { type: 'scatter', symbol: 'roundRect', symbolSize: [6, 18], itemStyle: { color: '#e07060', borderWidth: 0 }, encode: { x: [0], y: [1] }, data: awakePts.map(p => ({ value: [(p.s+p.e)/2, 3], start: p.s, end: p.e })) },
      ],
    }
  }

  const getSleepQualityColor = (score) => {
    if (!score) return 'gray'
    if (score >= 90) return 'green'
    if (score >= 80) return 'blue'
    if (score >= 60) return 'orange'
    return 'red'
  }

  const getPieOption = (record) => {
    const deep = record?.deepSleep || 2.5
    const light = record?.lightSleep || 4.0
    const rem = record?.remSleep || 1.0
    const duration = record?.duration || 7.5
    const awake = Math.max(0, duration - deep - light - rem)
    const totalMinutes = Math.floor(duration) * 60 + Math.round((duration - Math.floor(duration)) * 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    return {
      tooltip: {
        show: true,
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#e0e0e0',
        textStyle: { color: '#333' },
        padding: [12, 16],
        borderRadius: 8,
        formatter: '{b}: {c}小时 ({d}%)'
      },
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: 'center',
          style: {
            text: `${hours}时${minutes}分`,
            textAlign: 'center',
            fill: '#3d3d3d',
            fontSize: 22,
            fontWeight: 700,
            textShadow: 'none',
            textBlur: 0
          },
          z: 10
        }
      ],
      series: [
        {
          name: '睡眠结构',
          type: 'pie',
          radius: ['50%', '72%'],
          center: ['50%', '50%'],
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 3 },
          label: {
            show: false
          },
          labelLine: {
            show: false
          },
          data: [
            { value: deep, name: '深睡眠', itemStyle: { color: '#1a6340' } },
            { value: light, name: '浅睡眠', itemStyle: { color: '#45a86f' } },
            { value: rem, name: 'REM特征期', itemStyle: { color: '#7cc99a' } },
            { value: awake, name: '清醒', itemStyle: { color: '#e07060' } },
          ],
        },
      ],
    }
  }

  const getWeekStats = () => {
    const weekStart = selectedDate.startOf('week')
    const weekRecords = dailyRecords.filter(record => {
      const recordDate = dayjs(record.date)
      return recordDate >= weekStart && recordDate <= weekStart.add(6, 'day')
    })
    
    const totalDuration = weekRecords.reduce((sum, r) => sum + (r.duration || 0), 0)
    const avgDuration = weekRecords.length > 0 ? totalDuration / weekRecords.length : 0
    const avgScore = weekRecords.length > 0 
      ? weekRecords.reduce((sum, r) => sum + (r.score || 0), 0) / weekRecords.length 
      : 0
    
    return {
      count: weekRecords.length,
      avgDuration,
      avgScore,
      records: weekRecords
    }
  }

  const getMonthlyStats = () => {
    const monthStart = selectedDate.startOf('month')
    const monthEnd = selectedDate.endOf('month')
    const monthRecords = dailyRecords.filter(record => {
      const recordDate = dayjs(record.date)
      return recordDate >= monthStart && recordDate <= monthEnd
    })
    
    const totalDuration = monthRecords.reduce((sum, r) => sum + (r.duration || 0), 0)
    const avgDuration = monthRecords.length > 0 ? totalDuration / monthRecords.length : 0
    const avgScore = monthRecords.length > 0 
      ? monthRecords.reduce((sum, r) => sum + (r.score || 0), 0) / monthRecords.length 
      : 0
    
    return {
      count: monthRecords.length,
      avgDuration,
      avgScore,
      records: monthRecords
    }
  }

  const formatDuration = (hours) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}小时${m}分钟`
  }

  const getSleepQualityText = (score) => {
    if (!score) return '数据不足'
    if (score >= 90) return '优秀'
    if (score >= 80) return '良好'
    if (score >= 60) return '一般'
    return '较差'
  }

  const recentRecord = getRecentRecord()
  const weeklyStats = getWeekStats()
  const monthlyStats = getMonthlyStats()

  const handleAnalyze = async () => {
    if (!recentRecord) return
    
    setAiLoading(true)
    try {
      const result = await getSleepSuggestion({
        duration: recentRecord.duration,
        score: recentRecord.score,
        deepSleep: recentRecord.deepSleep,
        lightSleep: recentRecord.lightSleep,
        remSleep: recentRecord.remSleep,
        efficiency: recentRecord.efficiency,
        avgRespiration: dashboardData?.avgRespiration
      })
      
      if (result.success && result.suggestions) {
        setAiSuggestions(result.suggestions)
      }
    } catch (e) {
      console.error('获取AI睡眠建议失败:', e)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="sleep-page">
      <div className="page-header">
        <div className="header-title">
          <Bed size={28} className="page-icon" />
          <h2>睡眠</h2>
        </div>
        
        <div className="date-nav">
          <Button 
            type="text" 
            icon={<ChevronLeft size={20} />} 
            onClick={handlePrev}
            className="nav-btn"
          />
          <div className="date-display">
            {viewMode === 'month' ? (
              <MonthPicker
                value={selectedDate}
                onChange={(date) => setSelectedDate(date)}
                placeholder="选择月份"
              />
            ) : (
              <span className="date-text">{getDateDisplay()}</span>
            )}
          </div>
          <Button 
            type="text" 
            icon={<ChevronRight size={20} />} 
            onClick={handleNext}
            className="nav-btn"
          />
        </div>

        <div className="view-tabs">
          {['day', 'week', 'month'].map((mode) => (
            <button
              key={mode}
              className={`tab-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'day' ? '日' : mode === 'week' ? '周' : '月'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'day' && recentRecord && (
        <>
          <Card className="sleep-summary-card">
            <div className="ss-header">
              <div className="ss-times">
                <div className="ss-time-item">
                  <Moon size={20} />
                  <div>
                    <span className="ss-time-val">{recentRecord.startTime}</span>
                    <span className="ss-time-lbl">入睡</span>
                  </div>
                </div>
                <div className="ss-time-item">
                  <Sun size={20} />
                  <div>
                    <span className="ss-time-val">{recentRecord.endTime}</span>
                    <span className="ss-time-lbl">起床</span>
                  </div>
                </div>
              </div>
              <div className="ss-dur-center">
                <span className="ss-dur-val">{formatDuration(recentRecord.duration)}</span>
              </div>
              <div className="ss-dur-right">
                <span className="ss-dur-src">数据来源: 睡眠监测设备</span>
                <Tag color={getSleepQualityColor(recentRecord.score)}>
                  {getSleepQualityText(recentRecord.score)}
                </Tag>
              </div>
            </div>
            <div className="ss-chart-box">
              <ReactECharts option={getSleepTimelineOption(dashboardData)} style={{ height: 130 }} />
            </div>
            <div className="ss-legend">
              <span><span className="ssl-dot" style={{background:'#1a6340'}}></span>深睡眠</span>
              <span><span className="ssl-dot" style={{background:'#45a86f'}}></span>浅睡眠</span>
              <span><span className="ssl-dot" style={{background:'#7cc99a'}}></span>REM</span>
              <span><span className="ssl-dot" style={{background:'#e07060'}}></span>清醒</span>
            </div>
          </Card>

          <Card className="sleep-structure-card">
            <div className="card-header">
              <h3 className="card-title">
                <BarChart3 size={16} />
                睡眠结构
              </h3>
            </div>
            <div className="structure-content">
              <div className="pie-chart-wrapper">
                <ReactECharts option={getPieOption(recentRecord)} style={{ height: '100%', width: '100%', minHeight: 280, minWidth: 280 }} />
              </div>
              <div className="structure-list">
                {[
                  { name: '浅睡眠', value: recentRecord.lightSleep || 4.0, color: '#45a86f', percent: 74, range: '60%-80%', hours: 6, mins: 2 },
                  { name: '深睡眠', value: recentRecord.deepSleep || 2.5, color: '#1a6340', percent: 26, range: '20%-40%', hours: 2, mins: 6 },
                  { name: 'REM特征期', value: recentRecord.remSleep || 1.0, color: '#7cc99a', percent: 13, range: '10%-25%', hours: 0, mins: 50 },
                  { name: '清醒', value: Math.round(((recentRecord.duration || 7.5) - (recentRecord.deepSleep || 2.5) - (recentRecord.lightSleep || 4.0) - (recentRecord.remSleep || 1.0)) * 60), color: '#e07060', percent: 2, range: '0-2次', unit: '分钟', count: 2, mins: 13 }
                ].map((item, index) => (
                  <div key={index} className="structure-item">
                    <div className="structure-left">
                      <div className="structure-name">
                        <div className="structure-dot" style={{ backgroundColor: item.color }}></div>
                        <span>{item.name}</span>
                      </div>
                      <div className="structure-info">
                        <span className="structure-percent">{item.percent}%</span>
                        <span className="structure-range">参考: {item.range}</span>
                      </div>
                    </div>
                    <div className="structure-right">
                      {item.unit === '分钟' ? (
                        <>
                          <span className="structure-count">{item.count}次</span>
                          <span className="structure-time">{item.mins}分</span>
                        </>
                      ) : (
                        <span className="structure-time">{item.hours}时{item.mins}分</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="metrics-suggest-card">
            <div className="ms-left">
              <h3 className="ms-title">睡眠指标</h3>
              <div className="ms-items">
                <div className="ms-item">
                  <div className="ms-icon-wrapper" style={{backgroundColor:'#fee2e2'}}>
                    <Heart size={22} color="#dc2626" />
                  </div>
                  <div className="ms-details">
                    <div className="ms-val-row">
                      <span className="ms-val">{dashboardData?.avgRespiration || 16}</span>
                      <span className="ms-unit">次/分钟</span>
                    </div>
                    <span className="ms-lbl">平均呼吸率</span>
                  </div>
                </div>
                <div className="ms-item">
                  <div className="ms-icon-wrapper" style={{backgroundColor:'#e0f2fe'}}>
                    <Wind size={22} color="#0284c7" />
                  </div>
                  <div className="ms-details">
                    <div className="ms-val-row">
                      <span className="ms-val">{recentRecord.efficiency || 87}</span>
                      <span className="ms-unit">%</span>
                    </div>
                    <span className="ms-lbl">睡眠效率</span>
                  </div>
                </div>
                <div className="ms-item">
                  <div className="ms-icon-wrapper" style={{backgroundColor:'#f0fdf4'}}>
                    <Clock size={22} color="#16a34a" />
                  </div>
                  <div className="ms-details">
                    <div className="ms-val-row">
                      <span className="ms-val">{recentRecord.score || 85}</span>
                      <span className="ms-unit">分</span>
                    </div>
                    <span className="ms-lbl">睡眠评分</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="ms-divider"></div>
            <div className="ms-right">
              <div className="ms-suggest-header">
                <Lightbulb size={18} color="#f59e0b" />
                <h3 className="ms-title">睡眠建议</h3>
                <Button
                  type="primary"
                  icon={<RefreshCw size={12} />}
                  onClick={handleAnalyze}
                  loading={aiLoading}
                  style={{ padding: '2px 12px', fontSize: '10px', marginLeft: '8px' }}
                >
                  智能分析
                </Button>
              </div>
              <div className="ms-suggest-content">
                {aiLoading ? (
                  <div className="ms-loading">
                    <Spin size="small" />
                  </div>
                ) : aiSuggestions.length > 0 ? (
                  <div className="ms-suggest-list">
                    {aiSuggestions.slice(0, 3).map((s, i) => {
                      const levelColors = {
                        '最佳': 'green',
                        '良好': 'green',
                        '注意': 'orange',
                        '需改善': 'orange',
                        '急需改善': 'red'
                      }
                      return (
                        <div key={i} className={`ms-suggest-item ${levelColors[s.level] || 'green'}`}>
                          <span className="ms-suggest-icon">{s.level === '最佳' || s.level === '良好' ? '💡' : '⚠️'}</span>
                          <div>
                            <span className="ms-suggest-title">{s.title}</span>
                            <span className="ms-suggest-desc">{s.desc}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="ms-suggest-box">
                    <p className="ms-text">点击"智能分析"按钮获取个性化睡眠建议</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </>
      )}

      {viewMode === 'week' && (
        <Card className="week-chart-card">
          <div className="card-header">
            <h3 className="card-title">本周睡眠趋势</h3>
            <div className="week-summary">
              <span className="summary-item">本周睡眠 <strong>{weeklyStats.count}</strong> 天</span>
              <span className="summary-item">平均时长 <strong>{weeklyStats.avgDuration.toFixed(1)}小时</strong></span>
              <span className="summary-item">平均评分 <strong>{weeklyStats.avgScore.toFixed(0)}分</strong></span>
            </div>
          </div>
          <ReactECharts option={getWeekBarOption(weeklyStats.records)} style={{ height: 280 }} />
        </Card>
      )}

      {viewMode === 'month' && (
        <Card className="month-chart-card">
          <div className="card-header">
            <h3 className="card-title">本月睡眠趋势</h3>
            <div className="month-summary">
              <span className="summary-item">本月睡眠 <strong>{monthlyStats.count}</strong> 天</span>
              <span className="summary-item">平均时长 <strong>{monthlyStats.avgDuration.toFixed(1)}小时</strong></span>
              <span className="summary-item">平均评分 <strong>{monthlyStats.avgScore.toFixed(0)}分</strong></span>
            </div>
          </div>
          <ReactECharts option={getMonthLineOption(monthlyStats.records)} style={{ height: 300 }} />
        </Card>
      )}
    </div>
  )
}

export default SleepRecords