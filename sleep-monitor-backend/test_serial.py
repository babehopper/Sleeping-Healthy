import serial
import time

s = serial.Serial('COM5', 115200, timeout=2)
# 触发板子复位，让它重新开始输出
s.setDTR(False)
s.setRTS(False)
time.sleep(0.1)
s.setDTR(True)
s.setRTS(True)
time.sleep(2)  # 等板子启动完成
s.reset_input_buffer()

print('listening...')
for i in range(100):
    line = s.readline().decode('utf-8', errors='replace').strip()
    if line:
        print(repr(line))
    else:
        print(f'[{i}] empty')
s.close()