import axios from 'axios';
import { ENDPOINTS, TIMEOUT } from './config';

const api = axios.create({
  timeout: TIMEOUT
});

export const getDashboardData = async (userId) => {
  try {
    const response = await api.get(ENDPOINTS.DASHBOARD(userId));
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取仪表盘数据失败' };
  }
};
