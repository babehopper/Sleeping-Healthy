# 睡眠监测系统 - 完整项目

基于 Wi-Fi CSI 技术的非侵入式睡眠监测系统。

## 项目结构

```
d:\maxproject\
├── sleep-monitor-frontend/    # 前端项目
│   ├── src/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
└── sleep-monitor-backend/     # 后端项目
    ├── app.py
    ├── requirements.txt
    └── start.bat
```

## 快速启动

### 方式一：分别启动

**启动前端：**
```bash
cd sleep-monitor-frontend
npm install
npm run dev
```
前端地址：http://localhost:5173

**启动后端：**
```bash
cd sleep-monitor-backend
# Windows用户直接双击 start.bat
# 或手动启动：
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
后端地址：http://localhost:5000

### 方式二：使用快速脚本（Windows）

**启动后端：**
```bash
cd sleep-monitor-backend
start.bat
```

## 测试账号

- 用户名: `admin`
- 密码: `123456`

## 技术栈

### 前端
- React 18
- Vite
- Ant Design
- ECharts

### 后端
- Flask 2.3.3
- SQLite
- Flask-SQLAlchemy

### 硬件（待开发）
- ESP32-S3
- Wi-Fi CSI

## 功能特性

### 已实现
- ✅ 用户登录/注册
- ✅ 仪表盘数据展示
- ✅ 睡眠记录管理
- ✅ 告警管理
- ✅ 设备管理
- ✅ 系统设置

### 待开发
- ⏳ 与ESP32硬件对接
- ⏳ 实时数据传输（MQTT）
- ⏳ 睡眠分析算法
- ⏳ 数据可视化增强

## 开发计划

1. **阶段一**：前后端联调 - 连接前端与后端API
2. **阶段二**：硬件开发 - ESP32数据采集与传输
3. **阶段三**：算法开发 - 睡眠状态分类
4. **阶段四**：系统集成与测试
