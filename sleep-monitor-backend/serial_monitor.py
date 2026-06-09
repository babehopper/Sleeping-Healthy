"""简单串口监听工具 - 查看ESP32发送的原始数据"""

import serial
import time

port = input("请输入串口 (如 COM5): ") or "COM5"

try:
    ser = serial.Serial(port, 921600, timeout=1)
    print(f"\n已连接到 {port}，正在监听数据...")
    print("按 Ctrl+C 停止\n")
    
    while True:
        line = ser.readline().decode('utf-8', errors='replace').strip()
        if line:
            print(f"[{time.strftime('%H:%M:%S')}] {line}")
            
except serial.SerialException as e:
    print(f"ERROR: 无法打开串口 {port}: {e}")
except KeyboardInterrupt:
    print("\n停止监听")
    ser.close()
