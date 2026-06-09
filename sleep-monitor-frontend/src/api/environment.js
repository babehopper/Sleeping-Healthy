import axios from 'axios';
import { TIMEOUT } from './config';

const API_BASE = 'http://localhost:5000/api';
const api = axios.create({ timeout: TIMEOUT });

/** 获取最新温湿度 */
export async function getCurrentEnvironment(userId) {
  try {
    const response = await api.get(`${API_BASE}/environment/current`, { params: { userId } });
    return response.data;
  } catch (error) {
    console.warn('获取环境数据失败');
    return { success: true, data: null };
  }
}

/** 获取指定日期24小时整点温湿度趋势 */
export async function getEnvironmentTrend(userId, date) {
  try {
    const response = await api.get(`${API_BASE}/environment/trend`, { params: { userId, date } });
    return response.data;
  } catch (error) {
    console.warn('获取温湿度趋势失败');
    return { success: true, data: { times: [], temperatures: [], humidities: [] } };
  }
}

/** 获取AI环境优化建议 */
export async function getAISuggestion(data) {
  try {
    const response = await api.post(`${API_BASE}/environment/suggestion`, data);
    return response.data;
  } catch (error) {
    console.warn('获取AI建议失败:', error);
    return { success: false, message: '获取AI建议失败' };
  }
}
