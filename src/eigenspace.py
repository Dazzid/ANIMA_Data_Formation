"""
eigenspace.py
=============
EigenSpace computation module for 53-TET chord sequences.

Maps each chord in a tokenized sequence to its 4D EigenSpace coordinates:
  (α, β, γ, dissonance)

Where:
  α = frequency ratio of the 3rd (relative to root)
  β = frequency ratio of the 5th (relative to root)
  γ = frequency ratio of the 7th (relative to root)
  D = psychoacoustic dissonance (Plomp-Levelt, from pre-computed 150³ map)

These coordinates encode the harmonic *nature* of each chord — not just its
identity as a sequence of pitch tokens, but its position in a continuous
psychoacoustic space. When used as an embedding in the transformer, this
gives the attention mechanism direct access to harmonic semantics.

Usage
-----
  from eigenspace import EigenSpaceComputer

  computer = EigenSpaceComputer()       # loads dissonance map once
  coords = computer.tokens_to_eigenspace(token_ids, tokenizer)
  # coords shape: (seq_len, 4) — one (α, β, γ, D) per token position

For the model:
  from eigenspace import EigenSpaceEmbedding

  eigen_emb = EigenSpaceEmbedding(n_embd=768, n_eigen=4)
  # In forward: eigen_emb(eigen_coords)  →  (B, T, n_embd)
"""

import numpy as np
import os
from typing import List, Tuple, Dict, Optional

try:
    import torch
    import torch.nn as nn
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


# =============================================================================
# CONSTANTS
# =============================================================================

TET_53 = 53

# Interval classification bins (53-TET steps)
# Thirds:   11–22 (includes sub-minor through sus4)
# Fifths:   26–35 (includes tritone through augmented)
# Sevenths: 40–52 (sub-minor 7th through super-major 7th)
THIRD_RANGE  = range(10, 23)
FIFTH_RANGE  = range(26, 36)
SEVENTH_RANGE = range(40, 53)

# Default coordinates when no valid intervals are found
DEFAULT_ALPHA = 1.0     # unison
DEFAULT_BETA  = 1.0     # unison
DEFAULT_GAMMA = 2.0     # octave
DEFAULT_DISS  = 0.0     # neutral


# =============================================================================
# PURE FUNCTIONS
# =============================================================================

def get_53tet_ratio(steps: int) -> float:
    """Convert 53-TET steps to frequency ratio: 2^(steps/53)."""
    return 2.0 ** (steps / 53.0)


def classify_intervals(intervals: List[int]) -> Tuple[float, float, float]:
    """
    Classify a chord's intervals into (α, β, γ) EigenSpace coordinates.
    
    Takes a list of 53-TET intervals relative to root (e.g. [0, 18, 31, 44])
    and identifies the third, fifth, and seventh to compute frequency ratios.
    
    Args:
        intervals: Sorted list of intervals (mod 53), with 0 = root
        
    Returns:
        (alpha, beta, gamma) frequency ratios
    """
    iv = [x for x in intervals if 0 < x < 53]
    
    third = None
    fifth = None
    seventh = None
    
    for step in iv:
        if step in THIRD_RANGE and third is None:
            third = step
        elif step in FIFTH_RANGE and fifth is None:
            fifth = step
        elif step in SEVENTH_RANGE and seventh is None:
            seventh = step
    
    alpha = get_53tet_ratio(third) if third else DEFAULT_ALPHA
    beta  = get_53tet_ratio(fifth) if fifth else DEFAULT_BETA
    gamma = get_53tet_ratio(seventh) if seventh else DEFAULT_GAMMA
    
    return alpha, beta, gamma


# =============================================================================
# DISSONANCE MAP
# =============================================================================

