@echo off
chcp 65001 >nul
title ESP32 CSI 数据桥接

echo ============================================
echo   ESP32 CSI 数据桥接工具
echo ============================================
echo.
echo 请确保：
echo   1. Flask后端已启动 (python app.py)
echo   2. ESP32已连接到电脑USB
echo.
echo 正在检查可用串口...
python -c "import serial.tools.list_ports; [print(f'  {p.device}: {p.description}') for p in serial.tools.list_ports.comports()]"
echo.

set /p PORT="请输入ESP32连接的串口 (如 COM3): "
set /p DEVICE_ID="请输入设备ID (默认 ESP-001): "
if "%DEVICE_ID%"=="" set DEVICE_ID=ESP-001

echo.
echo 正在启动数据桥接...
echo   串口: %PORT%
echo   设备ID: %DEVICE_ID%
echo   目标API: http://localhost:5000/api
echo.
echo 按 Ctrl+C 停止...
echo.

python csi_to_api.py --port %PORT% --baud 921600 --device-id %DEVICE_ID% --user-id 1 --api-url http://localhost:5000/api

pause
