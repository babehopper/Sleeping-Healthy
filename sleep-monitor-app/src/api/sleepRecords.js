import axios from 'axios';
import { API_BASE_URL } from './config';

export const getSleepRecords = async (userId, page = 1, limit = 10) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${userId}/sleep-records`, {
      params: { page, limit }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取睡眠记录失败' };
  }
};

export const getSleepRecordDetail = async (userId, recordId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${userId}/sleep-records/${recordId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取睡眠记录详情失败' };
  }
};