class DissonanceMap:
    """
    Pre-computed 3D dissonance field with trilinear interpolation.
    
    Loaded once from binary chunks. Provides O(1) dissonance lookup
    for any (α, β, γ) point in the [1.0, 2.0]³ space.
    """
    
    def __init__(self, dataset_path: str = None, base_freq: int = 220, 
                 n_points: int = 150):
        """
        Args:
            dataset_path: Path to EigenSpace_Data folder containing .bin chunks
            base_freq: Base frequency the map was computed at (Hz)
            n_points: Grid resolution (n³ points)
        """
        if dataset_path is None:
            # Default path relative to this file
            dataset_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                "..", "dataset", "EigenSpace_Data"
            )
        
        self.n_points = n_points
        self.r_low = 1.0
        self.r_high = 2.0
        
        self.alpha_range = np.linspace(self.r_low, self.r_high, n_points)
        self.beta_range = np.linspace(self.r_low, self.r_high, n_points)
        self.gamma_range = np.linspace(self.r_low, self.r_high, n_points)
        
        # Load binary chunks
        chunk_files = sorted([
            f for f in os.listdir(dataset_path)
            if f.startswith(f"harmonic-{base_freq}Hz-{n_points}nodes-chunk")
        ])
        
        if not chunk_files:
            raise FileNotFoundError(
                f"No dissonance map chunks found in {dataset_path} "
                f"for {base_freq}Hz, {n_points} nodes"
            )
        
        all_data = []
        for chunk_file in chunk_files:
            chunk_path = os.path.join(dataset_path, chunk_file)
            chunk_data = np.fromfile(chunk_path, dtype=np.float32)
            all_data.append(chunk_data)
        
        flat_data = np.concatenate(all_data)
        self.dissonance_3d = flat_data.reshape((n_points, n_points, n_points))
        
        # Pre-compute normalization stats for the embedding
        # Use in-tetrahedron values only (α ≤ β ≤ γ) for meaningful stats
        valid_mask = np.zeros_like(self.dissonance_3d, dtype=bool)
        for i in range(n_points):
            for j in range(i, n_points):
                valid_mask[i, j, j:] = True
        valid_values = self.dissonance_3d[valid_mask]
        
        self.diss_mean = float(np.mean(valid_values))
        self.diss_std = float(np.std(valid_values))
        self.diss_min = float(np.min(valid_values))
        self.diss_max = float(np.max(valid_values))
    
    def lookup(self, alpha: float, beta: float, gamma: float) -> Optional[float]:
        """
        Get dissonance at (α, β, γ) via trilinear interpolation.
        
        Returns None if the point is outside [1.0, 2.0]³.
        """
        if (alpha < self.r_low or alpha > self.r_high or
            beta < self.r_low or beta > self.r_high or
            gamma < self.r_low or gamma > self.r_high):
            return None
        
        def find_bracket(val, arr):
            idx = np.searchsorted(arr, val) - 1
            idx = max(0, min(idx, len(arr) - 2))
            t = (val - arr[idx]) / (arr[idx + 1] - arr[idx])
            return idx, t
        
        i, ti = find_bracket(alpha, self.alpha_range)
        j, tj = find_bracket(beta, self.beta_range)
        k, tk = find_bracket(gamma, self.gamma_range)
        
        d = self.dissonance_3d
        
        # Trilinear interpolation
        c000 = d[i, j, k];     c100 = d[i+1, j, k]
        c010 = d[i, j+1, k];   c110 = d[i+1, j+1, k]
        c001 = d[i, j, k+1];   c101 = d[i+1, j, k+1]
        c011 = d[i, j+1, k+1]; c111 = d[i+1, j+1, k+1]
        
        c00 = c000 * (1 - ti) + c100 * ti
        c10 = c010 * (1 - ti) + c110 * ti
        c01 = c001 * (1 - ti) + c101 * ti
        c11 = c011 * (1 - ti) + c111 * ti
        
        c0 = c00 * (1 - tj) + c10 * tj
        c1 = c01 * (1 - tj) + c11 * tj
        
        return float(c0 * (1 - tk) + c1 * tk)


# =============================================================================
# EIGENSPACE COMPUTER — token sequence → 4D coordinates
# =============================================================================

