"""CSI data structures and ESP32 parser — adapted from RuView and ESP32-CSI-Tool."""

import re
import struct
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Dict, Any
import numpy as np


@dataclass
class CSIData:
    """CSI measurement frame from WiFi hardware."""
    timestamp: datetime
    amplitude: np.ndarray          # shape (num_antennas, num_subcarriers)
    phase: np.ndarray              # shape (num_antennas, num_subcarriers)
    frequency: float               # Hz
    bandwidth: float               # Hz
    num_subcarriers: int
    num_antennas: int
    snr: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class ESP32TextParser:
    """Parse ESP32-CSI-Tool (ESP-IDF active_sta) text format.

    Header (from monitor output):
        type,role,mac,rssi,rate,sig_mode,mcs,bandwidth,smoothing,
        not_sounding,aggregation,stbc,fec_coding,sgi,noise_floor,
        ampdu_cnt,channel,secondary_channel,local_timestamp,ant,
        sig_len,rx_state,real_time_set,real_timestamp,len,CSI_DATA

    Data line example:
        CSI_DATA,AP,3C:71:BF:6D:2A:78,-73,11,1,0,1,1,1,0,0,0,0,
        -93,0,1,1,80272146,0,101,0,0,80.363225,384,[101 -48 5 0 ...]

    IQ pairs are in the final [...] as space-separated signed bytes.
    """

    def parse(self, line: str) -> CSIData:
        line = line.strip()
        if not line.startswith("CSI_DATA"):
            raise ValueError(f"Not a CSI_DATA line: {line[:60]}...")

        # Extract the bracket part: [...] containing IQ values
        bracket_match = re.search(r'\[([^\]]*)\]', line)
        if not bracket_match:
            raise ValueError("No CSI IQ data bracket found")

        iq_str = bracket_match.group(1).strip()
        iq_values = [int(x) for x in iq_str.split()]
        if len(iq_values) < 2:
            raise ValueError("Empty IQ data")

        # Everything before the bracket is CSV header fields
        before_bracket = line[:bracket_match.start()].rstrip(',')
        header_parts = before_bracket.split(',')

        # ESP32-CSI-Tool uses 1 antenna by default
        # The "ant" field is the antenna index (0-indexed), not the count
        num_antennas = 1

        # IQ pairs: each pair is one subcarrier's I and Q
        num_subcarriers = len(iq_values) // 2

        real = np.array(iq_values[0::2], dtype=np.float64)
        imag = np.array(iq_values[1::2], dtype=np.float64)

        amplitude = np.sqrt(real ** 2 + imag ** 2).reshape(num_antennas, num_subcarriers)
        phase = np.arctan2(imag, real).reshape(num_antennas, num_subcarriers)

        # Parse RSSI from header (field index 3 = rssi)
        rssi = 0.0
        try:
            rssi = float(header_parts[3]) if len(header_parts) > 3 else -65.0
        except (ValueError, IndexError):
            rssi = -65.0

        # Parse noise floor
        noise_floor = -93.0
        try:
            noise_floor = float(header_parts[14]) if len(header_parts) > 14 else -93.0
        except (ValueError, IndexError):
            noise_floor = -93.0

        snr = rssi - noise_floor

        # Parse channel for frequency
        channel = 6
        try:
            channel = int(header_parts[16]) if len(header_parts) > 16 else 6
        except (ValueError, IndexError):
            channel = 6
        frequency = 2412e6 + (channel - 1) * 5e6  # 2.4 GHz channel to frequency

        # Parse bandwidth from header
        bandwidth = 20e6  # default 20 MHz

        # Parse timestamp
        timestamp = datetime.now(tz=timezone.utc)
        try:
            # real_timestamp field is near the end
            if len(header_parts) >= 2:
                ts_raw = header_parts[-2] if len(header_parts) >= 2 else '0'
                ts_val = float(ts_raw)
                # This is likely seconds since boot, use current time as approximation
                timestamp = datetime.now(tz=timezone.utc)
        except (ValueError, IndexError):
            pass

        return CSIData(
            timestamp=timestamp,
            amplitude=amplitude,
            phase=phase,
            frequency=frequency,
            bandwidth=bandwidth,
            num_subcarriers=num_subcarriers,
            num_antennas=num_antennas,
            snr=snr,
            metadata={
                "source": "esp32_idf",
                "raw_line": line[:200],
                "channel": channel,
            },
        )


class ESP32BinaryParser:
    """Parse ADR-018 binary CSI frames from ESP32 nodes.

    Frame format (little-endian):
        Offset  Size  Field
        0       4     Magic: 0xC5110001
        4       1     Node ID
        5       1     Number of antennas
        6       2     Number of subcarriers (u16 LE)
        8       4     Frequency MHz (u32 LE)
        12      4     Sequence number (u32 LE)
        16      1     RSSI (i8)
        17      1     Noise floor (i8)
        18      2     Reserved
        20      N*2   I/Q pairs (n_antennas * n_subcarriers * 2 bytes, signed i8)
    """

    MAGIC = 0xC5110001
    HEADER_SIZE = 20
    HEADER_FMT = "<IBBHIIBB2x"

    def parse(self, raw_data: bytes) -> CSIData:
        if len(raw_data) < self.HEADER_SIZE:
            raise ValueError(f"Frame too short: need {self.HEADER_SIZE} bytes, got {len(raw_data)}")

        magic, node_id, n_antennas, n_subcarriers, freq_mhz, sequence, rssi_u8, noise_u8 = \
            struct.unpack_from(self.HEADER_FMT, raw_data, 0)

        if magic != self.MAGIC:
            raise ValueError(f"Invalid magic: expected 0x{self.MAGIC:08X}, got 0x{magic:08X}")

        rssi = rssi_u8 if rssi_u8 < 128 else rssi_u8 - 256
        noise_floor = noise_u8 if noise_u8 < 128 else noise_u8 - 256

        iq_count = n_antennas * n_subcarriers
        iq_bytes = iq_count * 2
        expected_len = self.HEADER_SIZE + iq_bytes

        if len(raw_data) < expected_len:
            raise ValueError(f"Frame too short for I/Q: need {expected_len} bytes, got {len(raw_data)}")

        iq_raw = struct.unpack_from(f"<{iq_count * 2}b", raw_data, self.HEADER_SIZE)
        i_vals = np.array(iq_raw[0::2], dtype=np.float64).reshape(n_antennas, n_subcarriers)
        q_vals = np.array(iq_raw[1::2], dtype=np.float64).reshape(n_antennas, n_subcarriers)

        amplitude = np.sqrt(i_vals ** 2 + q_vals ** 2)
        phase = np.arctan2(q_vals, i_vals)

        snr = float(rssi - noise_floor)
        frequency = float(freq_mhz) * 1e6

        if n_subcarriers <= 56:
            bandwidth = 20e6
        elif n_subcarriers <= 114:
            bandwidth = 40e6
        elif n_subcarriers <= 242:
            bandwidth = 80e6
        else:
            bandwidth = 160e6

        return CSIData(
            timestamp=datetime.now(tz=timezone.utc),
            amplitude=amplitude,
            phase=phase,
            frequency=frequency,
            bandwidth=bandwidth,
            num_subcarriers=n_subcarriers,
            num_antennas=n_antennas,
            snr=snr,
            metadata={
                "source": "esp32_binary",
                "node_id": node_id,
                "sequence": sequence,
                "rssi_dbm": rssi,
                "noise_floor_dbm": noise_floor,
                "channel_freq_mhz": freq_mhz,
            },
        )
