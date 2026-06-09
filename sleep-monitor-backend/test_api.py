"""模拟ESP32发送测试数据到Flask API

Usage:
    python test_api.py --count 10 --interval 2

用于测试Flask后端API是否正常工作。
"""

import argparse
import requests
import time
import random
from datetime import datetime


def send_test_data(api_url, device_id, user_id=1):
    """发送一条测试数据"""
    timestamp = datetime.now().isoformat()

    data = {
        "user_id": user_id,
        "bpm": random.randint(12, 20),  # 呼吸率 12-20
        "confidence": round(random.uniform(0.7, 0.99), 2),
        "motion_detected": random.choice([True, False, False]),
        "sleep_state": random.choice(["awake", "light_sleep", "deep_sleep", "rem"]),
        "timestamp": timestamp,
    }

    try:
        resp = requests.post(
            f"{api_url}/device/{device_id}/csi-data",
            json=data,
            timeout=5,
        )

        if resp.status_code == 200:
            print(f"[OK] {timestamp[11:19]} - BPM={data['bpm']}, state={data['sleep_state']}, conf={data['confidence']}")
            return True
        else:
            print(f"[ERR] 状态码: {resp.status_code} - {resp.text[:100]}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"[ERR] 无法连接到 {api_url}")
        print(f"      请确保Flask后端正在运行!")
        return False
    except Exception as e:
        print(f"[ERR] 错误: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="测试Flask API连接")
    parser.add_argument("--api-url", default="http://localhost:5000/api",
                        help="Flask API基础URL")
    parser.add_argument("--device-id", default="ESP-001",
                        help="设备ID")
    parser.add_argument("--user-id", type=int, default=1,
                        help="用户ID")
    parser.add_argument("--count", type=int, default=10,
                        help="发送次数")
    parser.add_argument("--interval", type=float, default=2.0,
                        help="发送间隔(秒)")
    args = parser.parse_args()

    print("="*60)
    print("  ESP32 模拟数据发送测试")
    print("="*60)
    print(f"API URL: {args.api_url}")
    print(f"设备ID: {args.device_id}")
    print(f"用户ID: {args.user_id}")
    print(f"发送次数: {args.count}")
    print(f"发送间隔: {args.interval}秒")
    print("="*60)
    print()

    # 测试API连接
    print("步骤1: 测试API连接...")
    try:
        resp = requests.get(f"{args.api_url.replace('/api', '')}", timeout=5)
        print(f"  [OK] Flask后端运行正常")
        print(f"       响应: {resp.json()}")
    except Exception as e:
        print(f"  [ERR] 无法连接到Flask后端!")
        print(f"        错误: {e}")
        print()
        print("请先启动Flask后端:")
        print("  cd D:\\maxproject\\sleep-monitor-backend")
        print("  python app.py")
        return

    print()
    print("步骤2: 发送测试数据...")
    success_count = 0
    for i in range(args.count):
        if send_test_data(args.api_url, args.device_id, args.user_id):
            success_count += 1

        if i < args.count - 1:
            time.sleep(args.interval)

    print()
    print("="*60)
    print(f"  测试完成: {success_count}/{args.count} 成功")
    print("="*60)

    if success_count == args.count:
        print()
        print("✓ 系统测试通过!")
        print("  可以开始使用ESP32进行真实的睡眠监测了。")
    else:
        print()
        print("✗ 部分测试失败，请检查网络连接。")


if __name__ == "__main__":
    main()
