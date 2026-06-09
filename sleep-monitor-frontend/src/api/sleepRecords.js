import axios from 'axios';
import { ENDPOINTS, TIMEOUT } from './config';

const api = axios.create({
  timeout: TIMEOUT
});

export const getSleepRecords = async (userId, params = {}) => {
  try {
    const response = await api.get(ENDPOINTS.SLEEP_RECORDS(userId), { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取睡眠记录失败' };
  }
};

export const getSleepSuggestion = async (data) => {
  try {
    const response = await api.post(`${ENDPOINTS.BASE}/sleep/suggestion`, data);
    return response.data;
  } catch (error) {
    console.warn('获取AI睡眠建议失败:', error);
    return { success: false, message: '获取AI睡眠建议失败' };
  }
};
