import axios from 'axios';
import { ENDPOINTS, TIMEOUT } from './config';

const api = axios.create({
  timeout: TIMEOUT
});

export const getDevices = async (userId) => {
  try {
    const response = await api.get(ENDPOINTS.DEVICES(userId));
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '获取设备列表失败' };
  }
};

export const addDevice = async (userId, deviceData) => {
  try {
    const response = await api.post(ENDPOINTS.DEVICES(userId), deviceData);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '添加设备失败' };
  }
};

export const deleteDevice = async (deviceId) => {
  try {
    const response = await api.delete(ENDPOINTS.DEVICE(deviceId));
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '删除设备失败' };
  }
};

export const updateDeviceConfig = async (deviceId, configData) => {
  try {
    const response = await api.put(ENDPOINTS.DEVICE_CONFIG(deviceId), configData);
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: '更新设备配置失败' };
  }
};
