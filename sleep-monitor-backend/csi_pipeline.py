"""CSI → Respiration Rate Signal Processing Pipeline (v2).

Improved approach:
  1. Select Top-5 subcarriers by variance (not just one)
  2. PCA reduce to 1-D respiratory waveform
  3. Butterworth bandpass filter (0.1-0.5 Hz)
  4. Dual BR estimation: FFT + peak detection, fused with confidence
  5. Motion detection via rolling variance

Based on: Applied Sciences 2024 paper + GPT-advised refinements.
"""

import numpy as np
from scipy import signal
from scipy.signal import detrend
from sklearn.decomposition import PCA
from typing import List, Tuple
from dataclasses import dataclass

from csi_data import CSIData


@dataclass
class RespirationResult:
    bpm: float
    confidence: float           # 0.0–1.0
    motion_detected: bool
    breathing_waveform: np.ndarray
    motion_segments: List[Tuple[int, int]]
    # Diagnostic fields
    bpm_fft: float = 0.0
    bpm_peak: float = 0.0
    peak_count: int = 0


class RespirationExtractor:
    """Extract respiration rate from CSI frames using PCA + Butterworth + dual-BR."""

    def __init__(
        self,
        sampling_rate: float = 20.0,
        num_top_subcarriers: int = 5,
        bandpass_low: float = 0.15,     # Hz = 9 BPM (reject slow drift)
        bandpass_high: float = 0.5,     # Hz = 30 BPM
        bandpass_order: int = 2,
        motion_std_threshold: float = 5.0,
        min_bpm: float = 6.0,
        max_bpm: float = 30.0,
    ):
        self.sampling_rate = sampling_rate
        self.num_top = num_top_subcarriers
        self.bandpass_low = bandpass_low
        self.bandpass_high = bandpass_high
        self.bandpass_order = bandpass_order
        self.motion_std_threshold = motion_std_threshold
        self.min_bpm = min_bpm
        self.max_bpm = max_bpm
        self.pca = PCA(n_components=1)

        # Design Butterworth once
        nyq = sampling_rate / 2
        self._b, self._a = signal.butter(
            bandpass_order,
            [bandpass_low / nyq, bandpass_high / nyq],
            btype="band",
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_window(self, csi_frames: List[CSIData]) -> RespirationResult:
        n = len(csi_frames)
        if n < 20:
            return self._empty_result(motion=False)

        # Step 1: Extract amplitude matrix (n_frames, n_subcarriers)
        amps_2d = self._stack_amplitudes(csi_frames)

        # Step 2: Select Top-K subcarriers by variance
        topk_amps = self._select_topk_subcarriers(amps_2d)

        # Step 3: PCA → 1-D respiratory waveform
        try:
            resp_raw = self._pca_reduce(topk_amps)
        except Exception:
            return self._empty_result(motion=False)

        # Detrend to remove slow drift that dominates FFT
        resp_raw = detrend(resp_raw)

        # Step 4: Butterworth bandpass filter
        try:
            resp_filtered = signal.filtfilt(self._b, self._a, resp_raw)
        except Exception:
            return self._empty_result(motion=False)

        # Step 5: Motion detection (use raw waveform — motion is broadband, not just breathing band)
        motion_segs, motion_flag = self._detect_motion(resp_raw)

        # Step 6: Dual BR estimation
        bpm, conf, bpm_fft, bpm_peak, peak_count = self._dual_br_estimate(resp_filtered, motion_segs)

        return RespirationResult(
            bpm=round(bpm, 1),
            confidence=round(conf, 2),
            motion_detected=motion_flag,
            breathing_waveform=resp_filtered,
            motion_segments=motion_segs,
            bpm_fft=bpm_fft,
            bpm_peak=bpm_peak,
            peak_count=peak_count,
        )

    # ------------------------------------------------------------------
    # Step implementations
    # ------------------------------------------------------------------

    def _stack_amplitudes(self, frames: List[CSIData]) -> np.ndarray:
        """Stack amplitude arrays into (n_frames, n_subcarriers)."""
        # Flatten antenna dim
        amps = np.array([f.amplitude for f in frames])  # (n, n_ant, n_sc)
        return amps.reshape(len(frames), -1)

    def _select_topk_subcarriers(self, amps_2d: np.ndarray) -> np.ndarray:
        """Select Top-K subcarriers with highest variance."""
        variances = np.var(amps_2d, axis=0)
        k = min(self.num_top, len(variances))
        top_indices = np.argsort(variances)[-k:]
        return amps_2d[:, top_indices]

    def _pca_reduce(self, topk_amps: np.ndarray) -> np.ndarray:
        """PCA reduce multi-subcarrier data to 1-D respiratory signal."""
        # Standardize before PCA
        mean = np.mean(topk_amps, axis=0)
        std = np.std(topk_amps, axis=0)
        std[std < 1e-12] = 1.0
        scaled = (topk_amps - mean) / std
        return self.pca.fit_transform(scaled).flatten()

    def _detect_motion(self, waveform: np.ndarray) -> Tuple[List[Tuple[int, int]], bool]:
        """Detect body motion from rolling variance of the filtered waveform."""
        win = max(10, int(self.sampling_rate * 1.5))  # ~1.5 second window
        if win >= len(waveform) // 2:
            return [], False

        roll_std = np.array([
            np.std(waveform[max(0, i - win):min(len(waveform), i + win)])
            for i in range(len(waveform))
        ])

        med_std = np.median(roll_std)
        mad = np.median(np.abs(roll_std - med_std))
        if mad < 1e-12:
            return [], False

        z = (roll_std - med_std) / (mad * 1.4826)  # robust z-score
        motion_mask = np.abs(z) > self.motion_std_threshold
        segs = _mask_to_segments(motion_mask)
        return segs, len(segs) > 0

    def _dual_br_estimate(
        self, waveform: np.ndarray, motion_segments: List[Tuple[int, int]]
    ) -> Tuple[float, float, float, float, int]:
        """Estimate BR using both FFT and peak detection; fuse with confidence.
        Returns: (bpm, conf, bpm_fft, bpm_peak, peak_count)"""

        # --- FFT route ---
        n = len(waveform)
        n_fft = max(4096, 2 ** int(np.ceil(np.log2(n))))
        # Detrend to suppress low-frequency drift
        detrended = detrend(waveform)
        windowed = detrended * np.hanning(n)
        fft = np.abs(np.fft.rfft(windowed, n=n_fft))
        freqs = np.fft.rfftfreq(n_fft, d=1.0 / self.sampling_rate)
        mask = (freqs >= self.bandpass_low) & (freqs <= self.bandpass_high)

        bpm_fft = 0.0
        if np.any(mask):
            peak_idx = np.argmax(fft[mask])
            peak_freq = freqs[mask][peak_idx]
            bpm_fft = peak_freq * 60
            if bpm_fft < self.min_bpm or bpm_fft > self.max_bpm:
                bpm_fft = 0.0

        # --- Peak counting route ---
        motion_mask = np.zeros(n, dtype=bool)
        for s, e in motion_segments:
            motion_mask[max(0, s):min(n, e + 1)] = True

        clean = waveform.copy()
        clean[motion_mask] = 0.0

        height = np.std(clean) * 0.15
        min_dist = int(self.sampling_rate * 1.0)  # ~1 second min between breaths
        peaks, props = signal.find_peaks(clean, distance=max(1, min_dist), height=height)
        valid_peaks = peaks[~motion_mask[peaks]]
        n_breaths = len(valid_peaks)
        duration_sec = n / self.sampling_rate
        bpm_peak = (n_breaths / duration_sec) * 60 if duration_sec > 0 else 0.0
        bpm_peak = np.clip(bpm_peak, self.min_bpm, self.max_bpm)

        # --- Fusion ---
        if bpm_fft > 0 and bpm_peak > 0:
            # Both methods agree → high confidence
            diff = abs(bpm_fft - bpm_peak)
            if diff <= 2:
                bpm = (bpm_fft + bpm_peak) / 2
                conf = 0.8 + 0.2 * (1 - diff / 2)
            elif diff <= 5:
                bpm = bpm_fft * 0.6 + bpm_peak * 0.4
                conf = 0.5
            else:
                # Large disagreement → weighted average, not just FFT
                bpm = bpm_fft * 0.4 + bpm_peak * 0.6
                conf = 0.3
        elif bpm_fft > 0:
            bpm = bpm_fft
            conf = 0.4
        elif bpm_peak > 0:
            bpm = bpm_peak
            conf = 0.4
        else:
            bpm = 0.0
            conf = 0.0

        # Penalize for motion
        motion_ratio = float(motion_mask.sum()) / n
        conf = max(0.0, conf - motion_ratio * 0.4)

        return (
            round(bpm, 1),
            round(min(1.0, max(0.0, conf)), 2),
            round(bpm_fft, 1),
            round(bpm_peak, 1),
            n_breaths,
        )

    def _empty_result(self, motion: bool) -> RespirationResult:
        return RespirationResult(
            bpm=0.0, confidence=0.0, motion_detected=motion,
            breathing_waveform=np.array([]), motion_segments=[],
        )


def _mask_to_segments(mask: np.ndarray) -> List[Tuple[int, int]]:
    segs = []
    in_seg = False
    start = 0
    for i, v in enumerate(mask):
        if v and not in_seg:
            start = i; in_seg = True
        elif not v and in_seg:
            segs.append((start, i - 1)); in_seg = False
    if in_seg:
        segs.append((start, len(mask) - 1))
    return segs
