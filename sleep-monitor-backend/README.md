# 睡眠监测系统 - 后端

基于 Flask 的睡眠监测系统后端 API。

## 项目结构

```
sleep-monitor-backend/
├── app.py                 # 主应用文件
├── requirements.txt       # Python依赖
├── .env                  # 环境变量配置
├── .gitignore           # Git忽略文件
└── README.md            # 项目说明
```

## 技术栈

- **Flask 2.3.3** - Web框架
- **Flask-CORS** - 跨域处理
- **Flask-SQLAlchemy** - 数据库ORM
- **SQLite** - 数据库（可替换为MySQL/PostgreSQL）
- **paho-mqtt** - MQTT通信（预留）
- **pandas** - 数据处理

## 快速开始

### 1. 安装Python依赖

```bash
# 进入后端项目目录
cd sleep-monitor-backend

# 创建虚拟环境（推荐）
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 运行项目

```bash
python app.py
```

服务器将在 `http://localhost:5000` 启动。

### 3. 测试API

首次运行会自动创建数据库并添加示例数据。

**测试账号：**
- 用户名: `admin`
- 密码: `123456`

## API接口

### 用户相关
- `POST /api/login` - 用户登录
- `POST /api/register` - 用户注册
- `GET /api/user/<id>` - 获取用户信息
- `PUT /api/user/<id>` - 更新用户信息

### 设备相关
- `GET /api/user/<id>/devices` - 获取设备列表
- `POST /api/user/<id>/devices` - 添加设备
- `DELETE /api/device/<id>` - 删除设备
- `PUT /api/device/<id>/config` - 更新设备配置

### 睡眠记录
- `GET /api/user/<id>/sleep-records` - 获取睡眠记录

### 仪表盘
- `GET /api/user/<id>/dashboard` - 获取仪表盘数据

### 告警相关
- `GET /api/user/<id>/alerts` - 获取告警列表
- `PUT /api/alert/<id>` - 处理告警
- `DELETE /api/alert/<id>` - 删除告警

### 系统设置
- `GET/PUT /api/user/<id>/alert-settings` - 告警设置
- `GET/PUT /api/user/<id>/system-settings` - 系统设置

## 数据库模型

- **User** - 用户表
- **Device** - 设备表
- **SleepRecord** - 睡眠记录表
- **Alert** - 告警表
- **Respiration** - 呼吸记录表

## 下一步

- [ ] 连接前端
- [ ] 集成MQTT与ESP32通信
- [ ] 添加用户认证（JWT）
- [ ] 实现睡眠分析算法
- [ ] 添加数据可视化API
