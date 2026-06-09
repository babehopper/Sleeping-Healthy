"""Serial → MQTT bridge: reads ESP32 CSI data from serial, publishes to MQTT."""

import argparse
import json
import time
import serial
import paho.mqtt.client as mqtt
from datetime import datetime
from csi_data import ESP32TextParser


def main():
    parser = argparse.ArgumentParser(description="ESP32 CSI Serial → MQTT Bridge")
    parser.add_argument("--port", default="COM3")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--broker", default="localhost")
    parser.add_argument("--mqtt-port", type=int, default=1883)
    parser.add_argument("--device-id", default="ESP-001")
    parser.add_argument("--topic", default="csi/raw")
    args = parser.parse_args()

    csi_parser = ESP32TextParser()

    def on_connect(client, userdata, flags, reason_code, properties):
        print(f"[MQTT] Connected to broker, rc={reason_code}")

    mqtt_client = mqtt.Client(
        client_id=f"bridge-{args.device_id}",
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    )
    mqtt_client.on_connect = on_connect
    mqtt_client.connect(args.broker, args.mqtt_port, 60)
    mqtt_client.loop_start()
    time.sleep(0.5)  # Wait for connection

    print(f"Opening serial port {args.port} at {args.baud} baud...")
    
    # 打开串口
    ser = serial.Serial(args.port, args.baud, timeout=1)
    
    # 复位等待：拉低RTS/DTR再释放，让ESP32重启
    ser.setDTR(False)
    ser.setRTS(False)
    time.sleep(0.1)
    ser.setDTR(True)
    ser.setRTS(True)
    time.sleep(2)  # 等待ESP32重启完成并开始输出数据
    ser.reset_input_buffer()  # 清空复位过程中可能产生的垃圾数据
    
    print(f"Serial connected. Publishing to MQTT '{args.topic}'")

    frame_count = 0
    start_time = time.time()

    try:
        while True:
            line = ser.readline().decode("utf-8", errors="replace").strip()
            if not line:
                continue

            # --- Environment data (DHT22) ---
            if line.startswith("ENV_DATA"):
                parts = line.split(",")
                if len(parts) >= 3:
                    try:
                        temp = float(parts[1])
                        hum = float(parts[2])
                        payload = json.dumps({
                            "device_id": args.device_id,
                            "timestamp": datetime.now().isoformat(),
                            "temperature": temp,
                            "humidity": hum,
                        })
                        mqtt_client.publish("csi/environment", payload)
                        print(f"  [ENV] {temp:.1f}°C  {hum:.1f}%")
                    except ValueError:
                        pass
                continue

            if not line.startswith("CSI_DATA"):
                continue

            try:
                csi_data = csi_parser.parse(line)
            except ValueError:
                continue

            payload = json.dumps({
                "device_id": args.device_id,
                "timestamp": csi_data.timestamp.isoformat(),
                "amplitude": csi_data.amplitude.tolist(),
                "phase": csi_data.phase.tolist(),
                "frequency": csi_data.frequency,
                "bandwidth": csi_data.bandwidth,
                "num_subcarriers": csi_data.num_subcarriers,
                "num_antennas": csi_data.num_antennas,
                "snr": csi_data.snr,
            })

            mqtt_client.publish(args.topic, payload)
            frame_count += 1

            if frame_count % 500 == 0:
                elapsed = time.time() - start_time
                fps = frame_count / elapsed if elapsed > 0 else 0
                print(f"  [{args.device_id}] {frame_count} frames, {fps:.1f} fps")

    except KeyboardInterrupt:
        print(f"\nDone. Total: {frame_count} frames")
    finally:
        ser.close()
        mqtt_client.loop_stop()
        mqtt_client.disconnect()


if __name__ == "__main__":
    main()