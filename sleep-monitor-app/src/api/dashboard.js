import axios from 'axios';
import { API_BASE_URL } from './config';

export const getDashboardData = async (userId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${userId}/dashboard`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取仪表盘数据失败' };
  }
};

export const getRespirationTrend = async (userId, period = 'week') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${userId}/respiration/trend`, {
      params: { period }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取呼吸率趋势失败' };
  }
};
