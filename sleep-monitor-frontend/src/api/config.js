const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/login`,
  REGISTER: `${API_BASE_URL}/register`,
  USER: (userId) => `${API_BASE_URL}/user/${userId}`,
  DEVICES: (userId) => `${API_BASE_URL}/user/${userId}/devices`,
  DEVICE: (deviceId) => `${API_BASE_URL}/device/${deviceId}`,
  DEVICE_CONFIG: (deviceId) => `${API_BASE_URL}/device/${deviceId}/config`,
  SLEEP_RECORDS: (userId) => `${API_BASE_URL}/user/${userId}/sleep-records`,
  DASHBOARD: (userId) => `${API_BASE_URL}/user/${userId}/dashboard`,
  ALERTS: (userId) => `${API_BASE_URL}/user/${userId}/alerts`,
  ALERT: (alertId) => `${API_BASE_URL}/alert/${alertId}`,
  ALERT_SETTINGS: (userId) => `${API_BASE_URL}/user/${userId}/alert-settings`,
  SYSTEM_SETTINGS: (userId) => `${API_BASE_URL}/user/${userId}/system-settings`,
  ALARMS: (userId) => `${API_BASE_URL}/user/${userId}/alarms`,
  ALARM: (alarmId) => `${API_BASE_URL}/alarm/${alarmId}`,
  ALARM_TOGGLE: (alarmId) => `${API_BASE_URL}/alarm/${alarmId}/toggle`
};

export const TIMEOUT = 10000;
