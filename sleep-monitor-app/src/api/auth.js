import axios from 'axios';
import { API_BASE_URL } from './config';

export const register = async (username, password, email) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/register`, {
      username,
      password,
      email
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '注册失败' };
  }
};

export const login = async (username, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/login`, {
      username,
      password
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '登录失败' };
  }
};

export const getUserInfo = async (userId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${userId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取用户信息失败' };
  }
};

export const updateUserInfo = async (userId, data) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/user/${userId}`, data);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '更新用户信息失败' };
  }
};
