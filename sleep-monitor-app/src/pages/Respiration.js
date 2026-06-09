import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Dimensions } from 'react-native';
import { Card, Text, Button, ActivityIndicator } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRealTimeRespiration, getRespirationRecords } from '../api/respiration';

const screenWidth = Dimensions.get('window').width;

const Respiration = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [records, setRecords] = useState([]);
  const [latestValue, setLatestValue] = useState('--');
  const [dataPoints, setDataPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [deviceOnline, setDeviceOnline] = useState(false);
  const [sessionAvg, setSessionAvg] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const fetchUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      if (!id) { navigation.navigate('Login'); return; }
      setUserId(id);
    };
    fetchUserId();
    // Auto-start monitoring
    setIsMonitoring(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fetchRecords = async () => {
      try {
        const result = await getRespirationRecords(userId);
        setRecords(result.data || []);
      } catch (error) {
        console.error('获取记录失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [userId]);

  // Poll for real-time data
  useEffect(() => {
    let interval = null;
    const poll = async () => {
      try {
        const result = await getRealTimeRespiration(userId);
        if (result?.data) {
          const rate = result.data.value || result.data.avgBpm;
          const ts = result.data.timestamp;
          if (rate && typeof rate === 'number') {
            setLatestValue(rate);
            setLastUpdateTime(ts);
            setSessionAvg(result.data.avgBpm || rate);
            setDataPoints(prev => {
              const next = [...prev, rate];
              return next.length > 60 ? next.slice(-60) : next;
            });
            // Device is online if last data < 5 min ago
            if (ts) {
              const age = (Date.now() - new Date(ts).getTime()) / 1000;
              setDeviceOnline(age < 300);
            }
          }
        }
      } catch (_) {}
    };
    if (isMonitoring && userId) {
      poll(); // immediate first call
      interval = setInterval(poll, 3000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isMonitoring, userId]);

  // AI suggestion
  const requestAiSuggestion = async () => {
    setAiLoading(true);
    try {
      const axios = require('axios');
      const { API_BASE_URL } = require('../api/config');
      const resp = await axios.post(`${API_BASE_URL}/user/${userId}/generate-suggestions`, {
        type: 'sleep',
      });
      if (resp.data?.success && resp.data?.suggestions?.length > 0) {
        setAiSuggestions(resp.data.suggestions);
      }
    } catch (_) {} finally { setAiLoading(false); }
  };

  const getTimeAgo = (isoStr) => {
    if (!isoStr) return '';
    const sec = Math.round((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (sec < 60) return `${sec}秒前`;
    if (sec < 3600) return `${Math.floor(sec / 60)}分钟前`;
    return `${Math.floor(sec / 3600)}小时前`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a6340" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Real-time Card */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>实时呼吸率</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: deviceOnline ? '#45a86f' : '#e07060' }]} />
              <Text style={[styles.statusText, { color: deviceOnline ? '#45a86f' : '#e07060' }]}>
                {deviceOnline ? '设备在线' : '设备离线'}
              </Text>
            </View>
          </View>
          <View style={styles.valueContainer}>
            <Text style={styles.latestValue}>{latestValue}</Text>
            <Text style={styles.valueUnit}>次/分钟</Text>
          </View>
          {sessionAvg != null && (
            <Text style={styles.sessionHint}>会话平均: {sessionAvg} 次/分</Text>
          )}
          {lastUpdateTime && (
            <Text style={styles.updateHint}>更新于 {getTimeAgo(lastUpdateTime)}</Text>
          )}
          {dataPoints.length > 1 ? (
            <LineChart
              data={{
                labels: dataPoints.map((_, i) => (i % 10 === 0 ? `${i}` : '')),
                datasets: [{ data: dataPoints, color: (opacity = 1) => `rgba(26, 99, 64, ${opacity})`, strokeWidth: 2 }],
              }}
              width={screenWidth - 70}
              height={160}
              yAxisSuffix=""
              withInnerLines={false}
              withOuterLines={false}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalCount: 1,
                color: (opacity = 1) => `rgba(26, 99, 64, ${opacity})`,
                labelColor: () => '#999',
                propsForDots: { r: '1', strokeWidth: '0' },
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <View style={styles.waveformPlaceholder}>
              <Text style={styles.placeholderText}>
                {deviceOnline ? '正在采集数据...' : '请启动ESP32设备开始采集'}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* AI Suggestions */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>智能建议</Text>
          {aiSuggestions.length > 0 && (
            <View style={{ marginBottom: 10, gap: 6 }}>
              {aiSuggestions.map((s, i) => (
                <View key={i} style={styles.aiItem}>
                  <Text style={styles.aiText}>{s}</Text>
                </View>
              ))}
            </View>
          )}
          <Button
            mode="outlined"
            onPress={requestAiSuggestion}
            loading={aiLoading}
            disabled={aiLoading}
            style={styles.aiButton}
            labelStyle={{ color: '#1a6340' }}
          >
            {aiLoading ? '分析中...' : '🤖 生成智能建议'}
          </Button>
        </Card.Content>
      </Card>

      {/* History Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>历史记录</Text>
          {records.length === 0 ? (
            <Text style={styles.emptyText}>暂无记录</Text>
          ) : (
            <View style={styles.recordsList}>
              {records.slice(0, 10).map((record, index) => (
                <View key={index} style={styles.recordItem}>
                  <Text style={styles.recordValue}>{record.respirationRate || record.respiration_rate} 次/分</Text>
                  <Text style={styles.recordTime}>
                    {record.timestamp ? record.timestamp.slice(0, 19).replace('T', ' ') : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: 15 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '500' },
  valueContainer: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 4 },
  latestValue: { fontSize: 56, fontWeight: 'bold', color: '#1a6340' },
  valueUnit: { fontSize: 18, color: '#666' },
  sessionHint: { fontSize: 13, color: '#888', marginBottom: 2 },
  updateHint: { fontSize: 12, color: '#bbb', marginBottom: 8 },
  chart: { marginVertical: 8, borderRadius: 8 },
  waveformPlaceholder: {
    height: 160, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#ccc', borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  placeholderText: { color: '#999', fontSize: 14 },
  aiButton: { marginTop: 6, borderColor: '#1a6340' },
  aiItem: { padding: 10, backgroundColor: '#f0f8f4', borderRadius: 8 },
  aiText: { fontSize: 13, color: '#333' },
  emptyText: { color: '#999', textAlign: 'center', paddingVertical: 20 },
  recordsList: { marginTop: 10 },
  recordItem: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  recordValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  recordTime: { fontSize: 13, color: '#999' },
});

export default Respiration;
