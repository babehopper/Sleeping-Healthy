import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Card, Text, ActivityIndicator, Avatar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDashboardData } from '../api/dashboard';
import { getEnvironmentData } from '../api/environment';

const Dashboard = ({ navigation }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [envData, setEnvData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const id = await AsyncStorage.getItem('userId');
      if (!id) { navigation.navigate('Login'); return; }
      const uname = await AsyncStorage.getItem('username');
      setUserInfo({ username: uname || '用户' });
      try {
        const [dash, env] = await Promise.all([
          getDashboardData(id),
          getEnvironmentData(id),
        ]);
        setDashboardData(dash.data || dash);
        setEnvData(env.data);
      } catch (e) {
        console.error('Fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return '早上好';
    if (h < 18) return '下午好';
    return '晚上好';
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <View style={styles.userRow}>
          <Avatar.Text size={44} label={userInfo?.username?.charAt(0) || '?'} color="#fff" style={{ backgroundColor: '#1a6340' }} />
          <Text style={styles.username}>{userInfo?.username || '用户'}</Text>
        </View>
      </View>

      {/* Respiration Card */}
      <Card style={styles.card}>
        <Card.Content>
          <TouchableOpacity onPress={() => navigation.navigate('Respiration')}>
            <Text style={styles.cardTitle}>呼吸率</Text>
            <View style={styles.bigValueRow}>
              <Text style={styles.bigValue}>
                {dashboardData?.avgRespiration || dashboardData?.latest_respiration_rate || '--'}
              </Text>
              <Text style={styles.bigUnit}>次/分</Text>
            </View>
            <Text style={styles.cardHint}>最新会话平均值</Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>

      {/* Environment Card */}
      <Card style={styles.card}>
        <Card.Content>
          <TouchableOpacity onPress={() => navigation.navigate('Environment')}>
            <Text style={styles.cardTitle}>睡眠环境</Text>
            <View style={styles.envRow}>
              <View style={styles.envItem}>
                <Text style={styles.envValue}>
                  {envData?.temperature != null ? `${envData.temperature}°C` : '--'}
                </Text>
                <Text style={styles.envLabel}>温度</Text>
              </View>
              <View style={styles.envDivider} />
              <View style={styles.envItem}>
                <Text style={styles.envValue}>
                  {envData?.humidity != null ? `${envData.humidity}%` : '--'}
                </Text>
                <Text style={styles.envLabel}>湿度</Text>
              </View>
              <View style={styles.envDivider} />
              <View style={styles.envItem}>
                <Text style={styles.envValue}>
                  {dashboardData?.sleepScore || dashboardData?.alertsCount != null ? `${dashboardData.sleepScore || 0}分` : '--'}
                </Text>
                <Text style={styles.envLabel}>睡眠评分</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Card.Content>
      </Card>

      {/* Quick Nav */}
      <View style={styles.navRow}>
        {[
          { label: '睡眠记录', target: 'SleepRecords', icon: '😴', color: '#1a6340' },
          { label: '呼吸监测', target: 'Respiration', icon: '🫁', color: '#e07060' },
          { label: '环境监测', target: 'Environment', icon: '🌡', color: '#2d8a56' },
          { label: '设置', target: 'Settings', icon: '⚙', color: '#666' },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={styles.navItem} onPress={() => navigation.navigate(item.target)}>
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={styles.navLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20 },
  greeting: { fontSize: 18, color: '#666', marginBottom: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  username: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  card: { marginBottom: 15 },
  cardTitle: { fontSize: 14, color: '#999', marginBottom: 8 },
  bigValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bigValue: { fontSize: 48, fontWeight: 'bold', color: '#1a6340' },
  bigUnit: { fontSize: 16, color: '#666' },
  cardHint: { fontSize: 13, color: '#aaa', marginTop: 4 },
  envRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  envItem: { alignItems: 'center', flex: 1 },
  envValue: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  envLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  envDivider: { width: 1, height: 36, backgroundColor: '#eee' },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, marginBottom: 30 },
  navItem: {
    width: '47%', backgroundColor: '#fff', padding: 16, borderRadius: 12,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  navIcon: { fontSize: 28 },
  navLabel: { fontSize: 14, fontWeight: '500', color: '#333' },
});

export default Dashboard;
