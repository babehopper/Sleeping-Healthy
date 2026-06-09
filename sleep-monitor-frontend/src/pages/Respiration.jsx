import { useState, useEffect } from 'react'
import { Row, Col, Card, Tag, Tabs, Spin, Button } from 'antd'
import { Activity, Lightbulb, CheckCircle, Moon, TrendingUp, RefreshCw } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { getRespirationData, getRespirationWave, getSleepStageRespiration, getRespirationTrend, getRespirationAlerts, getRespirationSuggestion } from '../api/respiration'
import './Respiration.css'

const Respiration = () => {
  const [data, setData] = useState(null)
  const [waveData, setWaveData] = useState([])
  const [sleepStageData, setSleepStageData] = useState(null)
  const [trendData, setTrendData] = useState(null)
  const [alertsData, setAlertsData] = useState([])
  const [trendTab, setTrendTab] = useState('day')
  const [monthLabel, setMonthLabel] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)

  const userId = localStorage.getItem('userId')

  useEffect(() => {
    if (!userId) return
    fetchAllData()
    const t = setInterval(fetchAllData, 60000)
    return () => clearInterval(t)
  }, [userId, trendTab])

  const fetchAllData = async () => {
    const currentDate = dayjs().format('YYYY-MM-DD')
    try {
      const [respResult, waveResult, stageResult, trendResult, alertsResult] = await Promise.all([
        getRespirationData(userId),
        getRespirationWave(userId),
        getSleepStageRespiration(userId, currentDate),
        getRespirationTrend(userId, trendTab, currentDate),
        getRespirationAlerts(userId, currentDate)
      ])

      if (respResult.success) setData(respResult.data)
      if (waveResult.success) setWaveData(waveResult.data || [])
      if (stageResult.success) setSleepStageData(stageResult.data)
      if (trendResult.success) {
        setTrendData(trendResult.data)
        if (trendResult.monthLabel) setMonthLabel(trendResult.monthLabel)
      }
      if (alertsResult.success) setAlertsData(alertsResult.data || [])
    } catch (e) {
      console.error('获取呼吸数据失败:', e)
    }
  }

  const handleAnalyze = async () => {
    if (!data) return
    
    setAiLoading(true)
    try {
      const avgBR = data?.avgRespiration
      const qualityScore = data?.qualityScore || 0
      const hasAlerts = alertsData.length > 0
      
      const result = await getRespirationSuggestion({
        avgRespiration: avgBR,
        qualityScore: qualityScore,
        hasAlerts: hasAlerts
      })
      
      if (result.success && result.suggestions) {
        setAiSuggestions(result.suggestions)
      }
    } catch (e) {
      console.error('获取AI呼吸建议失败:', e)
    } finally {
      setAiLoading(false)
    }
  }

  // 呼吸率数值直接来自 data API（已确认有会话数据）
  const avgBR = data?.avgRespiration || null
  const hasRealData = avgBR !== null && avgBR !== undefined

  // ---- Real-time waveform ----
  const getWaveformOption = () => {
    let pts = []
    if (waveData && waveData.length > 0) {
      if (Array.isArray(waveData)) {
        pts = waveData.filter(v => typeof v === 'number' && !isNaN(v) && v > 0)
      }
    }

    // If no waveform points, show the session average as a flat reference line
    if (pts.length === 0) {
      const displayBR = data?.avgRespiration || avgBR || 16
      return {
        graphic: [
          { type: 'text', left: 'center', top: 'center', style: { text: `${displayBR} 次/分`, textAlign: 'center', fill: '#2d8a56', fontSize: 28, fontWeight: 'bold' } },
        ],
        grid: { left: 36, right: 16, top: 12, bottom: 24 },
        xAxis: { show: false, data: [] },
        yAxis: { show: false },
        series: [],
      }
    }

    const dataCount = pts.length
    const xLabels = Array.from({ length: dataCount }, (_, i) => '')

    return {
      graphic: [],
      tooltip: { 
        trigger: 'axis', 
        backgroundColor: '#fff', 
        borderColor: '#e0e0e0', 
        textStyle: { color: '#333' }, 
        padding: [6, 10], 
        borderRadius: 6,
        formatter: (params) => { 
          const p = params[0]
          return `呼吸率: ${p.value} 次/分` 
        }
      },
      grid: { left: 20, right: 20, top: 15, bottom: 20 },
      xAxis: {
        type: 'category', 
        data: xLabels,
        axisLabel: { show: false },
        axisLine: { show: false }, 
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value', 
        min: 5, 
        max: 28,
        axisLabel: { color: '#aaa', fontSize: 9 },
        splitLine: { lineStyle: { color: '#f5f5f5' } },
        axisLine: { show: false }, 
        axisTick: { show: false },
      },
      series: [{
        type: 'line', 
        data: pts,
        smooth: true,
        symbol: 'none',
        symbolSize: 0,
        lineStyle: { color: '#2d8a56', width: 2.5 },
        itemStyle: { color: '#2d8a56' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(45,138,86,0.25)' }, { offset: 1, color: 'rgba(45,138,86,0.02)' }] } },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#e07060', type: 'dashed', width: 1 }, label: { fontSize: 9, color: '#e07060', formatter: '上限' }, data: [{ yAxis: 22 }] },
        clip: false,
      }],
    }
  }

  // ---- Sleep + BR compact view ----
  const hasSleepData = sleepStageData || (data?.sleepDistribution || data?.sleepDuration)
  const deep = sleepStageData?.deepSleep?.hours || data?.sleepDistribution?.deep
  const light = sleepStageData?.lightSleep?.hours || data?.sleepDistribution?.light
  const rem = sleepStageData?.remSleep?.hours || data?.sleepDistribution?.rem
  const dur = sleepStageData?.totalSleep || data?.sleepDuration
  const awake = dur && deep != null && light != null && rem != null ? Math.max(0, (dur - deep - light - rem)) : null
  const stages = hasSleepData ? [
    { name: '深睡眠', h: deep, color: '#1a6340', br: sleepStageData?.deepSleep?.avgRespiration || null },
    { name: '浅睡眠', h: light, color: '#45a86f', br: sleepStageData?.lightSleep?.avgRespiration || null },
    { name: 'REM特征', h: rem, color: '#7cc99a', br: sleepStageData?.remSleep?.avgRespiration || null },
    { name: '清醒', h: awake, color: '#e07060', br: sleepStageData?.awake?.avgRespiration || null },
  ] : []

  // ---- Historical trends (day/week/month) ----
  const getTrendOption = (mode) => {
    let hours = []
    let vals = []

    if (trendData && Array.isArray(trendData) && trendData.length > 0) {
      // 直接使用后端返回的数据，后端已经计算好了每日/周/月的平均值
      hours = trendData.map(item => item.time || item.label || '')
      vals = trendData.map(item => {
        const v = item.value
        if (v === null || v === undefined || v === '' || isNaN(v)) return null
        return parseFloat(v)
      })
    }

    if (mode === 'day') {
      if (hours.length === 0) {
        hours = []
        vals = []
        for (let h = 0; h < 24; h++) {
          hours.push(`${String(h).padStart(2, '0')}:00`)
          vals.push(null)
        }
      }
      return {
        tooltip: { 
          trigger: 'axis', 
          backgroundColor: '#fff', 
          borderColor: '#e0e0e0', 
          textStyle: { color: '#333' }, 
          padding: [6, 10], 
          borderRadius: 6,
          formatter: (params) => {
            const p = params[0]
            if (p.value == null) return `${p.axisValue}<br/>暂无数据`
            return `${p.axisValue}<br/>呼吸率: ${p.value} 次/分`
          }
        },
        grid: { left: 50, right: 35, top: 25, bottom: 50, containLabel: true },
        xAxis: { 
          type: 'category', 
          data: hours, 
          axisLabel: { color: '#888', fontSize: 9, rotate: 30, interval: Math.max(1, Math.floor(hours.length / 6)) }, 
          axisLine: { lineStyle: { color: '#e0e0e0' } }, 
          axisTick: { show: false }, 
          boundaryGap: true 
        },
        yAxis: { 
          type: 'value', 
          min: 8, 
          max: 22, 
          axisLabel: { color: '#888', fontSize: 9 }, 
          splitLine: { lineStyle: { color: '#f5f5f5' } }, 
          axisLine: { show: false }, 
          axisTick: { show: false }, 
          padding: [0, 10, 0, 0] 
        },
        series: [{ 
          type: 'line', 
          data: vals, 
          smooth: true, 
          symbol: 'circle', 
          symbolSize: 5, 
          lineStyle: { color: '#e88a40', width: 2 }, 
          itemStyle: { color: '#e88a40' },
          connectNulls: false,
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(232,138,64,0.18)' }, { offset: 1, color: 'rgba(232,138,64,0.02)' }] } },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: '#2d8a56', type: 'dashed' }, label: { fontSize: 9, color: '#2d8a56', formatter: '平均' }, data: [{ yAxis: 14.5 }] },
          clip: false,
        }],
      }
    }
    
    if (mode === 'month') {
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth()
      const totalDays = new Date(year, month + 1, 0).getDate()
      
      if (hours.length === 0) {
        hours = []
        vals = []
        for (let d = 1; d <= totalDays; d++) {
          hours.push(`${d}日`)
          vals.push(null)
        }
      } else {
        const newHours = []
        const newVals = []
        for (let d = 1; d <= totalDays; d++) {
          const dayLabel = `${d}日`
          const idx = hours.indexOf(dayLabel)
          if (idx !== -1 && vals[idx] != null && !isNaN(vals[idx])) {
            newHours.push(dayLabel)
            newVals.push(vals[idx])
          } else {
            newHours.push(dayLabel)
            newVals.push(0)
          }
        }
        hours = newHours
        vals = newVals
      }
      
      const ml = monthLabel || `${year}年${month + 1}月`
      
      return {
        tooltip: { 
          trigger: 'axis', 
          backgroundColor: '#fff', 
          borderColor: '#e0e0e0', 
          textStyle: { color: '#333' }, 
          padding: [6, 10], 
          borderRadius: 6,
          formatter: (params) => {
            const p = params[0]
            if (p.value == null || isNaN(p.value)) return `${ml} ${p.axisValue}<br/>暂无数据`
            return `${ml} ${p.axisValue}<br/>平均呼吸率: ${p.value} 次/分`
          }
        },
        grid: { left: '8%', right: '8%', top: 20, bottom: 35, containLabel: true },
        xAxis: { 
          type: 'category', 
          data: hours, 
          axisLabel: { color: '#888', fontSize: 8, interval: Math.max(1, Math.floor(hours.length / 12)) }, 
          axisLine: { lineStyle: { color: '#e0e0e0' } }, 
          axisTick: { show: false }, 
          boundaryGap: false,
          min: 0,
          max: hours.length - 1
        },
        yAxis: { 
          type: 'value', 
          min: 10, 
          max: 22, 
          axisLabel: { color: '#888', fontSize: 9 }, 
          splitLine: { lineStyle: { color: '#f5f5f5' } }, 
          axisLine: { show: false }, 
          axisTick: { show: false },
          padding: [0, 10, 0, 0]
        },
        series: [{ 
          type: 'line', 
          data: vals, 
          smooth: true, 
          symbol: 'circle', 
          symbolSize: 4, 
          connectNulls: false, 
          lineStyle: { color: '#e88a40', width: 2 }, 
          itemStyle: { color: '#e88a40' }, 
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(232,138,64,0.12)' }, { offset: 1, color: 'rgba(232,138,64,0.02)' }] } }
        }],
      }
    }
    return {}
  }

  const qualityScore = data?.qualityScore || (data?.avgRespiration
    ? Math.min(95, Math.max(30, 50 + (avgBR >= 12 && avgBR <= 20 ? 25 : 0) + (alertsData.length === 0 ? 15 : -10)))
    : null)

  return (
    <div className="respiration-page">
      {/* Row 1: Real-time monitoring */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card className="resp-card">
            <div className="resp-realtime-header">
              <div className="resp-title-area">
                <Activity size={20} style={{ color: '#2d8a56' }} />
                <span className="resp-title">最近一次实时呼吸监测</span>
                <span className="resp-subtitle">Latest Real-time Respiratory Monitoring</span>
              </div>
              <div className="resp-current-br">
                {hasRealData ? (
                  <>
                    <span className="br-number">{avgBR}</span>
                    <span className="br-unit">次/分</span>
                    <Tag color={avgBR < 12 ? 'orange' : avgBR > 20 ? 'red' : 'green'} className="br-tag">
                      {avgBR < 12 ? '偏低' : avgBR > 20 ? '偏高' : '正常'}
                    </Tag>
                  </>
                ) : (
                  <>
                    <span className="br-number">--</span>
                    <span className="br-unit">次/分</span>
                    <Tag color="gray" className="br-tag">暂无数据</Tag>
                  </>
                )}
              </div>
            </div>
            <ReactECharts option={getWaveformOption()} style={{ height: 220 }} />
          </Card>
        </Col>
      </Row>

      {/* Row 2: Sleep stage correlation */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card className="resp-card" title={
            <span className="card-title-text"><Moon size={16} style={{ color: '#5c6bc0' }} /> 睡眠阶段呼吸率</span>
          }>
            <div className="stage-br-row">
              {stages.length > 0 ? (
                stages.map((s, i) => (
                  <div key={i} className="stage-br-item">
                    <div className="sbr-header">
                      <span className="sbr-dot" style={{ background: s.color }}></span>
                      <span className="sbr-name">{s.name}</span>
                      <span className="sbr-time">{s.h != null ? `${s.h.toFixed(1)}h` : '--'}</span>
                    </div>
                    <div className="sbr-bar-wrap">
                      {s.h != null && dur != null && awake != null ? (
                        <div className="sbr-bar" style={{ width: `${(s.h / (dur + awake)) * 100}%`, background: s.color }}></div>
                      ) : (
                        <div className="sbr-bar-empty"></div>
                      )}
                    </div>
                    <div className="sbr-br">
                      <Activity size={12} style={{ color: s.color }} />
                      <span>{s.br != null ? `平均 ${s.br} 次/分` : '暂无数据'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="stage-br-empty">
                  <CheckCircle size={32} style={{ color: '#ccc' }} />
                  <span>暂无睡眠阶段数据</span>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Row 3: Historical trends */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card className="resp-card" title={
            <div className="trend-title-container">
              <span className="card-title-text"><TrendingUp size={16} style={{ color: '#e88a40' }} /> 历史趋势</span>
              {trendTab === 'month' && (
                <span className="trend-date-display">
                  {dayjs().format('YYYY年MM月')}
                </span>
              )}
            </div>
          } extra={
            <Tabs activeKey={trendTab} onChange={setTrendTab} size="small" items={[
              { key: 'day', label: '日' },
              { key: 'month', label: '月' },
            ]} />
          }>
            <ReactECharts option={getTrendOption(trendTab)} style={{ height: 240 }} />
          </Card>
        </Col>
      </Row>

      {/* Row 4: Quality + Suggestions in one card */}
      <Row gutter={16}>
        <Col span={24}>
          <Card className="resp-card">
            <div className="resp-bottom-grid">
              {/* Left: Quality assessment */}
              <div className="resp-section">
                <h4 className="resp-section-title"><CheckCircle size={14} style={{ color: '#2d8a56' }} /> 质量评估</h4>
                <div className="resp-gauge">
                  {qualityScore != null ? (
                    <>
                      <div className="gauge-ring" style={{ background: `conic-gradient(#2d8a56 0% ${qualityScore}%, #e8a840 ${qualityScore}% ${qualityScore + 18}%, #e07060 ${qualityScore + 18}% 100%)` }}>
                        <div className="gauge-center">
                          <span className="gauge-value">{qualityScore}</span>
                          <span className="gauge-label">分</span>
                        </div>
                      </div>
                      <div className="resp-gauge-legend">
                        <span><span className="gdot" style={{ background: '#2d8a56' }}></span>正常 {Math.min(qualityScore, 70)}%</span>
                        <span><span className="gdot" style={{ background: '#e8a840' }}></span>偏缓 {Math.min(Math.max(qualityScore - 70, 0), 20)}%</span>
                        <span><span className="gdot" style={{ background: '#e07060' }}></span>异常 {Math.max(100 - qualityScore, 10)}%</span>
                      </div>
                    </>
                  ) : (
                    <div className="gauge-empty">
                      <CheckCircle size={32} style={{ color: '#ccc' }} />
                      <span>暂无数据</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Smart suggestions */}
              <div className="resp-section">
                <h4 className="resp-section-title">
                  <Lightbulb size={14} style={{ color: '#e8a840' }} /> 智能建议
                  <Button
                    type="primary"
                    icon={<RefreshCw size={12} />}
                    onClick={handleAnalyze}
                    loading={aiLoading}
                    style={{ padding: '2px 12px', fontSize: '10px', marginLeft: '8px' }}
                  >
                    智能分析
                  </Button>
                </h4>
                <div className="resp-suggestions">
                  {aiLoading ? (
                    <div className="sug-loading">
                      <Spin size="small" />
                    </div>
                  ) : aiSuggestions.length > 0 ? (
                    aiSuggestions.slice(0, 3).map((s, i) => {
                      const levelColors = {
                        '最佳': 'green',
                        '良好': 'green',
                        '注意': 'orange',
                        '需改善': 'red',
                        '急需改善': 'red'
                      }
                      const classMap = {
                        '最佳': 'green',
                        '良好': 'green',
                        '注意': 'orange',
                        '需改善': 'orange',
                        '急需改善': 'orange'
                      }
                      return (
                        <div key={i} className={`sug-item ${classMap[s.level] || 'green'}`}>
                          <span className="sug-icon">{s.level === '最佳' || s.level === '良好' ? '💡' : '⚠️'}</span>
                          <div>
                            <span className="sug-title">{s.title}</span>
                            <span className="sug-desc">{s.desc}</span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <>
                      <div className="sug-item green">
                        <span className="sug-icon">💡</span>
                        <div>
                          <span className="sug-title">{data?.avgRespiration ? (avgBR < 12 ? '呼吸率偏低' : avgBR > 20 ? '呼吸率偏高' : '呼吸率正常') : '等待数据'}</span>
                          <span className="sug-desc">{data?.avgRespiration ? (avgBR < 12 ? `当前${avgBR}次/分，低于正常范围(12-20)，注意监测` : avgBR > 20 ? `当前${avgBR}次/分，高于正常范围(12-20)，建议放松` : `当前${avgBR}次/分，处于健康范围(12-20)，保持规律`) : '请确保ESP32设备已连接并开始采集呼吸数据'}</span>
                        </div>
                      </div>
                      <div className="sug-item green">
                        <span className="sug-icon">💡</span>
                        <div>
                          <span className="sug-title">持续监测中</span>
                          <span className="sug-desc">正在积累呼吸数据，系统将持续分析睡眠呼吸模式</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Respiration
