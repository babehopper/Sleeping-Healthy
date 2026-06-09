import axios from 'axios';
import { TIMEOUT } from './config';

const API_BASE = 'http://localhost:5000/api';
const api = axios.create({ timeout: TIMEOUT });

// 获取呼吸率监测数据
export async function getRespirationData(userId) {
  try {
    const response = await api.get(`${API_BASE}/respiration/data`, { params: { userId } });
    return response.data;
  } catch (error) {
    console.warn('获取呼吸数据失败');
    return { success: true, data: null };
  }
}

// 获取实时呼吸波形数据
export async function getRespirationWave(userId) {
  try {
    const response = await api.get(`${API_BASE}/respiration/wave`, { params: { userId } });
    return response.data;
  } catch (error) {
    console.warn('获取呼吸波形失败');
    return { success: true, data: [] };
  }
}

// 获取睡眠阶段呼吸率数据
export async function getSleepStageRespiration(userId, date) {
  try {
    const response = await api.get(`${API_BASE}/respiration/sleep-stage`, { params: { userId, date } });
    return response.data;
  } catch (error) {
    console.warn('获取睡眠阶段呼吸数据失败');
    return { success: true, data: null };
  }
}

// 获取历史呼吸率趋势
export async function getRespirationTrend(userId, mode, date) {
  try {
    const response = await api.get(`${API_BASE}/respiration/trend`, { params: { userId, mode, date } });
    return response.data;
  } catch (error) {
    console.warn('获取呼吸趋势失败');
    return { success: true, data: null };
  }
}

// 获取呼吸异常记录
export async function getRespirationAlerts(userId, date) {
  try {
    const response = await api.get(`${API_BASE}/respiration/alerts`, { params: { userId, date } });
    return response.data;
  } catch (error) {
    console.warn('获取呼吸异常记录失败');
    return { success: true, data: [] };
  }
}

// 获取AI呼吸建议
export async function getRespirationSuggestion(data) {
  try {
    const response = await api.post(`${API_BASE}/respiration/suggestion`, data);
    return response.data;
  } catch (error) {
    console.warn('获取AI呼吸建议失败:', error);
    return { success: false, message: '获取AI呼吸建议失败' };
  }
}
