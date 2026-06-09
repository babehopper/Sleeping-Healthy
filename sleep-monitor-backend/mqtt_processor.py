"""MQTT Processor: subscribes to raw CSI, runs algorithm pipeline, stores results.

Usage:
    python mqtt_processor.py --broker localhost --device-id ESP-001 --user-id 1 --api-url http://localhost:5000/api
"""

import argparse
import json
import time
import numpy as np
import sys
import paho.mqtt.client as mqtt
import requests
from collections import deque
from datetime import datetime

from csi_data import CSIData
from csi_pipeline import RespirationExtractor
from apnea_detector import ApneaDetector
from sleep_classifier import SleepClassifier

WINDOW_SECONDS = 30


def main():
    parser = argparse.ArgumentParser(description="MQTT CSI Processor")
    parser.add_argument("--broker", default="localhost")
    parser.add_argument("--mqtt-port", type=int, default=1883)
    parser.add_argument("--device-id", default="ESP-001")
    parser.add_argument("--user-id", type=int, default=1)
    parser.add_argument("--api-url", default="http://localhost:5000/api")
    parser.add_argument("--sample-rate", type=float, default=20.0)
    args = parser.parse_args()

    extractor = None  # Will be created with actual sampling rate
    apnea_detector = ApneaDetector()
    sleep_classifier = SleepClassifier(window_size=WINDOW_SECONDS)
    csi_buffer: deque = deque()

    def on_connect(client, userdata, flags, reason_code, properties):
        print(f"[MQTT] Connected to {args.broker}, subscribing to csi/raw and csi/environment")
        client.subscribe("csi/raw")
        client.subscribe("csi/environment")

    # ESP32 CSI text parser (for raw CSI_DATA lines from ESP32 MQTT)
    from csi_data import ESP32TextParser
    csi_text_parser = ESP32TextParser()

    def on_message(client, userdata, msg):
        payload_str = msg.payload.decode("utf-8")

        # --- Environment data (JSON) ---
        if msg.topic == "csi/environment":
            try:
                data = json.loads(payload_str)
                if data.get("device_id") == args.device_id:
                    requests.post(
                        f"{args.api_url}/device/{args.device_id}/env-data",
                        json={
                            "user_id": args.user_id,
                            "temperature": data.get("temperature"),
                            "humidity": data.get("humidity"),
                            "timestamp": data.get("timestamp", datetime.now().isoformat()),
                        },
                        timeout=5,
                    )
                    print(f"  [ENV] {data.get('temperature'):.1f}°C  {data.get('humidity'):.1f}% → Flask")
            except (json.JSONDecodeError, requests.exceptions.RequestException):
                pass
            return

        # --- CSI raw data (from ESP32 direct MQTT or serial_bridge JSON) ---
        if msg.topic != "csi/raw":
            return

        # Try JSON format first (from serial_bridge.py)
        try:
            data = json.loads(payload_str)
            if data.get("device_id") != args.device_id:
                return
            csi = CSIData(
                timestamp=datetime.fromisoformat(data["timestamp"]),
                amplitude=np.array(data["amplitude"]),
                phase=np.array(data["phase"]),
                frequency=data["frequency"],
                bandwidth=data["bandwidth"],
                num_subcarriers=data["num_subcarriers"],
                num_antennas=data["num_antennas"],
                snr=data["snr"],
                metadata={"source": "mqtt"},
            )
        except (json.JSONDecodeError, KeyError, ValueError):
            # Try raw CSI_DATA text format (from ESP32 direct MQTT publish)
            if not payload_str.startswith("CSI_DATA"):
                return
            try:
                csi = csi_text_parser.parse(payload_str)
            except ValueError:
                return

        csi_buffer.append(csi)

    mqtt_client = mqtt.Client(
        client_id=f"processor-{args.device_id}",
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    )
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    mqtt_client.connect(args.broker, args.mqtt_port, 60)
    mqtt_client.loop_start()

    print(f"Processor: device={args.device_id}, user={args.user_id}")
    print(f"Window: {WINDOW_SECONDS}s, buffering...")

    last_process = time.time()

    try:
        while True:
            time.sleep(2)

            if time.time() - last_process < WINDOW_SECONDS:
                continue

            last_process = time.time()
            window_frames = []
            while csi_buffer:
                window_frames.append(csi_buffer.popleft())

            buf_size = len(window_frames)
            print(f"  Processing window: {buf_size} frames")

            if buf_size < 10:
                print(f"    Too few frames, skipping")
                continue

            # Compute actual sampling rate from frame timestamps
            if buf_size >= 2:
                t0 = window_frames[0].timestamp.timestamp()
                t1 = window_frames[-1].timestamp.timestamp()
                dt = t1 - t0
                actual_rate = buf_size / dt if dt > 0 else 20.0
            else:
                actual_rate = 20.0

            # Create extractor with actual rate (recreate each window to match real rate)
            extractor = RespirationExtractor(sampling_rate=max(10, min(100, actual_rate)))

            result = extractor.process_window(window_frames)
            ts = datetime.now().isoformat()
            bpm = result.bpm
            motion = result.motion_detected
            conf = result.confidence

            apnea_event = apnea_detector.feed(time.time(), bpm)
            sleep_result = sleep_classifier.feed(bpm, motion, conf)

            # Publish result
            mqtt_client.publish("csi/respiration", json.dumps({
                "device_id": args.device_id,
                "timestamp": ts,
                "bpm": bpm,
                "confidence": conf,
                "motion_detected": bool(motion),
                "sleep_state": sleep_result.state,
                "sleep_confidence": sleep_result.confidence,
                "apnea_active": apnea_detector.is_in_apnea(),
                "ahi": apnea_detector.calculate_ahi(),
            }))

            # POST to Flask
            try:
                resp = requests.post(
                    f"{args.api_url}/device/{args.device_id}/csi-data",
                    json={
                        "user_id": args.user_id,
                        "bpm": bpm,
                        "confidence": conf,
                        "motion_detected": bool(motion),
                        "sleep_state": sleep_result.state,
                        "timestamp": ts,
                    },
                    timeout=5,
                )
            except requests.exceptions.RequestException:
                pass

            if apnea_event:
                try:
                    requests.post(
                        f"{args.api_url}/device/{args.device_id}/apnea-alert",
                        json={
                            "user_id": args.user_id,
                            "event_type": apnea_event.event_type,
                            "duration_sec": apnea_event.duration_sec,
                            "timestamp": ts,
                        },
                        timeout=5,
                    )
                except requests.exceptions.RequestException:
                    pass

            avg_amp = np.mean([np.mean(f.amplitude) for f in window_frames])
            wf = result.breathing_waveform
            wf_std = float(np.std(wf)) if len(wf) > 0 else 0
            print(f"    frames={buf_size} rate={actual_rate:.0f}Hz amp={avg_amp:.3f} wf_std={wf_std:.4f} | "
                  f"BR={bpm:.1f}/min conf={conf:.2f} motion={motion} "
                  f"sleep={sleep_result.state}")
            if hasattr(result, 'bpm_fft'):
                print(f"    FFT={result.bpm_fft:.1f} Peak={result.bpm_peak:.1f} nPeaks={result.peak_count}")

    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()


if __name__ == "__main__":
    main()
