import axios from 'axios';
import { API_BASE_URL } from './config';

export const getRealTimeRespiration = async (userId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${userId}/respiration/real-time`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取实时呼吸数据失败' };
  }
};

export const getRespirationRecords = async (userId, page = 1, limit = 10) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${userId}/respiration/records`, {
      params: { page, limit }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取呼吸记录失败' };
  }
};
