import axios from 'axios';
import { API_BASE_URL } from './config';

export const getEnvironmentData = async (userId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${userId}/environment`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取环境数据失败' };
  }
};

export const getEnvironmentHistory = async (userId, days = 30) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${userId}/environment/history`, {
      params: { days }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取环境历史数据失败' };
  }
};

export const getSleepSuggestion = async (userId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${userId}/sleep-suggestion`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取睡眠建议失败' };
  }
};
