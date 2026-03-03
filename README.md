[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

# ANIMA — Microtonal Data Formation

**Artificial INtelligence-based Interactive Microtonal Compositional Assistant**
[ANIMA EU Project (101203318)](https://cordis.europa.eu/project/id/101203318)

End-to-end pipeline for training a DistilGPT-2 language model on 53-TET microtonal jazz
chord progressions and generating playable MPE-MIDI with precise pitch bend.

---

## Architecture Overview

```
iReal Pro XML (4,000 standards)
  → MusicXML Parsing & Voicing (7 templates)
    → 12-Key Transposition (×12 = 48,000 songs)
      → 53-TET MPE-MIDI Conversion (×5 tuning systems = 240,310 files)
        → Hierarchical Tokenization → NumPy Sequence Packing
          → DistilGPT-2 Training (A100, SDPA, from scratch)
            → Inference & MPE-MIDI Decoding → Auditory Validation
```

---

## Key Metrics

| Metric | Value |
|--------|-------|
| **Total tokens** | 354,457,590 |
| **Vocabulary size** | 762 |
| **Songs** | 240,310 |
| **Chords** | 30,358,040 |
| **Tokens per chord** | ~11.6 (compressed) |
| **Tuning precision** | 53-TET (22.64 cents/step) |
| **Eval loss** | ~0.58 |
| **Model** | DistilGPT-2 (6 layers, 12 heads, 768 dim) |
| **Training hardware** | NVIDIA A100 80 GB, FP16, SDPA |

---

## Token Hierarchy

Each song is a flat sequence with three nested levels:

```
<START> STYLE_Jazz
  <CHORD_START> ROOT_0 PATTERN_pythagorean PL_18_4 DUR_960
    <MIDI_START> MPE_48_0 MPE_55_p1 MPE_60_0 MPE_64_m1 MPE_67_p2 <MIDI_END>
  <CHORD_END>
  ...
<END>
```

| Level | Tokens | Purpose |
|-------|--------|---------|
| **L0 — Track** | `<START>`, `STYLE_x`, `<END>` | Song boundaries & genre conditioning |
| **L1 — Chord** | `<CHORD_START>`, `ROOT_r`, `PATTERN_p`, `PL_d_d`, `DUR_d` | Harmonic metadata |
| **L2 — Voicing** | `<MIDI_START>`, `MPE_note_bend`, `<MIDI_END>`, `<CHORD_END>` | Physical MPE note events |

The `MPE_note_bend` token encodes MIDI note number and 53-TET microtonal
shift (e.g., `MPE_48_m2` = MIDI 48, −2 steps ≈ −45.3 cents).

---

## Data Files

| File | Format | Description |
|------|--------|-------------|
| `dataset/tokenized_hierarchical/full/tokens.npy` | `int32` | 354M token IDs (all songs concatenated) |
| `dataset/tokenized_hierarchical/full/offsets.npy` | `int64` | Song boundary indices |
| `dataset/tokenized_hierarchical/full/vocab.json` | JSON | Bidirectional `tok ↔ id` mapping |
| `dataset/tokenized_hierarchical/full/stats.json` | JSON | Corpus statistics |

---

## Pipeline Notebooks

| # | Notebook | Stage |
|---|----------|-------|
| 01 | `01_musicXML_parser.ipynb` | iReal Pro XML → structured chord progressions |
| 02 | `02_styles.ipynb` | Genre normalization (15 canonical labels) |
| 03 | `03_load_and_prepare.ipynb` | Dataset loading & preparation |
| 04 | `04_53TET_conversion.ipynb` | 12-TET → 53-TET mapping |
| 05 | `05_play_mpe53.ipynb` | MPE-MIDI playback verification |
| 06 | `06_data_augmentation_53edo.ipynb` | 5 tuning systems × 48k songs |
| 07 | `07_compare_12tet_53tet.ipynb` | Tuning system comparison |
| 08 | `08_MPE_Microtonal_Tokenizer.ipynb` | Hierarchical tokenizer → `.npy` arrays |
| 09 | `09_distilgpt2_training.ipynb` | DistilGPT-2 training (HuggingFace Trainer) |
| 10 | `10_inference_and_auditory_validation.ipynb` | Generation, MIDI decoding, microtonal playback |

---

## Quick Start: Generate a Song

```python
import json, torch
from pathlib import Path
from transformers import GPT2LMHeadModel

# Load model & vocabulary
model = GPT2LMHeadModel.from_pretrained('models/distilgpt2_53tet/final')
model.eval()

vocab = json.loads(Path('dataset/tokenized_hierarchical/full/vocab.json').read_text())
tok2id = vocab['tok2id']
id2tok = {int(k): v for k, v in vocab['id2tok'].items()}

# Generate
prompt = torch.tensor([[tok2id['<START>'], tok2id['STYLE_Jazz']]])
with torch.no_grad():
    out = model.generate(prompt, max_new_tokens=400, temperature=0.9,
                         top_k=50, do_sample=True, pad_token_id=tok2id['<END>'])

tokens = [id2tok[int(i)] for i in out[0]]
print(' '.join(tokens[:30]))
```

For full MIDI rendering and inline microtonal playback, see notebook **10** (`TokenToMIDI` + `MicrotonalSynth`).

---

## Tuning Systems (53-TET Patterns)

Five diatonic interval patterns define the microtonal landscape:

| Alias | Step Pattern | Temperament |
|-------|-------------|-------------|
| `pythagorean` | 9-9-4-9-9-9-4 | Pythagorean |
| `just_major` | 9-8-5-9-8-9-5 | Just intonation |
| `meantone` | 8-8-6-8-8-8-7 | Quarter-comma meantone |
| `equal_53` | 8-8-5-8-8-9-7 | 53-TET equal |
| `septimal` | 9-7-6-9-8-8-6 | Septimal |

---

## Plomp-Levelt Dissonance

Each chord carries a psychoacoustic dissonance token (`PL_d_d`) computed via
the Plomp-Levelt model with 6-harmonic spectral analysis. This enables
the model to learn tension-resolution patterns as a continuous feature,
independent of chord-name abstractions.

---

## Requirements

```
numpy
mido
tqdm
matplotlib
torch
transformers
datasets
accelerate
```

---

## Repository Structure

```
├── dataset/
│   ├── iRealXML/            # ~4,000 iReal Pro XML chord charts
│   ├── metadata/            # Song metadata JSONs (style, key, form)
│   ├── midi_files/
│   │   ├── mpe/             # 12-TET MPE MIDI
│   │   └── mpe53/           # 53-TET MPE MIDI (5 tuning subdirs)
│   └── tokenized_hierarchical/
│       ├── full/            # Production: tokens.npy, offsets.npy, vocab.json
│       └── test/            # Quick-test subset
├── src/
│   ├── 01–10 notebooks       # Pipeline stages (see table above)
│   ├── voicing.py            # 7 voicing templates
│   ├── transposition.py      # 12-key transposition
│   ├── formats.py            # Chord parsing utilities
│   ├── utils.py              # Dataset & MIDI utilities
│   └── xmlTranslator.py      # iReal XML parser
├── 53_reference_notes.json  # 53-TET frequency/bend lookup table
├── requirements.txt
└── README.md
```

---

## License

This project is licensed under **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.
See [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) for details.