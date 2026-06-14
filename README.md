# 基于 WiFi CSI 的非接触式睡眠呼吸监测系统

## 项目简介

本项目利用 ESP32-S3 采集 WiFi 信道状态信息（CSI），通过信号处理算法（PCA + Butterworth 滤波 + FFT）提取呼吸率，结合 DHT22 温湿度传感器，实现非接触式睡眠监测。系统采用 React Native 移动端 APP，数据经 MQTT 协议传输至云服务器。

## 系统架构

```
┌─────────────┐     WiFi (STA)      ┌──────────────┐     HTTP      ┌──────────┐
│  ESP32-S3   │ ─── MQTT ──────────→│  云服务器      │ ←────────── │  手机APP  │
│  + DHT22    │   csi/raw            │  Mosquitto    │   REST API   │  (APK)   │
│  (充电头供电) │   csi/environment    │  Flask        │              │          │
└─────────────┘                      │  mqtt_processor│              └──────────┘
                                      └──────────────┘
```

- **ESP32-S3**：轮询 WiFi 客户端，采集 CSI 数据 + DHT22 温湿度，通过 MQTT 发布至云服务器
- **云服务器**：Mosquitto（MQTT Broker）→ mqtt_processor（信号处理）→ Flask API（SQLite 存储）
- **手机 APP**：React Native + Expo，直连云服务器 API，显示呼吸率、睡眠记录、环境温湿度

## 硬件清单

| 硬件 | 型号/规格 | 用途 |
|------|----------|------|
| 主控 | ESP32-S3 | WiFi CSI 采集 |
| 温湿度传感器 | DHT22 | 环境监测 |
| 供电 | USB 充电头 (5V/1A) | 持续供电 |

**DHT22 接线：**

| DHT22 引脚 | 连接 ESP32-S3 |
|-----------|--------------|
| VCC (+)   | 3.3V         |
| DATA      | GPIO4        |
| GND (-)   | GND          |

## 一、ESP32 固件编译与烧录

### 1.1 修改 WiFi 配置

打开 `ESP32-CSI-Tool/active_sta/main/main.cc`，修改第 24-25 行：

```c
#define ESP_WIFI_SSID      "你的WiFi名称"
#define ESP_WIFI_PASS      "你的WiFi密码"
```

测试时建议使用手机热点，方便在任何环境使用。

### 1.2 修改 MQTT 服务器地址

同文件第 28 行，默认已配置为云服务器地址，通常无需修改：

```c
#define MQTT_BROKER_URL    "mqtt://112.124.104.229:1883"
```

### 1.3 编译烧录

