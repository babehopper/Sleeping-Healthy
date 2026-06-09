import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Dimensions } from 'react-native';
import { Card, Text, Button, ActivityIndicator } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import { getEnvironmentData, getEnvironmentHistory, getSleepSuggestion } from '../api/environment';

const screenWidth = Dimensions.get('window').width;

const Environment = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [environmentData, setEnvironmentData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async (isInitial = false) => {
      try {
        const id = await AsyncStorage.getItem('userId');
        if (!id) { navigation.navigate('Login'); return; }
        setUserId(id);

        const [envData, history, suggestion] = await Promise.all([
          getEnvironmentData(id),
          getEnvironmentHistory(id, 7),
          getSleepSuggestion(id)
        ]);

        setEnvironmentData(envData.data);
        setHistoryData(history.data || []);
        // Only regenerate suggestions from rule-based if no AI cache exists
        if (isInitial) {
          setSuggestions(suggestion.data?.suggestions || generateSuggestions(envData.data));
        }
      } catch (error) {
        if (isInitial) Alert.alert('错误', error.message || '获取数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData(true);
    // Auto-refresh current data every 10s
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  // ---- AI suggestion ----
  const [aiLoading, setAiLoading] = useState(false);
  const requestAiSuggestion = async () => {
    setAiLoading(true);
    try {
      const axios = require('axios');
      const { API_BASE_URL } = require('../api/config');
      const id = await AsyncStorage.getItem('userId');
      const resp = await axios.post(`${API_BASE_URL}/user/${id}/generate-suggestions`, {
        type: 'environment',
        temperature: environmentData?.temperature,
        humidity: environmentData?.humidity,
      });
      if (resp.data?.success && resp.data?.suggestions?.length > 0) {
        setSuggestions(resp.data.suggestions);
      }
    } catch (e) {
      Alert.alert('提示', '智能建议生成失败，请稍后重试');
    } finally {
      setAiLoading(false);
    }
  };

  const generateSuggestions = (data) => {
    const suggestions = [];
    const temp = data?.temperature;
    const humidity = data?.humidity;
    if (temp && temp < 18) suggestions.push('当前温度偏低，建议适当保暖');
    else if (temp && temp > 28) suggestions.push('当前温度偏高，建议开启空调或通风');
    if (humidity && humidity < 40) suggestions.push('当前湿度偏低，建议使用加湿器');
    else if (humidity && humidity > 70) suggestions.push('当前湿度偏高，建议除湿');
    const motion = data?.motion_count || 0;
    if (motion > 5) suggestions.push('体动次数较多，建议检查睡眠环境');
    if (suggestions.length === 0) suggestions.push('当前睡眠环境良好');
    return suggestions;
  };

  const getComfortLevel = (score) => {
    if (!score) return { level: '未知', color: '#999' };
    if (score >= 80) return { level: '舒适', color: '#1a6340' };
    if (score >= 60) return { level: '一般', color: '#ffa500' };
    return { level: '较差', color: '#d32f2f' };
  };

  // Build chart data from history
  const hasHistoryData = historyData.some(d => d.avgTemperature != null);
  const chartLabels = historyData.map(d => {
    // date format: "06-04" → "6/4"
    const parts = (d.date || '').split('-');
    return parts.length >= 2 ? `${parseInt(parts[0])}/${parseInt(parts[1])}` : d.date || '';
  });
  const tempData = historyData.map(d => d.avgTemperature ?? 0);
  const humData = historyData.map(d => d.avgHumidity ?? 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a6340" />
      </View>
    );
  }

  const comfortInfo = getComfortLevel(environmentData?.comfort_score);

  return (
    <ScrollView style={styles.container}>
      {/* Current Environment Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>实时环境质量明细</Text>
          <View style={styles.envGrid}>
            <View style={styles.envCard}>
              <Text style={styles.envLabel}>温度</Text>
              <Text style={[styles.envValue, { color: '#e53935' }]}>
                {environmentData?.temperature != null ? `${environmentData.temperature}°C` : '--'}
              </Text>
            </View>
            <View style={styles.envCard}>
              <Text style={styles.envLabel}>湿度</Text>
              <Text style={[styles.envValue, { color: '#1e88e5' }]}>
                {environmentData?.humidity != null ? `${environmentData.humidity}%` : '--'}
              </Text>
            </View>
            <View style={styles.envCard}>
              <Text style={styles.envLabel}>舒适度</Text>
              <Text style={[styles.envValue, { color: comfortInfo.color }]}>
                {comfortInfo.level}
              </Text>
            </View>
            <View style={styles.envCard}>
              <Text style={styles.envLabel}>体动次数</Text>
              <Text style={styles.envValue}>{environmentData?.motion_count || 0}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Temperature Trend Chart */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>近7日温度趋势</Text>
          {hasHistoryData ? (
            <LineChart
              data={{
                labels: chartLabels,
                datasets: [{ data: tempData.length > 0 ? tempData : [0], color: (opacity = 1) => `rgba(229, 57, 53, ${opacity})`, strokeWidth: 2 }],
              }}
              width={screenWidth - 60}
              height={180}
              yAxisSuffix="°C"
              withInnerLines={false}
              withOuterLines={false}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalCount: 1,
                color: (opacity = 1) => `rgba(229, 57, 53, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
                propsForDots: { r: '4', strokeWidth: '1', stroke: '#e53935' },
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <Text style={styles.emptyText}>暂无温度数据</Text>
          )}
        </Card.Content>
      </Card>

      {/* Humidity Trend Chart */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>近7日湿度趋势</Text>
          {hasHistoryData ? (
            <LineChart
              data={{
                labels: chartLabels,
                datasets: [{ data: humData.length > 0 ? humData : [0], color: (opacity = 1) => `rgba(30, 136, 229, ${opacity})`, strokeWidth: 2 }],
              }}
              width={screenWidth - 60}
              height={180}
              yAxisSuffix="%"
              withInnerLines={false}
              withOuterLines={false}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalCount: 1,
                color: (opacity = 1) => `rgba(30, 136, 229, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
                propsForDots: { r: '4', strokeWidth: '1', stroke: '#1e88e5' },
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <Text style={styles.emptyText}>暂无湿度数据</Text>
          )}
        </Card.Content>
      </Card>

      {/* Suggestions */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>环境优化建议</Text>
          <View style={styles.suggestionsList}>
            {suggestions.map((s, i) => (
              <View key={i} style={styles.suggestionItem}>
                <Text style={styles.suggestionText}>{typeof s === 'string' ? s : (s.desc || s.title || '')}</Text>
              </View>
            ))}
          </View>
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  envGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  envCard: {
    width: '47%', backgroundColor: '#fff', padding: 15, borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  envLabel: { fontSize: 14, color: '#666', marginBottom: 8 },
  envValue: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  chart: { marginVertical: 8, borderRadius: 8 },
  emptyText: { color: '#999', textAlign: 'center', paddingVertical: 20 },
  suggestionsList: { marginTop: 10 },
  suggestionItem: { padding: 12, backgroundColor: '#f0f8f4', borderRadius: 8, marginBottom: 10 },
  suggestionText: { fontSize: 14, color: '#333', lineHeight: 20 },
  aiButton: { marginTop: 10, borderColor: '#1a6340' },
});

export default Environment;