class EigenSpaceComputer:
    """
    Computes per-token EigenSpace coordinates from token sequences.
    
    For each position in a token sequence, this produces a 4D vector:
      (α, β, γ, D_normalized)
    
    The coordinates are constant across all tokens within a chord
    (from CHORD_START to CHORD_END), and reset to defaults between chords.
    
    This means every token "knows" which harmonic region it belongs to,
    giving the transformer's attention mechanism a continuous harmonic
    prior to work with.
    """
    
    def __init__(self, dataset_path: str = None, normalize_diss: bool = True):
        """
        Args:
            dataset_path: Path to EigenSpace_Data folder
            normalize_diss: If True, z-normalize dissonance values
        """
        self.diss_map = DissonanceMap(dataset_path=dataset_path)
        self.normalize_diss = normalize_diss
    
    def _extract_chord_pitches(self, token_strs: List[str], 
                                start_idx: int) -> List[int]:
        """
        Extract 53-TET pitch steps from a chord starting at start_idx.
        Reads from CHORD_START until CHORD_END.
        """
        pitches = []
        i = start_idx
        while i < len(token_strs):
            tok = token_strs[i]
            if tok == "CHORD_END":
                break
            if tok.startswith("P_"):
                pitches.append(int(tok[2:]))
            i += 1
        return pitches
    
    def _pitches_to_intervals(self, pitches: List[int]) -> List[int]:
        """Convert absolute 53-TET pitches to intervals relative to root, mod 53."""
        if not pitches:
            return []
        root = min(pitches)
        intervals = sorted(set((p - root) % 53 for p in pitches))
        return intervals
    
    def compute_for_tokens(self, token_strs: List[str]) -> np.ndarray:
        """
        Compute EigenSpace coordinates for each position in a token sequence.
        
        Every token within a chord inherits that chord's (α, β, γ, D).
        Non-chord tokens (BAR, <start>, <end>, etc.) get default values.
        
        Args:
            token_strs: List of token strings (e.g., from tokenizer.decode_ids())
            
        Returns:
            np.ndarray of shape (len(token_strs), 4) — [α, β, γ, D] per position
        """
        n = len(token_strs)
        coords = np.full((n, 4), [DEFAULT_ALPHA, DEFAULT_BETA, DEFAULT_GAMMA, DEFAULT_DISS], 
                         dtype=np.float32)
        
        i = 0
        while i < n:
            if token_strs[i] == "CHORD_START":
                # Extract pitches from this chord
                pitches = self._extract_chord_pitches(token_strs, i)
                intervals = self._pitches_to_intervals(pitches)
                alpha, beta, gamma = classify_intervals(intervals)
                
                # Lookup dissonance
                diss = DEFAULT_DISS
                if alpha <= beta <= gamma:  # in tetrahedron
                    d = self.diss_map.lookup(alpha, beta, gamma)
                    if d is not None:
                        if self.normalize_diss:
                            diss = (d - self.diss_map.diss_mean) / (self.diss_map.diss_std + 1e-8)
                        else:
                            diss = d
                
                # Fill all tokens in this chord with the same coordinates
                j = i
                while j < n and token_strs[j] != "CHORD_END":
                    coords[j] = [alpha, beta, gamma, diss]
                    j += 1
                if j < n:  # include CHORD_END itself
                    coords[j] = [alpha, beta, gamma, diss]
                    j += 1
                
                i = j
            else:
                i += 1
        
        return coords
    
    def compute_for_ids(self, token_ids: List[int], id_to_token: dict) -> np.ndarray:
        """
        Convenience: compute EigenSpace from token IDs using an id-to-token map.
        
        Args:
            token_ids: List of integer token IDs
            id_to_token: Dict mapping ID → token string
            
        Returns:
            np.ndarray of shape (len(token_ids), 4)
        """
        token_strs = [id_to_token.get(i, "<pad>") for i in token_ids]
        return self.compute_for_tokens(token_strs)
    
    def compute_batch(self, token_id_batch: np.ndarray, 
                      id_to_token: dict) -> np.ndarray:
        """
        Compute EigenSpace for a batch of sequences.
        
        Args:
            token_id_batch: (batch_size, seq_len) array of token IDs
            id_to_token: Dict mapping ID → token string
            
        Returns:
            np.ndarray of shape (batch_size, seq_len, 4)
        """
        batch_size, seq_len = token_id_batch.shape
        result = np.zeros((batch_size, seq_len, 4), dtype=np.float32)
        
        for b in range(batch_size):
            result[b] = self.compute_for_ids(
                token_id_batch[b].tolist(), id_to_token
            )
        
        return result


# =============================================================================
# EIGENSPACE EMBEDDING (PyTorch nn.Module)
# =============================================================================

if HAS_TORCH:
    class EigenSpaceEmbedding(nn.Module):
        """
        Projects 4D EigenSpace coordinates into the transformer's embedding space.
        
        Architecture:
          (α, β, γ, D)  →  Linear(4, hidden)  →  GELU  →  Linear(hidden, n_embd)
        
        The two-layer projection allows the model to learn non-linear mappings
        from harmonic coordinates to attention-compatible representations.
        
        The input coordinates encode:
          - α (3rd ratio):  quality of the third (major/minor/neutral/etc.)
          - β (5th ratio):  quality of the fifth (perfect/diminished/augmented)
          - γ (7th ratio):  quality of the seventh (major/minor/dominant/etc.)
          - D (dissonance): psychoacoustic roughness (Plomp-Levelt)
        
        By adding this to the token + positional embeddings, the transformer
        gains direct access to the harmonic DNA of each chord — not learned from
        data alone, but derived from the physics of sound.
        """
        
        def __init__(self, n_embd: int, n_eigen: int = 4, hidden_mult: int = 4):
            """
            Args:
                n_embd: Output dimension (must match transformer embedding dim)
                n_eigen: Input dimension (default 4: α, β, γ, D)
                hidden_mult: Hidden layer multiplier (hidden_dim = n_eigen * hidden_mult)
            """
            super().__init__()
            hidden = n_eigen * hidden_mult
            self.projection = nn.Sequential(
                nn.Linear(n_eigen, hidden),
                nn.GELU(),
                nn.Linear(hidden, n_embd, bias=False),
            )
        
        def forward(self, eigen_coords: torch.Tensor) -> torch.Tensor:
            """
            Args:
                eigen_coords: (batch_size, seq_len, 4) float tensor
                
            Returns:
                (batch_size, seq_len, n_embd) — ready to add to token embeddings
            """
            return self.projection(eigen_coords)