确保已安装 [ESP-IDF v5.5.3](https://docs.espressif.com/projects/esp-idf/en/v5.5.3/)。

```bash
cd ESP32-CSI-Tool/active_sta

# 设置芯片型号
idf.py set-target esp32s3

# 启用 WiFi CSI（仅首次需要）
idf.py menuconfig
# 路径：Component config → Wi-Fi → [*] Wi-Fi CSI(Channel State Information) support
# 按空格选中，S 保存，Q 退出

# 编译、烧录、串口监视
idf.py build flash monitor
```

烧录成功后，串口输出应包含：
```
sleep-monitor: WiFi connected!
MQTT: Connected to broker
ENV 27.6°C 64.7%
```

### 1.4 仅供电使用

烧录完成后，ESP32 可以脱离电脑独立运行。插上 USB 充电头通电即可自动连接 WiFi 并开始采集数据。

## 二、手机 APP 构建

> **后端已部署在云服务器 `112.124.104.229` 上，无需额外配置。**

### 2.1 修改 API 地址（如果需要）

打开 `sleep-monitor-app/src/api/config.js`，确认 API 地址正确：

```js
export const API_BASE_URL = 'http://112.124.104.229:5000/api';
```

如果使用其他服务器，将 IP 改为你的服务器地址。

### 2.2 安装依赖

```bash
cd sleep-monitor-app
npm install
```

### 2.3 构建 APK

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录 Expo 账号（需要注册 https://expo.dev）
eas login

# 构建 Android APK
eas build --platform android --profile preview
```

构建完成后会输出 APK 下载链接，约需 10-20 分钟。在手机浏览器打开链接下载安装。

> 首次安装需在手机设置中允许"安装未知来源应用"。安装后不需要 Expo Go，可直接打开使用。

## 三、使用方法

### 3.1 登录

- 打开 APP，使用管理员账户登录：**用户名 `admin`，密码 `123456`**
- **注意：当前版本仅支持管理员账户，注册功能暂不可用**

### 3.2 开始监测

1. ESP32 插上充电头供电，等待约 30 秒连接 WiFi
2. 打开手机 APP → 登录 → 首页可看到呼吸率和温湿度
3. 将 ESP32 放置在床头，距胸口约 50cm
4. 睡觉时确保 ESP32 持续供电，手机无需保持 APP 打开

### 3.3 查看数据

| 页面 | 功能 |
|------|------|
| **首页** | 最新呼吸率 + 当前温湿度 + 快捷入口 |
| **睡眠记录** | 日视图：睡眠评分、结构条（深睡/浅睡/REM/清醒）、效率；周视图：每日时长柱状图；智能建议 |
| **呼吸监测** | 实时呼吸率折线图 + 历史记录 + 智能建议 |
| **环境监测** | 实时温湿度仪表盘 + 近7日趋势折线图 + 智能建议 |
| **设置** | 修改个人信息（身高/体重/年龄等） |

### 3.4 睡眠记录生成

睡眠记录由系统自动检测生成。当用户入睡（呼吸平稳 + 体动减少），系统自动开始记录；当用户醒来（呼吸变剧烈 + 体动增加），系统自动结束会话并生成 SleepRecord。**无需手动开始/结束，全程自动。**

> 最小会话时长为 30 分钟，短于此时间的午睡不会被记录。

### 3.5 智能建议

在呼吸监测、环境监测、睡眠记录页面，点击 **"🤖 生成智能建议"** 按钮，系统会调用 Kimi AI 基于真实测量数据生成个性化建议。每次调用间隔需 ≥ 10 分钟。

## 四、重要说明

### 5.1 账号限制
当前版本仅支持管理员账户 `admin / 123456`，注册功能未开放。如需多用户使用，请修改 `app.py` 中的 `init_db()` 手动创建用户。

### 5.2 WiFi 配置
ESP32 固件中 WiFi 名称和密码是**硬编码**的。更换网络时需修改 `main.cc`（第 24-25 行）并重新编译烧录。WiFi Provisioning（手机配网）功能将在后续版本实现。

### 5.3 Web 前端（重要）
**`sleep-monitor-frontend/` 目录下的 Web 前端已停止开发，最终方案为移动端 APP。请忽略此文件夹，评阅时以手机 APP 为准。**

### 5.4 呼吸率精度
CSI 信号受环境（人员密度、距离、障碍物）影响较大。建议在安静环境、距胸口 30-80cm 处使用。呼吸率的绝对精度有限，但相对变化趋势可靠——这是 WiFi CSI 技术的共性，非本项目的实现缺陷。

### 5.5 睡眠分期说明
当前系统可实现**睡眠/清醒二分类**。深睡/浅睡/REM 分期基于呼吸率变化和体动的统计推断，精度有限。精确分期需要 EEG 设备，这是非接触式监测的固有限制。

## 五、文件结构

```
├── ESP32-CSI-Tool/          # ESP32 固件 (active_sta)
│   ├── active_sta/main/     # 主程序：WiFi STA + MQTT + DHT22 + CSI
│   ├── _components/         # 驱动组件：CSI / DHT22 / MQTT
│   └── sdkconfig            # ESP-IDF 配置
├── sleep-monitor-backend/   # 云端后端
│   ├── app.py               # Flask API + 数据模型 + 睡眠会话追踪
│   ├── mqtt_processor.py    # MQTT 订阅 + 信号处理调度
│   ├── csi_pipeline.py      # CSI 信号处理 (PCA + Butterworth + FFT)
│   ├── sleep_classifier.py  # 睡眠/清醒分类器
│   ├── apnea_detector.py    # 呼吸暂停检测
│   ├── csi_data.py          # CSI 数据解析
│   └── serial_bridge.py     # 串口→MQTT 桥接（云端部署已废弃，保留备用）
├── sleep-monitor-app/       # React Native 移动端 APP
│   ├── src/pages/           # 页面
│   ├── src/api/             # API 客户端
│   └── app.json             # Expo 配置
└── sleep-monitor-frontend/  # ⚠️ Web 前端（已停止开发，请忽略）
```

## 六、常见问题

| 问题 | 解决 |
|------|------|
| ESP32 烧录时崩溃 `CSI not enabled` | 执行 `idf.py menuconfig`，启用 Wi-Fi CSI support |
| ESP32 二进制过大烧录失败 | 已配置 1.5MB 分区表，如仍超限检查 `sdkconfig` 分区设置 |
| 手机 APP 登录失败 | 确认云服务器三个进程均在运行；确认手机能访问 `http://<服务器IP>:5000/api/login` |
| 呼吸率始终显示 "--" | 检查 ESP32 是否上电、WiFi 是否连通、mqtt_processor 是否在运行 |
| 睡眠记录为空 | 需要完整睡眠会话（连续睡着 ≥ 30 分钟后醒来）才会自动创建记录 |
| DHT22 温湿度无数据 | 检查接线（VCC→3.3V, DATA→GPIO4, GND→GND），不要用 5V |
| EAS 构建上传超时 | 网络问题，换个时段重试或在 `.easignore` 中添加 `node_modules/` |

## 作者

毕业设计项目 · 2026 年 6 月
