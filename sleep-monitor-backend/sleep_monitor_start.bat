@echo off
chcp 65001 >nul
title 睡眠监测系统 - 一键启动

echo.
echo  ========================================
echo    睡眠监测系统 - 一键启动
echo  ========================================
echo.
echo  使用说明：
echo    1. 确保ESP32已连接电脑USB
echo    2. 确保电脑和ESP32都连接了同一WiFi
echo    3. 按任意键开始启动...
echo.
pause >nul

cd /d "%~dp0"

echo.
echo [1/4] 检查Python环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: 未找到Python，请先安装Python
    pause
    exit /b 1
)
echo      OK

echo.
echo [2/4] 检测ESP32连接的串口...
python -c "import serial.tools.list_ports; ports = list(serial.tools.list_ports.comports()); print(f'找到 {len(ports)} 个串口')"
if errorlevel 1 (
    echo ERROR: pyserial未安装，正在安装...
    pip install pyserial
)

echo.
python -c "import serial.tools.list_ports; ports = list(serial.tools.list_ports.comports()); [print(f'  {p.device}: {p.description}') for p in ports]"
echo.

set /p ESP_PORT="请输入ESP32的串口 (如 COM3): "

echo.
echo [3/4] 获取本机IP地址...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "ipv4" ^| findstr "192.168"') do set LOCAL_IP=%%a
set LOCAL_IP=%LOCAL_IP: =%
echo      本机IP: %LOCAL_IP%
echo.
echo  请确保ESP32配置向 %LOCAL_IP%:2223 发送UDP数据
echo  或者ESP32连接到本机创建的热点 (192.168.4.x)
echo.

echo [4/4] 启动Flask后端...
start "SleepMonitor Backend" cmd /k "python app.py"

echo.
echo 等待Flask后端启动 (5秒)...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   启动完成！
echo ========================================
echo.
echo  将自动启动以下服务：
echo    1. Flask后端 API (http://localhost:5000)
echo    2. CSI数据接收器 (UDP端口 2223)
echo    3. 数据处理与存储
echo.
echo  ESP32串口: %ESP_PORT%
echo  本机IP: %LOCAL_IP%
echo.
echo  现在请：
echo    1. 打开浏览器访问 http://localhost:5173
echo    2. 登录后查看Dashboard
echo    3. 开始睡觉，让ESP32自动监测
echo.
echo  实时呼吸数据将自动上传到数据库
echo.
echo  按 Ctrl+C 停止所有服务
echo ========================================
echo.

echo 启动CSI数据接收器...
start "CSI Receiver" cmd /k "python csi_to_api.py --port %ESP_PORT% --baud 921600 --device-id ESP-001 --user-id 1 --api-url http://localhost:5000/api --window 30"

echo.
echo 所有服务已启动！
pause
