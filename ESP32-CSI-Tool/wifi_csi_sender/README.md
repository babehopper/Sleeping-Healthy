# ESP32 WiFi CSI 发送器配置指南

## 概述

这个程序让ESP32通过WiFi直接发送呼吸监测数据到Flask后端API，实现完全自动化的睡眠监测。

## 准备工作

### 1. 确定电脑IP地址

在Windows上打开命令提示符，输入：
```bash
ipconfig
```

找到IPv4地址，例如：`192.168.1.100`

### 2. 修改ESP32代码

编辑 `main.cc` 文件，修改以下配置：

```c
/* WiFi配置 */
#define WIFI_SSID      "你的WiFi名称"
#define WIFI_PASSWORD  "你的WiFi密码"

/* Flask API配置 - 使用你的电脑IP */
#define API_URL        "http://192.168.1.100:5000/api/device/ESP-001/csi-data"
```

### 3. 上传程序到ESP32

```bash
cd D:\maxproject\ESP32-CSI-Tool\wifi_csi_sender
idf.py set-target esp32s3
idf.py build
idf.py flash monitor
```

## 快速开始

### 方式一：一键启动（推荐）

1. 确保ESP32连接电脑USB
2. 双击运行 `D:\maxproject\sleep-monitor-backend\sleep_monitor_start.bat`
3. 按照提示输入串口编号
4. 所有服务自动启动

### 方式二：手动启动

```bash
# 1. 启动Flask后端
cd D:\maxproject\sleep-monitor-backend
python app.py

# 2. 启动前端（另开终端）
cd D:\maxproject\sleep-monitor-frontend
npm run dev
```

## 使用流程

1. **准备阶段**
   - 电脑连接手机热点（获得192.168.x.x IP）
   - ESP32也连接同一热点
   - 运行一键启动脚本

2. **开始监测**
   - 打开浏览器访问 http://localhost:5173
   - 登录并查看Dashboard
   - 上床睡觉，ESP32自动开始监测

3. **结束监测**
   - 早上起床后，查看睡眠数据报告
   - 按Ctrl+C停止所有服务

## 数据流程

```
ESP32 (WiFi) 
    ↓ HTTP POST (JSON)
Flask API (http://localhost:5000)
    ↓ 存储
SQLite数据库 (sleep_monitor.db)
    ↓ 查询
前端Dashboard (http://localhost:5173)
```

## 故障排除

### ESP32无法连接WiFi
- 确认WiFi名称和密码正确
- 确认WiFi是2.4GHz（ESP32不支持5GHz）
- 检查WiFi是否需要MAC地址过滤

### Flask API接收不到数据
- 确认电脑防火墙允许5000端口
- 确认ESP32配置的API_URL中IP正确
- 在浏览器测试：http://localhost:5000/

### 数据库没有数据
- 查看Flask后端控制台输出
- 确认数据库文件有写入权限

## 扩展功能

- 修改发送间隔：在 `main.cc` 中修改 `30 * 1000`（毫秒）
- 添加更多传感器数据：修改JSON构造部分
- 启用实时通知：在app.py中添加邮件/推送功能
