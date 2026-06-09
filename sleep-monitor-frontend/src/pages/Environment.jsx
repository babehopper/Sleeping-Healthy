import { useState, useEffect } from 'react'
import { Row, Col, Card, Tag, Spin, Button } from 'antd'
import { Thermometer, Droplets, Award, Info, Activity, RefreshCw } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { getCurrentEnvironment, getEnvironmentTrend, getAISuggestion } from '../api/environment'
import './Environment.css'

const Environment = () => {
  const [envData, setEnvData] = useState(null)
  const [trendData, setTrendData] = useState({ times: [], temperatures: [], humidities: [] })
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)

  const userId = localStorage.getItem('userId')

  useEffect(() => {
    if (!userId) return
    fetchEnvData()
    const t = setInterval(fetchEnvData, 60000)
    return () => clearInterval(t)
  }, [userId])

  const fetchEnvData = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [current, trend] = await Promise.all([
        getCurrentEnvironment(userId),
        getEnvironmentTrend(userId, today),
      ])
      if (current.success && current.data) setEnvData(current.data)
      if (trend.success && trend.data) setTrendData(trend.data)
    } catch (e) {
      console.error('获取环境数据失败:', e)
    }
  }

  const handleAnalyze = async () => {
    if (!envData) return
    
    setAiLoading(true)
    try {
      const tempScore = envData.temperature >= 18 && envData.temperature <= 24 ? 100 : Math.max(0, 100 - Math.abs(envData.temperature - 21) * 10)
      const humScore = envData.humidity >= 40 && envData.humidity <= 60 ? 100 : Math.max(0, 100 - Math.abs(envData.humidity - 50) * 2)
      const comfortScore = Math.round((tempScore + humScore) / 2)
      
      const result = await getAISuggestion({
        temperature: envData.temperature,
        humidity: envData.humidity,
        motion_count: envData.motion_count || 0,
        comfort_score: comfortScore
      })
      
      if (result.success && result.suggestions) {
        setAiSuggestions(result.suggestions)
      }
    } catch (e) {
      console.error('获取AI建议失败:', e)
    } finally {
      setAiLoading(false)
    }
  }

  const currentTemp = envData?.temperature ?? 22.4
  const currentHumidity = envData?.humidity ?? 58
  const motionCount = envData?.motion_count ?? 0
  // Comfort score: ideal is 18-24°C and 40-60%
  const tempScore = currentTemp >= 18 && currentTemp <= 24 ? 100 : Math.max(0, 100 - Math.abs(currentTemp - 21) * 10)
  const humScore = currentHumidity >= 40 && currentHumidity <= 60 ? 100 : Math.max(0, 100 - Math.abs(currentHumidity - 50) * 2)
  const comfortScore = Math.round((tempScore + humScore) / 2)

  const generateSuggestions = () => {
    const suggestions = []
    
    if (currentTemp < 18) {
      suggestions.push({
        title: '温度偏低',
        value: '建议升温',
        desc: `当前室温${currentTemp.toFixed(1)}°C，低于理想睡眠温度范围(18-24°C)，建议适当提高室温`,
        color: '#e07060'
      })
    } else if (currentTemp > 24) {
      suggestions.push({
        title: '温度偏高',
        value: '建议降温',
        desc: `当前室温${currentTemp.toFixed(1)}°C，高于理想睡眠温度范围(18-24°C)，建议开启空调或风扇`,
        color: '#e07060'
      })
    } else {
      suggestions.push({
        title: '温度适宜',
        value: '最佳',
        desc: `当前室温${currentTemp.toFixed(1)}°C，处于理想睡眠温度范围(18-24°C)内`,
        color: '#2d8a56'
      })
    }

    if (currentHumidity < 40) {
      suggestions.push({
        title: '湿度偏低',
        value: '建议加湿',
        desc: `当前湿度${currentHumidity.toFixed(1)}%，低于理想范围(40-60%)，建议使用加湿器`,
        color: '#e8a840'
      })
    } else if (currentHumidity > 60) {
      suggestions.push({
        title: '湿度偏高',
        value: '建议除湿',
        desc: `当前湿度${currentHumidity.toFixed(1)}%，高于理想范围(40-60%)，建议开启除湿功能`,
        color: '#e8a840'
      })
    } else {
      suggestions.push({
        title: '湿度适宜',
        value: '最佳',
        desc: `当前湿度${currentHumidity.toFixed(1)}%，处于理想睡眠湿度范围(40-60%)内`,
        color: '#2d8a56'
      })
    }

    if (motionCount > 15) {
      suggestions.push({
        title: '体动频繁',
        value: '注意',
        desc: `当前检测到${motionCount}次体动，建议检查睡眠姿势或调整床垫舒适度`,
        color: '#e07060'
      })
    } else if (motionCount > 5) {
      suggestions.push({
        title: '体动正常',
        value: '良好',
        desc: `当前检测到${motionCount}次体动，属于正常范围`,
        color: '#2d8a56'
      })
    }

    if (comfortScore >= 80) {
      suggestions.push({
        title: '睡眠环境优秀',
        value: '推荐',
        desc: `舒适指数${comfortScore}分，当前环境非常适合睡眠`,
        color: '#2d8a56'
      })
    } else if (comfortScore >= 60) {
      suggestions.push({
        title: '睡眠环境一般',
        value: '需改善',
        desc: `舒适指数${comfortScore}分，建议优化环境条件以提升睡眠质量`,
        color: '#e8a840'
      })
    } else {
      suggestions.push({
        title: '睡眠环境较差',
        value: '急需改善',
        desc: `舒适指数${comfortScore}分，环境条件不利于睡眠，建议立即调整`,
        color: '#e07060'
      })
    }

    return suggestions
  }

  const getTempGaugeOption = () => {
    return {
      series: [{
        type: 'gauge',
        startAngle: 225,
        endAngle: -45,
        min: 10,
        max: 35,
        splitNumber: 5,
        radius: '90%',
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.35, '#2d8a56'],
              [0.65, '#e8a840'],
              [1, '#e07060']
            ]
          }
        },
        pointer: {
          itemStyle: { color: '#e07060' },
          length: '55%',
          width: 4,
          itemStyle: {
            color: '#e07060',
            shadowColor: 'rgba(224, 112, 96, 0.5)',
            shadowBlur: 4
          }
        },
        axisTick: { show: false },
        splitLine: {
          length: 8,
          lineStyle: {
            color: '#ddd',
            width: 1
          }
        },
        axisLabel: {
          color: '#666',
          distance: 18,
          fontSize: 10,
          fontWeight: 500
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}°C',
          color: '#333',
          fontSize: 22,
          fontWeight: 'bold',
          offsetCenter: [0, '35%']
        },
        title: {
          offsetCenter: [0, '65%'],
          color: '#888',
          fontSize: 12
        },
        data: [{ value: currentTemp, name: '最适范围 16-24°C' }]
      }]
    }
  }

  const getHumidityGaugeOption = () => {
    return {
      series: [{
        type: 'gauge',
        startAngle: 225,
        endAngle: -45,
        min: 20,
        max: 80,
        splitNumber: 6,
        radius: '90%',
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.33, '#e07060'],
              [0.55, '#2d8a56'],
              [0.75, '#e8a840'],
              [1, '#e07060']
            ]
          }
        },
        pointer: {
          length: '55%',
          width: 4,
          itemStyle: {
            color: '#2d8a56',
            shadowColor: 'rgba(45, 138, 86, 0.5)',
            shadowBlur: 4
          }
        },
        axisTick: { show: false },
        splitLine: {
          length: 8,
          lineStyle: {
            color: '#ddd',
            width: 1
          }
        },
        axisLabel: {
          color: '#666',
          distance: 18,
          fontSize: 10,
          fontWeight: 500
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          color: '#333',
          fontSize: 22,
          fontWeight: 'bold',
          offsetCenter: [0, '35%']
        },
        title: {
          offsetCenter: [0, '65%'],
          color: '#888',
          fontSize: 12
        },
        data: [{ value: currentHumidity, name: '最适范围 40-60%' }]
      }]
    }
  }

  const getComfortGaugeOption = () => {
    return {
      series: [{
        type: 'gauge',
        startAngle: 225,
        endAngle: -45,
        min: 0,
        max: 100,
        splitNumber: 5,
        radius: '90%',
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.45, '#e07060'],
              [0.75, '#e8a840'],
              [1, '#2d8a56']
            ]
          }
        },
        pointer: {
          length: '55%',
          width: 4,
          itemStyle: {
            color: '#2d8a56',
            shadowColor: 'rgba(45, 138, 86, 0.5)',
            shadowBlur: 4
          }
        },
        axisTick: { show: false },
        splitLine: {
          length: 8,
          lineStyle: {
            color: '#ddd',
            width: 1
          }
        },
        axisLabel: {
          color: '#666',
          distance: 18,
          fontSize: 10,
          fontWeight: 500
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: '#333',
          fontSize: 22,
          fontWeight: 'bold',
          offsetCenter: [0, '35%']
        },
        title: {
          offsetCenter: [0, '65%'],
          color: '#888',
          fontSize: 12
        },
        data: [{ value: comfortScore, name: '温湿度综合评分' }]
      }]
    }
  }

  const getTempHumidityTrendOption = () => {
    // Backend returns 24 hourly points (00:00 – 23:00), null for missing hours
    const times = trendData.times?.length > 0 ? trendData.times : Array.from({length: 24}, (_, i) => `${String(i).padStart(2,'0')}:00`)
    const temps = trendData.temperatures?.length > 0 ? trendData.temperatures.map(v => v ?? 0) : Array(24).fill(0)
    const hums = trendData.humidities?.length > 0 ? trendData.humidities.map(v => v ?? 0) : Array(24).fill(0)

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#e0e0e0',
        textStyle: { color: '#333' },
        padding: [8, 12],
        borderRadius: 6,
        formatter: (params) => {
          const h = params[0].axisValue
          const t = `${params[0].value}°C`
          const hVal = `${params[1]?.value ?? 0}%`
          return `${h}<br/>🌡 室温: ${t}<br/>💧 湿度: ${hVal}`
        }
      },
      legend: {
        data: ['室温 °C', '湿度 %RH'],
        bottom: 0,
        textStyle: { color: '#666', fontSize: 12 },
        itemGap: 30,
      },
      grid: { left: 55, right: 55, top: 30, bottom: 45 },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: { color: '#888', fontSize: 10, interval: 3 },
        axisLine: { lineStyle: { color: '#ddd' } },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value', min: 10, max: 35,
          name: '室温 °C',
          nameTextStyle: { color: '#e07060', fontSize: 11 },
          axisLabel: { color: '#888', fontSize: 10 },
          splitLine: { lineStyle: { color: '#f5f5f5', type: 'dashed' } },
          axisLine: { show: false }, axisTick: { show: false },
        },
        {
          type: 'value', min: 20, max: 90,
          name: '湿度 %RH',
          nameTextStyle: { color: '#2d8a56', fontSize: 11 },
          axisLabel: { color: '#888', fontSize: 10 },
          splitLine: { show: false },
          axisLine: { show: false }, axisTick: { show: false },
        }
      ],
      series: [
        {
          name: '室温 °C', type: 'line', data: temps,
          smooth: true, symbol: 'circle', symbolSize: 4,
          lineStyle: { color: '#e07060', width: 2.5 },
          itemStyle: { color: '#e07060' },
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(224,112,96,0.3)' }, { offset: 1, color: 'rgba(224,112,96,0.02)' }] }
          },
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(45,138,86,0.08)', borderColor: '#2d8a56', borderWidth: 1, borderType: 'dashed' },
            data: [[{ xAxis: '00:00', yAxis: 18 }, { xAxis: '23:00', yAxis: 24 }]]
          },
        },
        {
          name: '湿度 %RH', type: 'line', yAxisIndex: 1, data: hums,
          smooth: true, symbol: 'circle', symbolSize: 4,
          lineStyle: { color: '#2d8a56', type: 'dashed', width: 2.5 },
          itemStyle: { color: '#2d8a56' },
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(45,138,86,0.25)' }, { offset: 1, color: 'rgba(45,138,86,0.02)' }] }
          },
        }
      ],
    }
  }

  const getQualityBubbleOption = () => {
    const data = []
    if (trendData && trendData.temperatures && trendData.humidities) {
      trendData.temperatures.forEach((temp, index) => {
        if (temp !== null && temp !== undefined && !isNaN(temp)) {
          const humidity = trendData.humidities[index]
          if (humidity !== null && humidity !== undefined && !isNaN(humidity)) {
            const tempScore = temp >= 18 && temp <= 24 ? 100 : Math.max(0, 100 - Math.abs(temp - 21) * 10)
            const humScore = humidity >= 40 && humidity <= 60 ? 100 : Math.max(0, 100 - Math.abs(humidity - 50) * 2)
            const score = Math.round((tempScore + humScore) / 2)
            let color
            if (score >= 88) color = '#2d8a56'
            else if (score >= 75) color = '#45a86f'
            else if (score >= 60) color = '#e8a840'
            else color = '#e07060'
            data.push({
              name: trendData.times?.[index] || `${String(index).padStart(2, '0')}:00`,
              value: [temp, humidity, score],
              itemStyle: { color: color }
            })
          }
        }
      })
    }
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#e0e0e0',
        textStyle: { color: '#333' },
        padding: [10, 14],
        borderRadius: 8,
        formatter: (params) => `${params.name}<br/>室温: ${params.value[0].toFixed(1)}°C<br/>湿度: ${params.value[1].toFixed(1)}%<br/>综合评分: ${params.value[2].toFixed(0)}`
      },
      grid: { left: 60, right: 30, top: 30, bottom: 50 },
      xAxis: {
        type: 'value',
        min: 12,
        max: 34,
        name: '室温°C',
        nameTextStyle: { color: '#888' },
        axisLabel: { color: '#888', fontSize: 11 },
        axisLine: { lineStyle: { color: '#ddd' } },
        axisTick: { lineStyle: { color: '#ddd' } },
        splitLine: { lineStyle: { color: '#f8f8f8', type: 'dashed' } }
      },
      yAxis: {
        type: 'value',
        min: 28,
        max: 82,
        name: '湿度 %RH',
        nameTextStyle: { color: '#888' },
        axisLabel: { color: '#888', fontSize: 11 },
        axisLine: { lineStyle: { color: '#ddd' } },
        axisTick: { lineStyle: { color: '#ddd' } },
        splitLine: { lineStyle: { color: '#f8f8f8', type: 'dashed' } }
      },
      series: [{
        type: 'scatter',
        data: data,
        symbolSize: (data) => Math.sqrt(data[2]) * 2.5,
        itemStyle: { opacity: 0.7 },
        emphasis: {
          itemStyle: {
            opacity: 1,
            shadowBlur: 12,
            shadowColor: 'rgba(0,0,0,0.25)'
          }
        }
      }],
      markArea: {
        silent: true,
        itemStyle: { color: 'rgba(232,168,64,0.2)', borderColor: '#e8a840', borderType: 'dashed' },
        data: [[{ xAxis: 18, yAxis: 40 }, { xAxis: 26, yAxis: 60 }]]
      }
    }
  }

  return (
    <div className="environment-page">
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card className="env-card">
            <div className="env-split-layout">
              <div className="env-split-left">
                <div className="env-card-header">
                  <span className="env-card-title">当前睡眠环境</span>
                  <Tag color={comfortScore >= 80 ? 'green' : comfortScore >= 60 ? 'orange' : 'red'}>
                    {comfortScore >= 80 ? '舒适' : comfortScore >= 60 ? '一般' : '较差'}
                  </Tag>
                </div>
                <div className="env-current-row">
                  {[
                    { icon: <Award size={22} />, val: comfortScore, unit: '', label: '舒适指数', color: '#e8a840', range: comfortScore >= 80 ? '优秀' : comfortScore >= 60 ? '一般' : '较差' },
                    { icon: <Activity size={22} />, val: motionCount, unit: '次', label: '体动次数', color: '#5c6bc0', range: motionCount <= 5 ? '安静' : motionCount <= 15 ? '正常' : '频繁' },
                  ].map((item, i) => (
                    <div key={i} className="env-metric-ring">
                      <div className="env-ring" style={{
                        background: `conic-gradient(${item.color} 0% ${item.val * (item.unit === '°C' ? 4 : item.unit === '%' ? 1.4 : 1)}%, #f0f0f0 ${item.val * (item.unit === '°C' ? 4 : item.unit === '%' ? 1.4 : 1)}% 100%)`
                      }}>
                        <div className="env-ring-inner">
                          <span className="env-ring-val">{item.val}{item.unit}</span>
                          <span className="env-ring-range">{item.range}</span>
                        </div>
                      </div>
                      <div className="env-ring-icon" style={{ color: item.color }}>{item.icon}</div>
                      <span className="env-ring-label">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="env-split-divider"></div>
              <div className="env-split-right">
                <div className="env-card-header">
                  <span className="env-card-title">环境优化建议</span>
                  <Button
                    type="primary"
                    icon={<RefreshCw size={14} />}
                    onClick={handleAnalyze}
                    loading={aiLoading}
                    style={{ padding: '4px 16px', fontSize: '12px', marginLeft: '12px' }}
                  >
                    智能分析
                  </Button>
                </div>
                <div className="env-suggestions">
                  {aiLoading ? (
                    <div className="suggestion-loading">
                      <Spin size="small" />
                    </div>
                  ) : aiSuggestions.length > 0 ? (
                    aiSuggestions.slice(0, 3).map((item, i) => {
                      const levelColors = {
                        '最佳': '#2d8a56',
                        '良好': '#45a86f',
                        '注意': '#e8a840',
                        '需改善': '#e07060',
                        '急需改善': '#c05656'
                      }
                      const tagColors = {
                        '最佳': 'green',
                        '良好': 'green',
                        '注意': 'orange',
                        '需改善': 'red',
                        '急需改善': 'red'
                      }
                      return (
                        <div key={i} className="suggestion-item">
                          <div className="suggestion-left">
                            <Info size={14} style={{ color: levelColors[item.level] || '#666' }} />
                            <div className="suggestion-content">
                              <div className="suggestion-title">{item.title}</div>
                              <div className="suggestion-desc">{item.desc}</div>
                            </div>
                          </div>
                          <Tag color={tagColors[item.level] || 'default'}>
                            {item.level}
                          </Tag>
                        </div>
                      )
                    })
                  ) : (
                    generateSuggestions().slice(0, 3).map((item, i) => (
                      <div key={i} className="suggestion-item">
                        <div className="suggestion-left">
                          <Info size={14} style={{ color: item.color || '#666' }} />
                          <div className="suggestion-content">
                            <div className="suggestion-title">{item.title}</div>
                            <div className="suggestion-desc">{item.desc}</div>
                          </div>
                        </div>
                        <Tag color={item.color ? (item.color === '#2d8a56' ? 'green' : item.color === '#e8a840' ? 'orange' : 'red') : 'default'}>
                          {item.value}
                        </Tag>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card className="env-card">
            <div className="env-card-header">
              <span className="env-card-title">整晚温湿度变化</span>
            </div>
            <ReactECharts option={getTempHumidityTrendOption()} style={{ height: 260 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card className="env-card">
            <div className="env-card-header">
              <span className="env-card-title">实时环境质量明细</span>
              <span className="env-card-subtitle">横轴温度·纵轴湿度·圆圈大小=综合评分</span>
            </div>
            <ReactECharts option={getQualityBubbleOption()} style={{ height: 320 }} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px', fontSize: '12px', color: '#888' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 10, height: 10, background: '#2d8a56', borderRadius: '50%' }}></div>
                <span>综合优秀 (≥88)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 10, height: 10, background: '#45a86f', borderRadius: '50%' }}></div>
                <span>良好 (75-87)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 10, height: 10, background: '#e8a840', borderRadius: '50%' }}></div>
                <span>一般 (60-74)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 10, height: 10, background: '#e07060', borderRadius: '50%' }}></div>
                <span>较差 (&lt;60)</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#aaa', marginTop: '8px' }}>
              气泡越大综合分越高
            </div>
          </Card>
        </Col>
      </Row>

    </div>
  )
}

export default Environment
