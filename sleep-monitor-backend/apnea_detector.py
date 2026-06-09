"""Sleep apnea detection — adapted from RuView apnea_screener.py.

Clinical thresholds:
  - Apnea: breathing absent for > 10 seconds
  - Hypopnea: breathing rate < 6 breaths/min
  - AHI (Apnea-Hypopnea Index):
      < 5   Normal
      5-14  Mild OSA
      15-29 Moderate OSA
      >= 30 Severe OSA
"""

import time
from collections import deque
from typing import List, Tuple, Optional
from dataclasses import dataclass


APNEA_THRESHOLD_SEC = 10.0       # Breathing absent > 10s = apnea event
HYPOPNEA_BR_THRESHOLD = 6.0      # BR < 6/min = hypopnea (shallow breathing)


@dataclass
class ApneaEvent:
    start_time: float
    end_time: float
    duration_sec: float
    event_type: str  # "apnea" or "hypopnea"


class ApneaDetector:
    """Detect apnea/hypopnea events from respiration rate stream."""

    def __init__(self):
        self.apnea_events: List[ApneaEvent] = []
        self.hypopnea_events: List[ApneaEvent] = []

        self._br_history: deque = deque()  # (timestamp, bpm)
        self._last_nonzero_time: float = time.time()
        self._in_apnea: bool = False
        self._apnea_start: float = 0.0
        self._in_hypopnea: bool = False
        self._hypopnea_start: float = 0.0
        self._start_time: float = time.time()

    def feed(self, timestamp: float, bpm: float) -> Optional[ApneaEvent]:
        """Feed a new respiration reading. Returns ApneaEvent if one just ended."""
        self._br_history.append((timestamp, bpm))

        # Limit history to last 5 minutes
        while len(self._br_history) > 300:  # 5 min at 1 sample/sec
            self._br_history.popleft()

        event = None

        # ---- Apnea detection ----
        if bpm > 0:
            self._last_nonzero_time = timestamp

            if self._in_apnea:
                duration = timestamp - self._apnea_start
                event = ApneaEvent(
                    start_time=self._apnea_start,
                    end_time=timestamp,
                    duration_sec=round(duration, 1),
                    event_type="apnea",
                )
                self.apnea_events.append(event)
                self._in_apnea = False

        elif bpm == 0 and not self._in_apnea:
            gap = timestamp - self._last_nonzero_time
            if gap >= APNEA_THRESHOLD_SEC:
                self._in_apnea = True
                self._apnea_start = self._last_nonzero_time

        # ---- Hypopnea detection ----
        if 0 < bpm < HYPOPNEA_BR_THRESHOLD and not self._in_hypopnea:
            self._in_hypopnea = True
            self._hypopnea_start = timestamp

        elif bpm >= HYPOPNEA_BR_THRESHOLD and self._in_hypopnea:
            duration = timestamp - self._hypopnea_start
            if duration >= 10:  # only record if sustained > 10s
                h_event = ApneaEvent(
                    start_time=self._hypopnea_start,
                    end_time=timestamp,
                    duration_sec=round(duration, 1),
                    event_type="hypopnea",
                )
                self.hypopnea_events.append(h_event)
                event = h_event
            self._in_hypopnea = False

        return event

    def calculate_ahi(self) -> float:
        """Calculate Apnea-Hypopnea Index (events per hour)."""
        hours_elapsed = max((time.time() - self._start_time) / 3600.0, 0.01)
        total_events = len(self.apnea_events) + len(self.hypopnea_events)
        return round(total_events / hours_elapsed, 1)

    def classify_severity(self) -> str:
        """Classify OSA severity based on AHI."""
        ahi = self.calculate_ahi()
        if ahi < 5:
            return "Normal"
        elif ahi < 15:
            return "Mild OSA"
        elif ahi < 30:
            return "Moderate OSA"
        else:
            return "Severe OSA"

    def get_summary(self) -> dict:
        """Return current detection summary."""
        return {
            "apnea_count": len(self.apnea_events),
            "hypopnea_count": len(self.hypopnea_events),
            "ahi": self.calculate_ahi(),
            "severity": self.classify_severity(),
            "in_apnea": self._in_apnea,
            "latest_apnea": (
                self.apnea_events[-1].duration_sec if self.apnea_events else None
            ),
        }

    def is_in_apnea(self) -> bool:
        return self._in_apnea
