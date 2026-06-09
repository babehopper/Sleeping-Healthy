import { useState } from 'react'
import { Row, Col, Card, Tag, Calendar, Modal, message, Popover, Badge } from 'antd'
import { Activity, CheckCircle, Calendar as CalendarIcon } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import './HeartRate.css'

const HeartRate = () => {
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedHeartRate, setSelectedHeartRate] = useState(null)

  const avgHR = 58
  const avgHRLow = 52
  const avgHRHigh = 74
  const avgAvgHR = 61

  // ---- Real-time heart rate waveform ----
  const getWaveformOption = () => {
    const pts = []
    for (let i = 0; i < 200; i++) {
      const base = 60 + Math.sin(i * 0.3) * 30 + Math.sin(i * 0.8) * 12
      pts.push(base)
    }
    const labels = pts.map((_, i) => {
      const sec = Math.floor(i / 10)
      return `${String(sec).padStart(2,'0')}:${String(i % 10 * 6).padStart(2,'0')}`
    })
    const showLabels = labels.map((l, i) => i % 40 === 0 ? l : '')
    return {
      tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e0e0e0', textStyle: { color: '#333' }, padding: [6, 10], borderRadius: 6 },
      grid: { left: 36, right: 16, top: 12, bottom: 24 },
      xAxis: { type: 'category', data: showLabels, axisLabel: { color: '#aaa', fontSize: 9, interval: 0 }, axisLine: { show: false }, axisTick: { show: false }, boundaryGap: false },
      yAxis: { type: 'value', min: 30, max: 110, axisLabel: { color: '#aaa', fontSize: 9 }, splitLine: { lineStyle: { color: '#f5f5f5' } }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'line', data: pts, smooth: true, symbol: 'none', lineStyle: { color: '#e07060', width: 2.5 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(224,112,96,0.25)' }, { offset: 1, color: 'rgba(224,112,96,0.02)' }] } },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#e8a840', type: 'dashed', width: 1 }, label: { fontSize: 9, color: '#e8a840', formatter: '参考线' }, data: [{ yAxis: 70 }] },
      }],
    }
  }

  // ---- Heart & respiration chart ----
  const getRespirationChartOption = () => {
    const hrs = [62, 60, 58, 55, 52, 50, 53, 57, 60, 58, 56, 54, 53, 55, 58, 57, 56, 55, 56, 55, 54, 53, 52, 53, 54, 56, 57, 58, 57, 55, 53, 55, 56, 57, 56, 55, 54, 53, 55, 56, 55, 54, 55, 56, 55, 56, 55, 56, 55, 56, 57, 58, 57, 56, 55, 54, 53, 52, 51, 52, 53, 55, 57, 58, 57, 56, 55, 54, 53, 54, 56, 57, 58, 57, 55]
    const resps = [14, 14, 13, 13, 12, 12, 13, 14, 15, 14, 13, 13, 12, 13, 14, 14, 13, 13, 12, 12, 12, 12, 11, 12, 13, 14, 14, 15, 14, 13, 12, 13, 14, 15, 14, 13, 12, 12, 13, 14, 13, 13, 14, 15, 14, 15, 14, 15, 14, 15, 16, 15, 14, 13, 12, 12, 11, 11, 12, 13, 14, 15, 14, 13, 13, 12, 13, 14, 15, 14, 13, 13, 12, 13]
    const times = ['22:30', '22:45', '23:00', '23:15', '23:30', '23:45', '00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30']
    const showTimes = times.map((t, i) => i % 4 === 0 ? t : '')
    return {
      tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e0e0e0', textStyle: { color: '#333' }, padding: [6, 10], borderRadius: 6 },
      legend: { data: ['心率 bpm', '呼吸率 次/min'], bottom: 0, textStyle: { color: '#666' }, itemGap: 24 },
      grid: { left: 36, right: 16, top: 10, bottom: 32 },
      xAxis: { type: 'category', data: showTimes, axisLabel: { color: '#aaa', fontSize: 9 }, axisLine: { lineStyle: { color: '#e0e0e0' } }, axisTick: { show: false } },
      yAxis: [
        { type: 'value', min: 40, max: 90, axisLabel: { color: '#aaa', fontSize: 9 }, splitLine: { lineStyle: { color: '#f5f5f5' } }, axisLine: { show: false }, axisTick: { show: false } },
        { type: 'value', min: 8, max: 20, axisLabel: { color: '#aaa', fontSize: 9 }, axisLine: { show: false }, axisTick: { show: false } },
      ],
      series: [
        { name: '心率 bpm', type: 'line', data: hrs, smooth: true, symbol: 'none', lineStyle: { color: '#e07060', width: 2 }, itemStyle: { color: '#e07060' } },
        { name: '呼吸率 次/min', type: 'line', yAxisIndex: 1, data: resps, smooth: true, symbol: 'none', lineStyle: { color: '#2d8a56', type: 'dashed', width: 2 }, itemStyle: { color: '#2d8a56' } }
      ],
    }
  }

  // ---- Date helpers ----
  const isDateWithin30Days = (date) => {
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    const checkDate = new Date(date.year(), date.month(), date.date())
    return checkDate >= thirtyDaysAgo && checkDate <= today
  }

  const getHeartRateForDate = (date) => {
    const dayOfMonth = date.date()
    return 50 + (dayOfMonth % 20) + Math.random() * 10
  }

  const getDateHeartRateColor = (hr) => {
    if (hr < 55) return '#2d8a56'
    if (hr < 60) return '#45a86f'
    if (hr < 65) return '#e8a840'
    return '#e07060'
  }

  const onDateSelect = (value) => {
    if (!isDateWithin30Days(value)) {
      message.warning('只能查看最近30天的数据')
      return
    }
    const hr = getHeartRateForDate(value)
    setSelectedDate(value.format('YYYY年MM月DD日'))
    setSelectedHeartRate(hr.toFixed(1))
    setModalVisible(true)
  }

  const dateCellRender = (value) => {
    if (!isDateWithin30Days(value)) {
      return null
    }
    const hr = getHeartRateForDate(value)
    const color = getDateHeartRateColor(hr)
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ width: 6, height: 6, background: color, borderRadius: '50%', display: 'inline-block', marginTop: '4px' }}></div>
      </div>
    )
  }

  const motionAlerts = [
    { type: '大幅体动次数', desc: '翻身/夜起等引起CSI突变，会导致心率读数跳变', count: 4, level: 'info' },
    { type: '心率骤升事件', desc: '可能与噩梦、呼吸暂停后应激相关', count: 0, level: 'normal' },
    { type: '入睡心率下降完成时间', desc: '从躺下到心率稳定低于65bpm所需时间', value: '约18分钟', level: 'normal' },
  ]

  return (
    <div className="heartrate-page">
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card className="hr-card">
            <div className="hr-top-left">
              <div className="hr-title">实时心率监测</div>
              <Tag color="default" style={{ marginLeft: 12 }}>估算值 · CSI</Tag>
            </div>
            <div className="hr-realtime">
              <div className="hr-value">{avgHR}
                <small>次/分钟 · 正常静息态</small>
              </div>
              <div className="hr-chart-wrapper">
                <ReactECharts option={getWaveformOption()} style={{ height: 100 }} />
              </div>
            </div>
            <div className="hr-metrics-grid">
              <div className="hr-metric-item">
                <div className="hr-metric-label">今晚最低心率</div>
                <div className="hr-metric-value">{avgHRLow} bpm</div>
                <div className="hr-metric-sub">02:40 深睡期</div>
              </div>
              <div className="hr-metric-item">
                <div className="hr-metric-label">今晚最高心率</div>
                <div className="hr-metric-value">{avgHRHigh} bpm</div>
                <div className="hr-metric-sub">22:35 入睡前</div>
              </div>
              <div className="hr-metric-item">
                <div className="hr-metric-label">全程平均心率</div>
                <div className="hr-metric-value">{avgAvgHR} bpm</div>
                <div className="hr-metric-sub">8小时均值</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card className="hr-card">
            <div className="hr-card-header">
              <span className="hr-card-title">
                <Activity size={16} style={{ color: '#2d8a56', marginRight: 6 }} />
                心率 × 呼吸率联动趋势
              </span>
              <span className="hr-card-subtitle">双信号同源CSI提取</span>
            </div>
            <ReactECharts option={getRespirationChartOption()} style={{ height: 220 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card className="hr-card">
            <div className="hr-card-header">
              <span className="hr-card-title">
                <CalendarIcon size={16} style={{ color: '#e8a840', marginRight: 6 }} />
                历史心率
              </span>
              <span className="hr-card-subtitle">点击日期查看详情</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <Calendar
                onSelect={onDateSelect}
                fullscreen={false}
              />
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card className="hr-card">
            <div className="hr-card-header">
              <span className="hr-card-title">
                <CheckCircle size={16} style={{ color: '#2d8a56', marginRight: 6 }} />
                体动与心率异常事件
              </span>
              <Tag color="green" style={{ marginLeft: 12 }}>今晚平稳</Tag>
            </div>
            <div className="hr-alerts-list">
              {motionAlerts.map((alert, i) => (
                <div key={i} className="hr-alert-item">
                  <div className="hr-alert-left">
                    <div className="hr-alert-title">{alert.type}</div>
                    <div className="hr-alert-desc">{alert.desc}</div>
                  </div>
                  <Tag color={alert.level === 'normal' ? 'default' : alert.level === 'good' ? 'green' : 'blue'} className="hr-alert-tag">
                    {alert.count !== undefined ? `${alert.count} 次` : alert.value}
                  </Tag>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title={selectedDate}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        centered
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: '48px', fontWeight: 600, color: '#e07060' }}>
            {selectedHeartRate}
          </div>
          <div style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>
            平均心率 (bpm)
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: selectedHeartRate < 60 ? '#2d8a56' : selectedHeartRate < 65 ? '#e8a840' : '#e07060',
            marginTop: '16px',
            fontWeight: 500
          }}>
            {selectedHeartRate < 60 ? '心率偏低 · 睡眠质量良好' : selectedHeartRate < 65 ? '心率正常' : '心率偏高'}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default HeartRate
