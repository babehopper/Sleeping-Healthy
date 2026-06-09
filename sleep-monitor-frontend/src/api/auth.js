import axios from 'axios';
import { ENDPOINTS, TIMEOUT } from './config';

const api = axios.create({
  timeout: TIMEOUT
});

export const login = async (username, password) => {
  try {
    const response = await api.post(ENDPOINTS.LOGIN, {
      username,
      password
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '登录失败' };
  }
};

export const register = async (userData) => {
  try {
    const response = await api.post(ENDPOINTS.REGISTER, userData);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '注册失败' };
  }
};

export const getUserProfile = async (userId) => {
  try {
    const response = await api.get(ENDPOINTS.USER(userId));
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取用户信息失败' };
  }
};

export const updateUserProfile = async (userId, userData) => {
  try {
    const response = await api.put(ENDPOINTS.USER(userId), userData);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '更新用户信息失败' };
  }
};

export const uploadAvatar = async (userId, avatarBase64) => {
  try {
    const response = await api.post(`http://localhost:5000/api/user/${userId}/avatar`, { avatar: avatarBase64 });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '上传头像失败' };
  }
};

export const checkProfileComplete = async (userId) => {
  try {
    const response = await api.get(`http://localhost:5000/api/user/${userId}/profile-complete`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '检查用户信息失败' };
  }
};
