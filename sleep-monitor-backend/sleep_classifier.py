"""Sleep/awake classification — adapted from RuView vitals_suite.py _classify_sleep.

RuView's original uses HR + BR from mmWave radar. Since WiFi CSI can
reliably extract BR but not always HR, this version is adapted to work
with BR variability + body motion index.

When HR data becomes available (future work), uncomment HR rules for
full 4-stage classification (awake/light/deep/REM).
"""

from collections import deque
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class SleepClassification:
    state: str           # "awake", "sleeping"
    confidence: float    # 0.0–1.0


class SleepClassifier:
    """Rule-based sleep/awake classifier using breathing pattern analysis.

    Rules (adapted from vitals_suite._classify_sleep):
      - High motion + irregular BR → Awake
      - Stable BR (12–20 bpm) + low motion → Sleeping
      - Sudden BR change (> 50% of recent mean) → likely awakening/rollover
    """

    def __init__(self, window_size: int = 30):
        self.window_size = window_size
        self._br_history: deque = deque(maxlen=window_size)
        self._motion_history: deque = deque(maxlen=window_size)
        self._current_state = "awake"
        self._state_changes: deque = deque(maxlen=100)  # (timestamp, new_state)

    def feed(self, bpm: float, motion_detected: bool, confidence: float) -> SleepClassification:
        """Feed one respiration window result and return current sleep state.

        Args:
            bpm: Respiration rate in breaths per minute.
            motion_detected: Whether body motion was detected in this window.
            confidence: Signal confidence from RespirationExtractor (0–1).
        """
        self._br_history.append(bpm)
        self._motion_history.append(1 if motion_detected else 0)

        if len(self._br_history) < 5:
            return SleepClassification(state="awake", confidence=0.5)

        brs = list(self._br_history)
        motions = list(self._motion_history)

        # --- Feature extraction ---
        recent_brs = [b for b in brs if b > 0]  # exclude zero-BPM (apnea periods)

        if len(recent_brs) < 3:
            state = "awake"
        else:
            mean_br = sum(recent_brs) / len(recent_brs)
            br_variance = sum((b - mean_br) ** 2 for b in recent_brs) / len(recent_brs)
            br_cv = (br_variance ** 0.5) / mean_br if mean_br > 0 else 1.0  # coefficient of variation
            motion_ratio = sum(motions[-10:]) / min(len(motions), 10)  # recent motion fraction

            # --- Classification rules (relaxed for 2 Hz CSI) ---
            # Very high motion = awake
            if motion_ratio > 0.7:
                state = "awake"
            # BR out of physiological sleep range
            elif mean_br > 28 or mean_br < 5:
                state = "awake"
            # Stable BR + low motion = sleeping (relaxed thresholds)
            elif 6 <= mean_br <= 24 and br_cv < 0.35 and motion_ratio < 0.5:
                state = "sleeping"
            # Moderate BR stability + not high motion
            elif 10 <= mean_br <= 22 and br_cv < 0.25:
                state = "sleeping"
            else:
                state = "awake"

        # Track state transition
        if state != self._current_state:
            self._state_changes.append((len(self._state_changes), state))
            self._current_state = state

        # Confidence: based on how consistent the evidence is
        conf = 0.0
        if len(recent_brs) >= 5:
            br_cv_conf = max(0.0, 1.0 - br_cv * 3)  # lower CV = higher confidence
            motion_conf = 1.0 - motion_ratio
            conf = 0.4 * br_cv_conf + 0.4 * motion_conf + 0.2 * confidence

        return SleepClassification(state=state, confidence=round(min(1.0, conf), 2))

    def get_current_state(self) -> str:
        return self._current_state

    def get_average_br(self) -> Optional[float]:
        """Average BR over the recent window."""
        brs = [b for b in list(self._br_history) if b > 0]
        if not brs:
            return None
        return round(sum(brs) / len(brs), 1)
