import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Dimensions, TouchableOpacity } from 'react-native';
import { Card, Text, ActivityIndicator } from 'react-native-paper';
import { BarChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSleepRecords } from '../api/sleepRecords';

const screenWidth = Dimensions.get('window').width;
const TABS = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
];
const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const SleepRecords = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('day');

  useEffect(() => {
    const init = async () => {
      const id = await AsyncStorage.getItem('userId');
      if (!id) { navigation.navigate('Login'); return; }
      setUserId(id);
      try {
        const result = await getSleepRecords(id);
        setRecords(result.records || result.data || []);
      } catch (e) {
        console.error('获取失败:', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ---- Filter records by tab ----
  const getFiltered = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (activeTab === 'day') {
      return records.filter(r => {
        const d = new Date(r.date);
        return d >= today;
      });
    }
    if (activeTab === 'week') {
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + mondayOffset);
      return records.filter(r => {
        const d = new Date(r.date);
        return d >= weekStart;
      });
    }
  }, [records, activeTab]);

  const filtered = getFiltered();

  // ---- Helpers ----
  const fmtTime = (str) => {
    if (!str) return '--:--';
    // Handle "HH:MM" or "2024-06-04THH:MM:SS" format
    if (str.includes('T')) return str.split('T')[1].slice(0, 5);
    if (str.includes(':')) return str.slice(0, 5);
    return str;
  };
  const fmtDuration = (h) => {
    if (h == null) return '--';
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${hours}小时${mins}分`;
  };

  // ---- Day View ----
  const renderDayView = () => {
    const latest = filtered.length > 0 ? filtered[0] : null;
    if (!latest) {
      return (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.emptyText}>暂无今日睡眠记录</Text>
            <Text style={styles.emptyHint}>前一晚佩戴设备入睡即可自动记录</Text>
          </Card.Content>
        </Card>
      );
    }

    const deep = latest.deepSleep || 0;
    const light = latest.lightSleep || 0;
    const rem = latest.remSleep || 0;
    const dur = latest.duration || (deep + light + rem);
    const awake = Math.max(0, dur - deep - light - rem);
    const total = dur || 1;
    const score = latest.score || latest.efficiency || 0;

    return (
      <View>
        {/* Score Card */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>睡眠评分</Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreValue}>{score}</Text>
                <Text style={styles.scoreUnit}>分</Text>
              </View>
              <View style={styles.scoreDetails}>
                <View style={styles.scoreDetailItem}>
                  <Text style={styles.sdLabel}>入睡</Text>
                  <Text style={styles.sdValue}>{fmtTime(latest.startTime)}</Text>
                </View>
                <View style={styles.scoreDetailItem}>
                  <Text style={styles.sdLabel}>醒来</Text>
                  <Text style={styles.sdValue}>{fmtTime(latest.endTime)}</Text>
                </View>
                <View style={styles.scoreDetailItem}>
                  <Text style={styles.sdLabel}>时长</Text>
                  <Text style={styles.sdValue}>{fmtDuration(dur)}</Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Sleep Stages */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>睡眠结构</Text>
            <View style={styles.stageBar}>
              {deep > 0 && <View style={[styles.stageSeg, { flex: deep / total * 100, backgroundColor: '#1a6340' }]} />}
              {light > 0 && <View style={[styles.stageSeg, { flex: light / total * 100, backgroundColor: '#45a86f' }]} />}
              {rem > 0 && <View style={[styles.stageSeg, { flex: rem / total * 100, backgroundColor: '#7cc99a' }]} />}
              {awake > 0 && <View style={[styles.stageSeg, { flex: awake / total * 100, backgroundColor: '#e07060' }]} />}
            </View>
            <View style={styles.stageLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#1a6340' }]} />
                <Text style={styles.legendText}>深睡 {deep.toFixed(1)}h</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#45a86f' }]} />
                <Text style={styles.legendText}>浅睡 {light.toFixed(1)}h</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#7cc99a' }]} />
                <Text style={styles.legendText}>REM {rem.toFixed(1)}h</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#e07060' }]} />
                <Text style={styles.legendText}>清醒 {awake.toFixed(1)}h</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Efficiency */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>睡眠效率</Text>
            <View style={styles.efficiencyRow}>
              <Text style={styles.effValue}>{latest.efficiency || score}%</Text>
              <Text style={styles.effHint}>卧床时间内实际睡眠占比</Text>
            </View>
          </Card.Content>
        </Card>
      </View>
    );
  };

  // ---- Week View ----
  const renderWeekView = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);

    const dailyDurations = Array.from({ length: 7 }, (_, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dayStr = dayDate.toISOString().slice(0, 10);
      const rec = records.find(r => {
        const rd = (r.date || '').slice(0, 10);
        return rd === dayStr;
      });
      return rec?.duration || 0;
    });

    const totalDur = dailyDurations.reduce((s, v) => s + v, 0);
    const avgDur = dailyDurations.filter(v => v > 0).length > 0
      ? totalDur / dailyDurations.filter(v => v > 0).length : 0;

    return (
      <View>
        {/* Weekly Summary */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.weekSummaryRow}>
              <View style={styles.weekSummaryItem}>
                <Text style={styles.weekSummaryValue}>{dailyDurations.filter(v => v > 0).length}</Text>
                <Text style={styles.weekSummaryLabel}>记录天数</Text>
              </View>
              <View style={styles.weekSummaryItem}>
                <Text style={styles.weekSummaryValue}>{avgDur.toFixed(1)}h</Text>
                <Text style={styles.weekSummaryLabel}>日均时长</Text>
              </View>
              <View style={styles.weekSummaryItem}>
                <Text style={styles.weekSummaryValue}>{totalDur.toFixed(1)}h</Text>
                <Text style={styles.weekSummaryLabel}>总时长</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Weekly Bar Chart */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>每日睡眠时长</Text>
            <BarChart
              data={{
                labels: WEEKDAY_NAMES,
                datasets: [{ data: dailyDurations }],
              }}
              width={screenWidth - 60}
              height={200}
              yAxisSuffix="h"
              yAxisLabel=""
              fromZero
              withInnerLines={false}
              showValuesOnTopOfBars
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalCount: 1,
                color: (opacity = 1) => `rgba(26, 99, 64, ${opacity})`,
                labelColor: () => '#999',
                barPercentage: 0.6,
                propsForLabels: { fontSize: 11 },
              }}
              style={styles.chart}
            />
          </Card.Content>
        </Card>
      </View>
    );
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
      {/* Tab Row */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'day' && renderDayView()}
      {activeTab === 'week' && renderWeekView()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Tabs
  tabRow: { flexDirection: 'row', backgroundColor: '#e8e8e8', borderRadius: 10, padding: 3, marginBottom: 15 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },
  tabLabel: { fontSize: 16, color: '#888', fontWeight: '500' },
  tabLabelActive: { color: '#1a6340', fontWeight: 'bold' },
  // Card
  card: { marginBottom: 15 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  emptyText: { color: '#999', textAlign: 'center', fontSize: 16, paddingVertical: 20 },
  emptyHint: { color: '#bbb', textAlign: 'center', fontSize: 13 },
  // Day — Score
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  scoreCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#1a6340',
    justifyContent: 'center', alignItems: 'center',
  },
  scoreValue: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  scoreUnit: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  scoreDetails: { flex: 1, gap: 8 },
  scoreDetailItem: { flexDirection: 'row', justifyContent: 'space-between' },
  sdLabel: { fontSize: 14, color: '#999' },
  sdValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  // Day — Stages
  stageBar: { flexDirection: 'row', height: 24, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  stageSeg: { minWidth: 2 },
  stageLegend: { gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: '#666' },
  // Efficiency
  efficiencyRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  effValue: { fontSize: 36, fontWeight: 'bold', color: '#1a6340' },
  effHint: { fontSize: 13, color: '#999' },
  // Week
  weekSummaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weekSummaryItem: { alignItems: 'center' },
  weekSummaryValue: { fontSize: 24, fontWeight: 'bold', color: '#1a6340' },
  weekSummaryLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  chart: { marginVertical: 8, borderRadius: 8 },
});

export default SleepRecords;
