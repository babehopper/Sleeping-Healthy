import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, Button, TextInput, ActivityIndicator } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserInfo, updateUserInfo } from '../api/auth';

const Settings = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [userInfo, setUserInfo] = useState({
    username: '',
    email: '',
    phone: '',
    height: '',
    weight: '',
    age: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        if (!id) {
          navigation.navigate('Login');
          return;
        }
        setUserId(id);

        const result = await getUserInfo(id);
        const data = result.data || {};
        setUserInfo({
          username: data.username || '',
          email: data.email || '',
          phone: data.phone || '',
          height: data.height?.toString() || '',
          weight: data.weight?.toString() || '',
          age: data.age?.toString() || '',
        });
      } catch (error) {
        Alert.alert('错误', error.message || '获取数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        username: userInfo.username,
        email: userInfo.email || null,
        phone: userInfo.phone || null,
        height: userInfo.height ? parseInt(userInfo.height) : null,
        weight: userInfo.weight ? parseInt(userInfo.weight) : null,
        age: userInfo.age ? parseInt(userInfo.age) : null,
      };

      const result = await updateUserInfo(userId, data);
      if (result.success) {
        Alert.alert('成功', '用户信息更新成功');
      } else {
        Alert.alert('失败', result.message || '更新失败');
      }
    } catch (error) {
      Alert.alert('失败', error.message || '网络连接失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      '确认退出',
      '确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            await AsyncStorage.removeItem('userId');
            await AsyncStorage.removeItem('username');
            navigation.navigate('Login');
          },
        },
      ]
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
      <Text style={styles.header}>设置</Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>个人信息</Text>
          
          <TextInput
            label="用户名"
            value={userInfo.username}
            onChangeText={(text) => setUserInfo({ ...userInfo, username: text })}
            style={styles.input}
            mode="outlined"
          />

          <TextInput
            label="邮箱"
            value={userInfo.email}
            onChangeText={(text) => setUserInfo({ ...userInfo, email: text })}
            style={styles.input}
            mode="outlined"
            keyboardType="email-address"
          />

          <TextInput
            label="手机号"
            value={userInfo.phone}
            onChangeText={(text) => setUserInfo({ ...userInfo, phone: text })}
            style={styles.input}
            mode="outlined"
            keyboardType="phone-pad"
          />

          <View style={styles.row}>
            <TextInput
              label="身高 (cm)"
              value={userInfo.height}
              onChangeText={(text) => setUserInfo({ ...userInfo, height: text })}
              style={styles.inputHalf}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="体重 (kg)"
              value={userInfo.weight}
              onChangeText={(text) => setUserInfo({ ...userInfo, weight: text })}
              style={styles.inputHalf}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <TextInput
            label="年龄"
            value={userInfo.age}
            onChangeText={(text) => setUserInfo({ ...userInfo, age: text })}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
          />

          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.saveButton}
            loading={saving}
            disabled={saving}
          >
            保存修改
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Button
            mode="text"
            onPress={handleLogout}
            style={styles.logoutButton}
            textColor="#d32f2f"
          >
            退出登录
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  card: {
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  input: {
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 15,
  },
  inputHalf: {
    flex: 1,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#1a6340',
  },
  logoutButton: {
    marginTop: 10,
  },
});

export default Settings;