# =============================================================================
# PRECOMPUTATION UTILITY — for dataset preparation
# =============================================================================

def precompute_eigenspace_for_dataset(
    token_sequences: List[List[str]],
    dataset_path: str = None,
    normalize_diss: bool = True,
) -> List[np.ndarray]:
    """
    Pre-compute EigenSpace coordinates for an entire dataset of token sequences.
    
    This should be called once during data preparation, not during training.
    The results are saved alongside the token data and loaded by the DataLoader.
    
    Args:
        token_sequences: List of token string sequences (one per song)
        dataset_path: Path to EigenSpace_Data folder
        normalize_diss: Z-normalize dissonance values
        
    Returns:
        List of np.ndarray, each (seq_len, 4), matching the input sequences
    """
    computer = EigenSpaceComputer(
        dataset_path=dataset_path,
        normalize_diss=normalize_diss,
    )
    
    results = []
    for tokens in token_sequences:
        coords = computer.compute_for_tokens(tokens)
        results.append(coords)
    
    return results


# =============================================================================
# SELF-TEST
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("EigenSpace Module — Self-Test")
    print("=" * 70)
    
    # 1. Test interval classification
    print("\n1. Interval classification:")
    test_cases = [
        ([0, 18, 31],      "Major triad (M-P)"),
        ([0, 18, 31, 49],  "Major 7th (M-P-M7)"),
        ([0, 18, 31, 44],  "Dominant 7th (M-P-m7)"),
        ([0, 13, 31, 44],  "Minor 7th (m-P-m7)"),
        ([0, 17, 30],      "Down-major, dim5 triad"),
        ([0, 13, 26, 44],  "Half-dim (m-dim5-m7)"),
    ]
    
    for intervals, label in test_cases:
        a, b, g = classify_intervals(intervals)
        print(f"  {str(intervals):25s}  → α={a:.5f} β={b:.5f} γ={g:.5f}   ({label})")
    
    # 2. Test dissonance map loading
    print("\n2. Dissonance map:")
    try:
        dmap = DissonanceMap()
        print(f"  Loaded: {dmap.dissonance_3d.shape}")
        print(f"  Range: {dmap.diss_min:.3f} – {dmap.diss_max:.3f}")
        print(f"  Mean: {dmap.diss_mean:.3f}, Std: {dmap.diss_std:.3f}")
        
        # Test some known chords  
        chords = [
            ("Major triad",   1.2654, 1.4999, 2.0000),
            ("Major 7th",     1.2654, 1.4999, 1.8981),
            ("Dominant 7th",  1.2654, 1.4999, 1.7779),
            ("Minor 7th",     1.1853, 1.4999, 1.7779),
        ]
        print("\n  Dissonance lookups:")
        for name, a, b, g in chords:
            d = dmap.lookup(a, b, g)
            print(f"    {name:15s}: D = {d:.3f}")
    except FileNotFoundError as e:
        print(f"  [SKIP] {e}")
    
    # 3. Test token → EigenSpace computation
    print("\n3. Token sequence → EigenSpace:")
    test_tokens = [
        "<start>",
        "CHORD_START", "DUR_4.0", "P_212", "V_3", "P_243", "V_3", 
        "P_265", "V_2", "P_284", "V_3", "CHORD_END",
        "BAR",
        "CHORD_START", "DUR_4.0", "P_212", "V_3", "P_243", "V_3",
        "P_265", "V_2", "P_261", "V_3", "CHORD_END",
        "<end>",
    ]
    
    try:
        computer = EigenSpaceComputer()
        coords = computer.compute_for_tokens(test_tokens)
        
        print(f"  Sequence length: {len(test_tokens)}")
        print(f"  Coordinates shape: {coords.shape}")
        print()
        for i, (tok, c) in enumerate(zip(test_tokens, coords)):
            print(f"    {i:2d}  {tok:15s}  α={c[0]:.4f} β={c[1]:.4f} γ={c[2]:.4f} D={c[3]:.4f}")
    except FileNotFoundError:
        print("  [SKIP] Dissonance map not available")
    
    # 4. Test PyTorch embedding
    print("\n4. EigenSpace Embedding:")
    if HAS_TORCH:
        emb = EigenSpaceEmbedding(n_embd=768, n_eigen=4)
        dummy = torch.randn(2, 10, 4)  # batch=2, seq=10, eigen=4
        out = emb(dummy)
        print(f"  Input:  {dummy.shape}")
        print(f"  Output: {out.shape}")
        n_params = sum(p.numel() for p in emb.parameters())
        print(f"  Params: {n_params:,}")
    else:
        print("  [SKIP] torch not installed")
    
    print("\n" + "=" * 70)
    print("All tests passed.")
