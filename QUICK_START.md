# 睡眠监测系统 - 快速开始指南

## 一句话总结

**让ESP32在睡觉时自动监测呼吸，数据自动上传到数据库，早上起床就能看到睡眠报告。**

---

## 准备工作（一次性）

### 1. 硬件准备
- ESP32S3 开发板
- USB数据线
- 手机热点（或其他WiFi）

### 2. 软件安装
```bash
# 安装Python依赖
cd D:\maxproject\sleep-monitor-backend
pip install flask flask-cors flask-sqlalchemy pyserial requests numpy scipy paho-mqtt

# 安装前端依赖
cd D:\maxproject\sleep-monitor-frontend
npm install
```

### 3. ESP32配置
编辑ESP32代码，设置WiFi和API地址：

```c
// 文件: ESP32-CSI-Tool/wifi_csi_sender/main/main.cc

#define WIFI_SSID      "你的手机热点名称"
#define WIFI_PASSWORD  "你的手机热点密码"
#define API_URL        "http://192.168.x.x:5000/api/device/ESP-001/csi-data"
                                                    ↑ 改成你电脑的IP
```

上传程序到ESP32：
```bash
cd D:\maxproject\ESP32-CSI-Tool\wifi_csi_sender
idf.py build
idf.py flash monitor
```

---

## 每次使用（重复）

### 步骤1：打开一键启动

双击运行：
```
D:\maxproject\sleep-monitor-backend\sleep_monitor_start.bat
```

或在终端运行：
```bash
cd D:\maxproject\sleep-monitor-backend
python app.py
```

### 步骤2：验证连接

打开浏览器访问：
```
http://localhost:5173
```

登录后查看Dashboard，应该能看到实时数据。

### 步骤3：上床睡觉

确保：
- ESP32连接手机热点
- ESP32板子上的LED亮起（开始工作）
- Dashboard显示设备在线

然后安心睡觉💤

### 步骤4：早上查看报告

起床后，打开浏览器查看：
- 整晚呼吸率变化曲线
- 睡眠阶段分布（深度睡眠/浅睡眠/REM）
- 睡眠质量评分
- 呼吸异常事件（如有）

---

## 文件说明

| 文件 | 用途 |
|------|------|
| `app.py` | Flask后端API |
| `csi_to_api.py` | 串口转API桥接 |
| `udp_receiver.py` | UDP接收器 |
| `test_api.py` | API测试工具 |
| `sleep_monitor_start.bat` | 一键启动脚本 |
| `wifi_csi_sender/` | ESP32 WiFi发送程序 |

---

## 数据存储

所有数据存储在：
```
D:\maxproject\sleep-monitor-backend\instance\sleep_monitor.db
```

可以用SQLite查看器打开查看原始数据。

---

## 故障排除

### 问题1：ESP32连接不上WiFi
- 确认WiFi是2.4GHz（不是5GHz）
- 确认密码正确
- 确认没有MAC过滤

### 问题2：API接收不到数据
- 检查电脑防火墙设置
- 确认API_URL中的IP正确
- 运行 `test_api.py` 测试连接

### 问题3：数据库没有数据
- 查看Flask后端控制台日志
- 确认API返回200状态码

---

## 高级配置

### 修改监测间隔
在ESP32代码中修改：
```c
#define SEND_INTERVAL_MS  30000  // 改成60秒 = 60000
```

### 修改设备ID
- ESP32: 修改 `#define DEVICE_ID "ESP-001"`
- 同时修改后端查询条件

### 启用呼吸暂停检测
后端已内置apnea_detector.py，发现异常会自动告警。

---

## 下一步

1. ✅ 试运行 `test_api.py` 确认系统工作
2. ✅ 配置ESP32的WiFi和API地址
3. ✅ 上传程序到ESP32
4. ✅ 今晚开始第一次真实测试！

祝你有个好睡眠！🌙
