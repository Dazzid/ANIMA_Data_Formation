// ============================================================================
// CONFIGURATION FLAGS
// ============================================================================
const ENABLE_DISTANCE_LINES = false; // Set to false to disable line rendering for better performance

// Audio mute state (controlled by ADSR mute button)
window.audioMuted = false;

// Dissonance calculation (Plomp-Levelt)
// Global storage for computed dissonance data
let globalDissonanceData = null;
let currentBaseFreq = 220.0;
let cachedHarmonicNodes = null; // Cache node positions (in ratio space)
let visualizationMode = 'sectioned'; // 'sectioned' or 'full3d'

const zoneSize = 4.0;
const zoneFull = 2.5;
const chordSize = 7.0;
const localMinSize = 9.0;

// Keyboard shortcuts for root note selection
const keyToFreq = {
    'q': 130.81,   // C3
    '2': 138.59,   // C#3
    'w': 146.83,   // D3
    '3': 155.56,   // D#3
    'e': 164.81,   // E3
    'r': 174.61,   // F3
    '5': 185.00,   // F#3
    't': 196.00,   // G3
    '6': 207.65,   // G#3
    'y': 220.00,   // A3
    '7': 233.08,   // A#3
    'u': 246.94,   // B3
    'i': 261.63    // C4
};

const freqToName = {
    130.81: 'C3', 138.59: 'C#3', 146.83: 'D3', 155.56: 'D#3',
    164.81: 'E3', 174.61: 'F3', 185.00: 'F#3', 196.00: 'G3',
    207.65: 'G#3', 220.00: 'A3', 233.08: 'A#3', 246.94: 'B3', 261.63: 'C4'
};

//Second version of the dissonance measure with less selective parameters
function dissmeasure(fvec, amp, model = "min") {
    const sorted = fvec.map((f, i) => [f, amp[i]]).sort((a, b) => a[0] - b[0]);
    const fr_sorted = sorted.map(x => x[0]);
    const am_sorted = sorted.map(x => x[1]);

    const Dstar = 0.24;
    const S1 = 0.0207;
    const S2 = 18.96;
    const C1 = 5;
    const C2 = -5;
    const A1 = -3.51;
    const A2 = -5.75;

    let total = 0;
    for (let i = 0; i < fr_sorted.length; i++) {
        for (let j = i + 1; j < fr_sorted.length; j++) {
            const Fmin = fr_sorted[i];
            const S = Dstar / (S1 * Fmin + S2);
            const Fdif = fr_sorted[j] - fr_sorted[i];
            const a = model === "min" ? Math.min(am_sorted[i], am_sorted[j]) : am_sorted[i] * am_sorted[j];
            const SFdif = S * Fdif;
            total += a * (C1 * Math.exp(A1 * SFdif) + C2 * Math.exp(A2 * SFdif));
        }
    }
    return total;
}

// Helper function to calculate dissonance at a specific point
function calculateDissonanceAt(alpha, beta, gamma, baseFreq, numHarmonics, model = "min") {
    const freqBase = [];
    const ampBase = [];
    for (let h = 1; h <= numHarmonics; h++) {
        freqBase.push(baseFreq * h);
        ampBase.push(1.0);
    }

    const freqAlpha = freqBase.map(f => f * alpha);
    const freqBeta = freqBase.map(f => f * beta);
    const freqGamma = freqBase.map(f => f * gamma);

    const allFreq = freqBase.concat(freqAlpha, freqBeta, freqGamma);
    const allAmp = ampBase.concat(ampBase, ampBase, ampBase);

    return dissmeasure(allFreq, allAmp, model);
}

// Stochastic refinement - "shake" nodes to find true minimum
function refineNodeStochastic(node, baseFreq, numHarmonics, iterations = 100) {
    let bestAlpha = node.alpha;
    let bestBeta = node.beta;
    let bestGamma = node.gamma;
    let bestDiss = node.dissonance;

    const initialStep = 0.015;
    let stepSize = initialStep;
    let noImprovement = 0;

    for (let i = 0; i < iterations; i++) {
        const testAlpha = bestAlpha + (Math.random() - 0.5) * stepSize;
        const testBeta = bestBeta + (Math.random() - 0.5) * stepSize;
        const testGamma = bestGamma + (Math.random() - 0.5) * stepSize;

        if (testAlpha >= 1.0 && testAlpha <= 2.0 &&
            testBeta >= 1.0 && testBeta <= 2.0 &&
            testGamma >= 1.0 && testGamma <= 2.0 &&
            testAlpha <= testBeta && testBeta <= testGamma) {

            const testDiss = calculateDissonanceAt(testAlpha, testBeta, testGamma, baseFreq, numHarmonics);

            if (testDiss < bestDiss) {
                bestAlpha = testAlpha;
                bestBeta = testBeta;
                bestGamma = testGamma;
                bestDiss = testDiss;
                noImprovement = 0;
                stepSize = initialStep;
            } else {
                noImprovement++;
            }
        }

        if (noImprovement > 10) {
            stepSize *= 0.8;
            noImprovement = 0;
        }
    }

    return { alpha: bestAlpha, beta: bestBeta, gamma: bestGamma, dissonance: bestDiss };
}

// Audio synthesis with p5.sound -----------------------------------------------------
let audioCtx;
let reverbNode;
let audioInitialized = false;

// Track currently playing oscillators so we can stop them
let currentlyPlaying = [];

// Audio parameters - controlled by GUI
let audioParams = {
    waveType: 'sine',
    attack: 0.2,
    sustain: 1.5, // Max 2 seconds total
    release: 0.3,
    attackLevel: 1.0,    // peak amplitude after attack
    sustainLevel: 0.7,    // sustain amplitude level
    dryWet: 0.25
};

// Create reverb impulse response
function createReverb() {
    const convolver = audioCtx.createConvolver();
    const rate = audioCtx.sampleRate;
    const length = rate * 2;
    const impulse = audioCtx.createBuffer(2, length, rate);

    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
    }
    convolver.buffer = impulse;
    return convolver;
}

// Initialize audio on first user interaction
async function initAudio() {
    if (audioInitialized) return;

    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        await audioCtx.resume();
        reverbNode = createReverb();
        reverbNode.connect(audioCtx.destination);

        // PRE-WARM: Play a silent note to prime the audio graph
        const warmupOsc = audioCtx.createOscillator();
        const warmupGain = audioCtx.createGain();
        warmupGain.gain.value = 0.0001;
        warmupOsc.connect(warmupGain);
        warmupGain.connect(audioCtx.destination);
        warmupOsc.start();
        warmupOsc.stop(audioCtx.currentTime + 0.01);

        audioInitialized = true;

    } catch (e) {
        console.error('Audio initialization failed:', e);
    }
}

// Play single note (for keyboard mapping) -------------------------------------------------------------
async function playNote(frequency) {
    // console.log(`[playNote] Called with frequency: ${frequency}`);

    // ALWAYS send MIDI first (independent of audio mute)
    let noteId = null;
    if (window.midiController && window.midiController.midiEnabled && window.midiController.selectedOutput) {
        // Send single note with MPE (don't stop all notes - let keyup handle it)
        noteId = window.midiController.playSingleNote(frequency);
        // console.log(`[playNote] MIDI sent for ${frequency.toFixed(2)} Hz, noteId: ${noteId}`);
    }

    // Check if audio is muted - if so, skip web audio playback
    if (window.audioMuted) {
        console.log('[playNote] Audio is muted, skipping web audio playback');
        return;
    }

    // Initialize audio if needed
    if (!audioInitialized) {
        console.log('[playNote] Audio not initialized, initializing...');
        await initAudio();
        if (!audioInitialized) {
            console.error('[playNote] Audio initialization failed');
            return;
        }
    }

    if (!audioCtx || !reverbNode) {
        console.error('[playNote] audioCtx or reverbNode missing');
        return;
    }

    const t = audioCtx.currentTime + 0.01;
    const harmonics = [1, 2, 3, 4, 5, 6];
    const amplitudes = [1, 0.41, 0.333, 0.27, 0.13, 0.11];

    // console.log(`[playNote] Creating note at ${frequency.toFixed(2)} Hz, startTime: ${t.toFixed(3)}`);

    // Create a single note with harmonics
    createNote(frequency, harmonics, amplitudes, t, false);

    // Return the note ID so caller can stop it later
    return noteId;
}

// Make playNote available globally
window.playNote = playNote;

// Play chord with given frequency ratios -------------------------------------------------------------
// Debounce tracking
let lastClickTime = 0;
const MIN_CLICK_INTERVAL = 50; // milliseconds between clicks

async function playChord(alpha, beta, gamma, baseFreq = 220.0) {
    // Debounce rapid clicks
    const now = Date.now();
    if (now - lastClickTime < MIN_CLICK_INTERVAL) {
        console.log('[Debounce] Click ignored - too fast');
        return;
    }
    lastClickTime = now;

    if (!audioInitialized) {
        await initAudio();
        // If initialization failed, don't continue
        if (!audioInitialized) return;
    }

    if (!audioCtx || !reverbNode) {
        return;
    }

    // Stop any currently playing audio to prevent overlap
    //stopAllAudio();

    // Update chord visualization
    if (typeof setChordVisualization === 'function') {
        setChordVisualization(alpha, beta, gamma, baseFreq);
    }

    const t = audioCtx.currentTime + 0.06; // Small delay to allow fadeout
    const harmonics = [1, 2, 3, 4, 5, 6];
    const amplitudes = [1, 0.41, 0.333, 0.27, 0.13, 0.11];

    // Get doubling flags from chord visualization
    const doublingFlags = typeof window.getDoublingFlags === 'function' ?
        window.getDoublingFlags() : { R: false, α: false, β: false, γ: false };

    // Build frequency array with doubling applied: [root, alpha, beta, gamma]
    const baseFrequencies = [baseFreq, alpha * baseFreq, beta * baseFreq, gamma * baseFreq];
    const doublingLabels = ['R', 'α', 'β', 'γ'];
    const actualFrequencies = baseFrequencies.map((freq, i) =>
        doublingFlags[doublingLabels[i]] ? freq * 2 : freq
    );

    // Update dynamic keyboard mapping with doubled frequencies (responds to x2)
    if (typeof window.updateKeyboardMapping === 'function') {
        window.updateKeyboardMapping(baseFrequencies);
    }

    // Update MIDI Piano scale with ORIGINAL frequencies (ignores x2 buttons)
    if (typeof window.updateMidiPianoScale === 'function') {
        window.updateMidiPianoScale(baseFrequencies);
    }

    // Send MIDI/MPE output if controller is available and connected
    if (window.midiController && window.midiController.midiEnabled && window.midiController.selectedOutput) {
        // Stop previous chord notes only (not keyboard notes from MIDI Piano)
        window.midiController.stopChordNotes();

        // Calculate dissonance for velocity mapping
        const dissonance = calculateDissonanceAt(alpha, beta, gamma, baseFreq, 6);

        // Send MIDI note-on with doubled frequencies
        window.midiController.playChord(actualFrequencies, dissonance);
    }

    // Check if audio is muted - if so, skip audio generation
    if (window.audioMuted) {
        return;
    }

    // Apply frequency doubling based on flags
    const ratios = [1, alpha, beta, gamma];
    const labels = ['R', 'α', 'β', 'γ'];

    for (let i = 0; i < ratios.length; i++) {
        const baseNoteFreq = baseFreq * ratios[i];
        const isDoubled = doublingFlags[labels[i]];
        const actualFreq = isDoubled ? baseNoteFreq * 2 : baseNoteFreq;
        createNote(actualFreq, harmonics, amplitudes, t, isDoubled);
    }
}

// Stop currently playing MIDI chord (note-off) -------------------------------------------------------------
function stopMIDIChord() {
    if (window.midiController && window.midiController.midiEnabled && window.midiController.selectedOutput) {
        window.midiController.stopChordNotes();
    }
}

// Create Note with ADSR envelope and amplitude levels -------------------------------------------------
function createNote(freq, harmonics, amplitudes, startTime, isDoubled = false) {
    const masterGain = audioCtx.createGain();
    const dryGain = audioCtx.createGain();
    const wetGain = audioCtx.createGain();

    // console.log(audioParams.dryWet);

    // Equal-power crossfade (prevents volume dip in middle)
    dryGain.gain.value = Math.sqrt(1.0 - audioParams.dryWet);
    wetGain.gain.value = Math.sqrt(audioParams.dryWet) * 2.0;

    masterGain.connect(dryGain);
    masterGain.connect(wetGain);
    dryGain.connect(audioCtx.destination);
    wetGain.connect(reverbNode);

    // Reduce gain for doubled (higher octave) frequencies
    const baseGain = 0.15; // 0.20 = louder, clip on consonant chords
    const doubledGainReduction = 0.7; // Reduce to 70% of original gain for doubled frequencies
    masterGain.gain.value = isDoubled ? baseGain * doubledGainReduction : baseGain;

    // Create each harmonic as separate oscillator
    for (let i = 0; i < harmonics.length; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = audioParams.waveType;
        osc.frequency.value = freq * harmonics[i];

        osc.connect(gain);
        gain.connect(masterGain);

        // Track this oscillator so we can stop it if needed
        currentlyPlaying.push({
            oscillator: osc,
            gainNode: gain
        });

        let attack = audioParams.attack;
        let sustain = audioParams.sustain;
        let release = audioParams.release;

        // Envelope with amplitude control
        const attackAmp = amplitudes[i] * audioParams.attackLevel;
        const sustainAmp = amplitudes[i] * audioParams.sustainLevel;

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(attackAmp, startTime + attack);
        gain.gain.exponentialRampToValueAtTime(sustainAmp, startTime + attack + sustain);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + attack + sustain + release);

        const length = attack + sustain + release;
        osc.start(startTime);
        osc.stop(startTime + length);

        // Remove from tracking when it naturally ends
        osc.addEventListener('ended', () => {
            const index = currentlyPlaying.findIndex(item => item.oscillator === osc);
            if (index !== -1) {
                currentlyPlaying.splice(index, 1);
            }
        });
    }
}

// Function to stop all currently playing audio
function stopAllAudio() {
    const currentTime = audioCtx ? audioCtx.currentTime : 0;

    for (let playingItem of currentlyPlaying) {
        try {
            // Quick fade out to avoid clicks
            if (playingItem.gainNode) {
                playingItem.gainNode.gain.cancelScheduledValues(currentTime);
                playingItem.gainNode.gain.setValueAtTime(playingItem.gainNode.gain.value, currentTime);
                playingItem.gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.05);
            }

            // Stop oscillator after fade
            if (playingItem.oscillator) {
                playingItem.oscillator.stop(currentTime + 0.05);
            }
        } catch (e) {
            // Oscillator might already be stopped, ignore errors
        }
    }

    // Clear the tracking array
    currentlyPlaying = [];
}
//End audio synthesis ------------------------------------------------------------------

function get12tetRatio(semitones) {
    return Math.pow(2, semitones / 12.0);
}

function get53tetRatio(steps) {
    return Math.pow(2, steps / 53.0);
}

function get31tetRatio(steps) {
    return Math.pow(2, steps / 31.0);
}

function get12TETChordPositions() {
    const chords = [];
    const r = get12tetRatio;
    // Standard voicings (within one octave)
    chords.push(
        ["maj7", r(4), r(7), r(11)],
        ["min7", r(3), r(7), r(10)],
        ["dom7", r(4), r(7), r(10)],
        ["ø7", r(3), r(6), r(10)],
        ["o7", r(3), r(6), r(9)],
        ["minmaj7", r(3), r(7), r(11)],
        ["7sus2", r(2), r(7), r(10)],
        ["7sus4", r(5), r(7), r(10)],
        ["maj6", r(4), r(7), r(9)],
        ["min6", r(3), r(7), r(9)],
        ["power", r(5), r(7), r(12)],
        ["sus2", r(2), r(5), r(7)],
        // ["iim7", r(2), r(5), r(12)]
    );
    return chords;
}

function get31TETChordPositions() {
    const chords = [];

    // 31-TET interval mappings
    const thirds = {
        sm: 7,   // subminor third
        m: 8,    // minor third
        n: 9,    // neutral third
        M: 10,   // major third
        SM: 11   // supermajor third
    };

    const fifths = {
        dim: 17,  // diminished fifth
        P: 18,    // perfect fifth
        aug: 19   // augmented fifth
    };

    const sevenths = {
        sm: 24,  // subminor seventh
        m: 25,   // minor seventh
        n: 27,   // neutral seventh
        M: 28,   // major seventh
        SM: 29   // supermajor seventh
    };

    const r = get31tetRatio;

    // Supermajor third chords
    chords.push(
        ["SMSM7", r(11), r(18), r(29)],
        ["SMM7", r(11), r(18), r(28)],
        ["SMn7", r(11), r(18), r(27)],
        ["SMm7", r(11), r(18), r(26)],
        ["SMsm7", r(11), r(18), r(25)]
    );

    // Major third chords
    chords.push(
        ["MSM7", r(10), r(18), r(29)],
        ["Maj7", r(10), r(18), r(28)],
        ["Mn7", r(10), r(18), r(27)],
        ["Dom7", r(10), r(18), r(26)],
        ["Msm7", r(10), r(18), r(25)]
    );

    // Neutral third chords
    chords.push(
        ["nSM7", r(9), r(18), r(29)],
        ["nM7", r(9), r(18), r(28)],
        ["nn7", r(9), r(18), r(27)],
        ["nm7", r(9), r(18), r(26)],
        ["nsm7", r(9), r(18), r(25)]
    );

    // Minor third chords
    chords.push(
        ["mSM7", r(8), r(18), r(29)],
        ["mM7", r(8), r(18), r(28)],
        ["mn7", r(8), r(18), r(27)],
        ["min7", r(8), r(18), r(26)],
        ["msm7", r(8), r(18), r(25)]
    );

    // Subminor third chords
    chords.push(
        ["smSM7", r(7), r(18), r(29)],
        ["smM7", r(7), r(18), r(28)],
        ["smn7", r(7), r(18), r(27)],
        ["smm7", r(7), r(18), r(26)],
        ["smsm7", r(7), r(18), r(25)]
    );

    // Half-diminished (minor third + diminished fifth + minor seventh)
    chords.push(
        ["ø7", r(8), r(16), r(26)]
    );

    // Diminished (minor third + diminished fifth + diminished seventh)
    chords.push(
        ["o7", r(8), r(16), r(21)]
    );

    // Augmented (major third + augmented fifth + minor seventh)
    chords.push(
        ["M+7", r(10), r(16), r(21)]
    );

    return chords;
}

function get53TETChordPositions() {
    const chords = [];

    // Interval mappings from the wheel
    const thirds = {
        sm: 11, vm: 12, m: 13, '^m': 14, n: 15,
        N: 16, vM: 17, M: 18, '^M': 19, SM: 20
    };

    const fifths = {
        subdim: 29, dim: 30, vP: 30, P: 31, '^P': 32, aug: 32, upaug: 33
    };

    const sevenths = {
        sm: 42, vm: 43, m: 44, '^m': 45, n: 46,
        N: 47, vM: 48, M: 49, '^M': 50, SM: 51
    };

    const r = get53tetRatio;

    // Super-major combinations
    chords.push(
        ["SMSM7", r(20), r(31), r(51)],
        ["SM^M7", r(20), r(31), r(50)],
        ["SMmaj7", r(20), r(31), r(49)],
        ["SMvM7", r(20), r(31), r(48)],
        ["SMN7", r(20), r(31), r(47)],
        ["SMn7", r(20), r(31), r(46)],
        ["SM^m7", r(20), r(31), r(45)],
        ["SMm7", r(20), r(31), r(44)],
        ["SMvm7", r(20), r(31), r(43)],
        ["SMsm7", r(20), r(31), r(42)]
    );

    // Up-major combinations
    chords.push(
        ["^MSM7", r(19), r(31), r(51)],
        ["^M^M7", r(19), r(31), r(50)],
        ["^Mmaj7", r(19), r(31), r(49)],
        ["^MvM7", r(19), r(31), r(48)],
        ["^MN7", r(19), r(31), r(47)],
        ["^Mn7", r(19), r(31), r(46)],
        ["^M^m7", r(19), r(31), r(45)],
        ["^Mm7", r(19), r(31), r(44)],
        ["^Mvm7", r(19), r(31), r(43)],
        ["^Msm7", r(19), r(31), r(42)]
    );

    // Major combinations
    chords.push(
        ["MSM7", r(18), r(31), r(51)],
        ["M^M7", r(18), r(31), r(50)],
        ["maj7", r(18), r(31), r(49)],
        ["MvM7", r(18), r(31), r(48)],
        ["MN7", r(18), r(31), r(47)],
        ["Mn7", r(18), r(31), r(46)],
        ["M^m7", r(18), r(31), r(45)],
        ["Mm7", r(18), r(31), r(44)],
        ["Mvm7", r(18), r(31), r(43)],
        ["Msm7", r(18), r(31), r(42)]
    );

    // Down-major combinations
    chords.push(
        ["vMSM7", r(17), r(31), r(51)],
        ["vM^M7", r(17), r(31), r(50)],
        ["vMmaj7", r(17), r(31), r(49)],
        ["vMvM7", r(17), r(31), r(48)],
        ["vMN7", r(17), r(31), r(47)],
        ["vMn7", r(17), r(31), r(46)],
        ["vM^m7", r(17), r(31), r(45)],
        ["vMm7", r(17), r(31), r(44)],
        ["vMvm7", r(17), r(31), r(43)],
        ["vMsm7", r(17), r(31), r(42)]
    );

    // Neutral-major combinations
    chords.push(
        ["NSM7", r(16), r(31), r(51)],
        ["N^M7", r(16), r(31), r(50)],
        ["Nmaj7", r(16), r(31), r(49)],
        ["NvM7", r(16), r(31), r(48)],
        ["NN7", r(16), r(31), r(47)],
        ["Nn7", r(16), r(31), r(46)],
        ["N^m7", r(16), r(31), r(45)],
        ["Nm7", r(16), r(31), r(44)],
        ["Nvm7", r(16), r(31), r(43)],
        ["Nsm7", r(16), r(31), r(42)]
    );

    // Neutral-minor combinations
    chords.push(
        ["nSM7", r(15), r(31), r(51)],
        ["n^M7", r(15), r(31), r(50)],
        ["nmaj7", r(15), r(31), r(49)],
        ["nvM7", r(15), r(31), r(48)],
        ["nN7", r(15), r(31), r(47)],
        ["nn7", r(15), r(31), r(46)],
        ["n^m7", r(15), r(31), r(45)],
        ["nm7", r(15), r(31), r(44)],
        ["nvm7", r(15), r(31), r(43)],
        ["nsm7", r(15), r(31), r(42)]
    );

    // Up-minor combinations
    chords.push(
        ["^mSM7", r(14), r(31), r(51)],
        ["^m^M7", r(14), r(31), r(50)],
        ["^mmaj7", r(14), r(31), r(49)],
        ["^mvM7", r(14), r(31), r(48)],
        ["^mN7", r(14), r(31), r(47)],
        ["^mn7", r(14), r(31), r(46)],
        ["^m^m7", r(14), r(31), r(45)],
        ["^mm7", r(14), r(31), r(44)],
        ["^mvm7", r(14), r(31), r(43)],
        ["^msm7", r(14), r(31), r(42)]
    );

    // Minor combinations
    chords.push(
        ["mSM7", r(13), r(31), r(51)],
        ["m^M7", r(13), r(31), r(50)],
        ["mmaj7", r(13), r(31), r(49)],
        ["mvM7", r(13), r(31), r(48)],
        ["mN7", r(13), r(31), r(47)],
        ["mn7", r(13), r(31), r(46)],
        ["m^m7", r(13), r(31), r(45)],
        ["m7", r(13), r(31), r(44)],
        ["mvm7", r(13), r(31), r(43)],
        ["msm7", r(13), r(31), r(42)],
    );

    // Down-minor combinations
    chords.push(
        ["vmSM7", r(12), r(31), r(51)],
        ["vm^M7", r(12), r(31), r(50)],
        ["vmmaj7", r(12), r(31), r(49)],
        ["vmvM7", r(12), r(31), r(48)],
        ["vmN7", r(12), r(31), r(47)],
        ["vmn7", r(12), r(31), r(46)],
        ["vm^m7", r(12), r(31), r(45)],
        ["vm7", r(12), r(31), r(44)],
        ["vmvm7", r(12), r(31), r(43)],
        ["vmsm7", r(12), r(31), r(42)]
    );

    // Sub-minor combinations
    chords.push(
        ["smSM7", r(11), r(31), r(51)],
        ["sm^M7", r(11), r(31), r(50)],
        ["smmaj7", r(11), r(31), r(49)],
        ["smvM7", r(11), r(31), r(48)],
        ["smN7", r(11), r(31), r(47)],
        ["smn7", r(11), r(31), r(46)],
        ["sm^m7", r(11), r(31), r(45)],
        ["sm7", r(11), r(31), r(44)],
        ["smvm7", r(11), r(31), r(43)],
        ["smsm7", r(11), r(31), r(42)]
    );

    // Half diminished upminor combinations
    chords.push(
        ["øSM7", r(14), r(26), r(51)],
        ["ø^M7", r(14), r(26), r(50)],
        ["ømaj7", r(14), r(26), r(49)],
        ["øvM7", r(14), r(26), r(48)],
        ["øN7", r(14), r(26), r(47)],
        ["øn7", r(14), r(26), r(46)],
        ["ø^m7", r(14), r(26), r(45)],
        ["ø7", r(14), r(26), r(44)],
        ["øvm7", r(14), r(26), r(43)],
        ["øsm7", r(14), r(26), r(42)]
    );

    // Half-Diminished minor combinations
    chords.push(
        ["øS7", r(13), r(26), r(51)],
        ["ø^M7-m", r(13), r(26), r(50)],
        ["ømaj7-m", r(13), r(26), r(49)],
        ["øvM7-m", r(13), r(26), r(48)],
        ["øNM7", r(13), r(26), r(47)],
        ["øn7-m", r(13), r(26), r(46)],
        ["øv7", r(13), r(26), r(45)],
        ["ø7-m", r(13), r(26), r(44)],
        ["øvm7-m", r(13), r(26), r(43)],
        ["øsm7-m", r(13), r(26), r(42)]
    );

    // Half Diminished downminor combinations
    chords.push(
        ["vøS7", r(12), r(26), r(51)],
        ["vø^M7", r(12), r(26), r(50)],
        ["vømaj7", r(12), r(26), r(49)],
        ["vøvM7", r(12), r(26), r(48)],
        ["vøN7", r(12), r(26), r(47)],
        ["vøn7", r(12), r(26), r(46)],
        ["vø^m7", r(12), r(26), r(45)],
        ["vø7", r(12), r(26), r(44)],
        ["vøvm7", r(12), r(26), r(43)],
        ["vøsm7", r(12), r(26), r(42)]
    );

    // Half Diminished subminor combinations
    chords.push(
        ["søS7", r(11), r(26), r(51)],
        ["sø^M7", r(11), r(26), r(50)],
        ["sømaj7", r(11), r(26), r(49)],
        ["søvM7", r(11), r(26), r(48)],
        ["søN7", r(11), r(26), r(47)],
        ["søn7", r(11), r(26), r(46)],
        ["sø^m7", r(11), r(26), r(45)],
        ["sø7", r(11), r(26), r(44)],
        ["søvm7", r(11), r(26), r(43)],
        ["søsm7", r(11), r(26), r(42)]
    );

    // Augmented combinations
    chords.push(
        ["M+S7", r(18), r(35), r(51)],
        ["M+^M7", r(18), r(35), r(50)],
        ["M+maj7", r(18), r(35), r(49)],
        ["M+vM7", r(18), r(35), r(48)],
        ["M+NM7", r(18), r(35), r(47)],
        ["M+N7", r(18), r(35), r(46)],
        ["M+n7", r(18), r(35), r(45)],
        ["M+m7", r(18), r(35), r(44)],
        ["M+vm7", r(18), r(35), r(43)],
        ["M+sm7", r(18), r(35), r(42)]
    );

    chords.push(
        ["7sus4", r(22), r(31), r(44)],
        ["sus2", r(9), r(22), r(31)]
    );

    // //Dominant # 4th chords
    // chords.push(
    //     ["Mn7#4", r(18), r(35), r(46)],
    //     ["M^7#4", r(18), r(35), r(45)],
    //     ["M7#4", r(18), r(35), r(44)],
    //     ["Mv7#4", r(18), r(35), r(43)],
    //     ["Mvv7#4", r(18), r(35), r(42)],
    // );

    return chords;
}

function linspace(start, end, num) {
    const arr = [];
    const step = (end - start) / (num - 1);
    for (let i = 0; i < num; i++) {
        arr.push(start + step * i);
    }
    return arr;
}

async function calculate3dDissonanceMap(baseFreq, rLow, rHigh, nPoints, numHarmonics, method = "min") {
    const alphaRange = linspace(rLow, rHigh, nPoints);
    const betaRange = linspace(rLow, rHigh, nPoints);
    const gammaRange = linspace(rLow, rHigh, nPoints);

    const freqBase = Array.from({ length: numHarmonics }, (_, i) => baseFreq * (i + 1));
    const ampBase = Array(numHarmonics).fill(1);

    const dissonance3d = [];

    for (let i = 0; i < nPoints; i++) {
        const linearProgress = i / nPoints;
        const easedProgress = 1 - Math.pow(1 - linearProgress, 2);
        const percent = Math.round(100 * easedProgress);

        document.getElementById('progress-container').style.display = 'block';
        document.getElementById('progress-bar').style.setProperty('--progress', `${percent}%`);
        document.getElementById('progress-text').textContent = `Computing: ${percent}%`;
        document.getElementById('click-output').style.display = 'none';

        await new Promise(resolve => setTimeout(resolve, 0)); // Let browser repaint

        dissonance3d[i] = [];
        for (let j = 0; j < nPoints; j++) {
            dissonance3d[i][j] = [];
            for (let k = j; k < nPoints; k++) {
                const alpha = alphaRange[i];
                const beta = betaRange[j];
                const gamma = gammaRange[k];

                if (!(alpha <= beta && beta <= gamma)) {
                    dissonance3d[i][j][k] = NaN;
                    continue;
                }

                const f = [
                    ...freqBase,
                    ...freqBase.map(x => x * alpha),
                    ...freqBase.map(x => x * beta),
                    ...freqBase.map(x => x * gamma)
                ];
                const a = [...ampBase, ...ampBase, ...ampBase, ...ampBase];
                dissonance3d[i][j][k] = dissmeasure(f, a, method);
            }
        }
    }

    return { alphaRange, betaRange, gammaRange, dissonance3d };
}

function findHarmonicNodes(alphaRange, betaRange, gammaRange, dissonance3d, numNodes = 15, filterSize = 5) {
    const nodes = [];
    const stepSize = (alphaRange[alphaRange.length - 1] - alphaRange[0]) / alphaRange.length;
    const boundaryMargin = Math.max(3, Math.floor(0.1 * alphaRange.length));
    const prominenceRadius = Math.max(6, filterSize * 2);

    // Find local minima
    for (let i = boundaryMargin; i < alphaRange.length - boundaryMargin; i++) {
        for (let j = boundaryMargin; j < betaRange.length - boundaryMargin; j++) {
            for (let k = boundaryMargin; k < gammaRange.length - boundaryMargin; k++) {
                const value = dissonance3d[i][j][k];
                if (isNaN(value)) continue;

                const alphaVal = alphaRange[i];
                const betaVal = betaRange[j];
                const gammaVal = gammaRange[k];

                // Check spacing
                if (Math.abs(alphaVal - betaVal) < stepSize * 2 || Math.abs(betaVal - gammaVal) < stepSize * 2) {
                    continue;
                }

                // Check if local minimum
                let isMin = true;
                for (let di = -filterSize; di <= filterSize && isMin; di++) {
                    for (let dj = -filterSize; dj <= filterSize && isMin; dj++) {
                        for (let dk = -filterSize; dk <= filterSize && isMin; dk++) {
                            if (di === 0 && dj === 0 && dk === 0) continue;
                            const ni = i + di, nj = j + dj, nk = k + dk;
                            if (ni >= 0 && ni < alphaRange.length && nj >= 0 && nj < betaRange.length && nk >= 0 && nk < gammaRange.length) {
                                if (value >= dissonance3d[ni][nj][nk]) {
                                    isMin = false;
                                }
                            }
                        }
                    }
                }

                if (!isMin) continue;

                // Calculate prominence
                let maxInRadius = value;
                for (let di = -prominenceRadius; di <= prominenceRadius; di++) {
                    for (let dj = -prominenceRadius; dj <= prominenceRadius; dj++) {
                        for (let dk = -prominenceRadius; dk <= prominenceRadius; dk++) {
                            const ni = i + di, nj = j + dj, nk = k + dk;
                            if (ni >= 0 && ni < alphaRange.length && nj >= 0 && nj < betaRange.length && nk >= 0 && nk < gammaRange.length) {
                                if (!isNaN(dissonance3d[ni][nj][nk])) {
                                    maxInRadius = Math.max(maxInRadius, dissonance3d[ni][nj][nk]);
                                }
                            }
                        }
                    }
                }

                const prominence = maxInRadius - value;
                if (prominence < 0.001) continue;

                // Calculate gradient
                let gradientSum = 0, gradientCount = 0;
                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        for (let dk = -1; dk <= 1; dk++) {
                            if (di === 0 && dj === 0 && dk === 0) continue;
                            const ni = i + di, nj = j + dj, nk = k + dk;
                            if (ni >= 0 && ni < alphaRange.length && nj >= 0 && nj < betaRange.length && nk >= 0 && nk < gammaRange.length) {
                                if (!isNaN(dissonance3d[ni][nj][nk])) {
                                    gradientSum += Math.abs(dissonance3d[ni][nj][nk] - value);
                                    gradientCount++;
                                }
                            }
                        }
                    }
                }

                const avgGradient = gradientCount > 0 ? gradientSum / gradientCount : 0;
                const curvature = prominence * (1 + avgGradient * 10);

                nodes.push({ alpha: alphaVal, beta: betaVal, gamma: gammaVal, dissonance: value, curvature });
            }
        }
    }

    nodes.sort((a, b) => b.curvature - a.curvature);
    return nodes.slice(0, numNodes);
}

function percentile(arr, p) {
    const sorted = arr.filter(x => !isNaN(x)).sort((a, b) => a - b);
    const index = Math.floor(sorted.length * p / 100);
    return sorted[index];
}

// Look up dissonance value at a specific point (with interpolation)
function getDissonanceAtPoint(alpha, beta, gamma, alphaRange, betaRange, gammaRange, dissonance3d) {
    // Find nearest indices
    let iAlpha = 0, iBeta = 0, iGamma = 0;
    let minDistAlpha = Infinity, minDistBeta = Infinity, minDistGamma = Infinity;

    for (let i = 0; i < alphaRange.length; i++) {
        const dist = Math.abs(alphaRange[i] - alpha);
        if (dist < minDistAlpha) {
            minDistAlpha = dist;
            iAlpha = i;
        }
    }

    for (let j = 0; j < betaRange.length; j++) {
        const dist = Math.abs(betaRange[j] - beta);
        if (dist < minDistBeta) {
            minDistBeta = dist;
            iBeta = j;
        }
    }

    for (let k = 0; k < gammaRange.length; k++) {
        const dist = Math.abs(gammaRange[k] - gamma);
        if (dist < minDistGamma) {
            minDistGamma = dist;
            iGamma = k;
        }
    }

    // Return the dissonance value at nearest point
    const value = dissonance3d[iAlpha][iBeta][iGamma];
    return isNaN(value) ? null : value;
}

function createVisualization(data, baseFreq, numNodes = 15) {
    const { alphaRange, betaRange, gammaRange, dissonance3d } = data;

    // Sample the data exactly as in the reference implementation
    const sampleRate = 2;
    const xData = [], yData = [], zData = [], dData = [];

    for (let i = 0; i < alphaRange.length; i += sampleRate) {
        for (let j = 0; j < betaRange.length; j += sampleRate) {
            for (let k = 0; k < gammaRange.length; k += sampleRate) {
                const d = dissonance3d[i][j][k];
                if (!isNaN(d)) {
                    xData.push(alphaRange[i]);
                    yData.push(betaRange[j]);
                    zData.push(gammaRange[k]);
                    dData.push(d);
                }
            }
        }
    }

    // Sort all data points by z-coordinate (gamma) once for proper depth perception in both modes
    const sortedIndices = Array.from({ length: xData.length }, (_, i) => i)
        .sort((a, b) => zData[a] - zData[b]);

    // Create sorted arrays (keep originals intact)
    const sortedXData = sortedIndices.map(i => xData[i]);
    const sortedYData = sortedIndices.map(i => yData[i]);
    const sortedZData = sortedIndices.map(i => zData[i]);
    const sortedDData = sortedIndices.map(i => dData[i]);

    // Compute percentile bounds from the sampled scalar values (TypedArrays don't flatten with flat())
    const vmin = percentile(dData, 5);
    const vmax = percentile(dData, 95);

    const traces = [];
    const myColor = [
        [0.0, 'rgba(0, 0, 255, 1)'],
        [0.25, 'rgba(0, 200, 255, 1)'],
        [0.5, 'rgba(255, 255, 255, 1)'],
        [0.75, 'rgba(255, 200, 0, 1)'],
        [1.0, 'rgba(255, 0, 0, 1)']
    ];

    // ========== CREATE FULL 3D TRACE (first trace, initially hidden) ==========
    // Use stratified sampling to ensure all dissonance ranges are represented
    const samplingRate = 0.2;
    const sampledX = [], sampledY = [], sampledZ = [], sampledD = [];

    // Group points by dissonance range to ensure even distribution
    const numBins = 10;
    const binSize = (vmax - vmin) / numBins;
    const bins = Array.from({ length: numBins }, () => []);

    // Distribute points into bins
    for (let i = 0; i < xData.length; i++) {
        const d = dData[i];
        if (isNaN(d) || d < vmin || d > vmax) continue;

        const binIndex = Math.min(Math.floor((d - vmin) / binSize), numBins - 1);
        if (binIndex >= 0 && binIndex < numBins) {
            bins[binIndex].push(i);
        }
    }

    // Sample from each bin proportionally
    for (let bin of bins) {
        if (bin.length === 0) continue;

        const sampleCount = Math.ceil(bin.length * samplingRate);
        const sampledIndices = new Set();

        while (sampledIndices.size < sampleCount && sampledIndices.size < bin.length) {
            const randomIndex = Math.floor(Math.random() * bin.length);
            sampledIndices.add(bin[randomIndex]);
        }

        for (let idx of sampledIndices) {
            sampledX.push(xData[idx]);
            sampledY.push(yData[idx]);
            sampledZ.push(zData[idx]);
            sampledD.push(dData[idx]);
        }
    }

    // Sort sampled data by z-coordinate (gamma) from low to high for proper depth perception from top view
    const sampledPoints = sampledX.map((x, i) => ({
        x: x,
        y: sampledY[i],
        z: sampledZ[i],
        d: sampledD[i]
    })).sort((a, b) => a.z - b.z); // Low z-values rendered first (appear behind when viewed from top)

    const sortedSampledX = sampledPoints.map(p => p.x);
    const sortedSampledY = sampledPoints.map(p => p.y);
    const sortedSampledZ = sampledPoints.map(p => p.z);
    const sortedSampledD = sampledPoints.map(p => p.d);

    // Add full zone-node visualization as the FIRST trace
    traces.push({
        type: 'scatter3d',
        mode: 'markers',
        x: sortedSampledX,
        y: sortedSampledY,
        z: sortedSampledZ,
        marker: {
            symbol: 'square', //circle , square , diamond , cross , x , triangle , pentagon , hexagram , star , hourglass , bowtie , asterisk , hash , y , and line
            size: zoneFull,
            color: sortedSampledD,
            colorscale: myColor,
            cmin: vmin,
            cmax: vmax,
            showscale: false,  // Hide Plotly colorbar - we use P5 instead
            opacity: 0.5
        },
        name: 'Full 3D View',
        visible: false,  // Start hidden; toggle button will show this trace
        hovertemplate: '<span style="font-family:Source Code Pro">' +
            '<b>Ratios</b><br>' +
            'α = %{x:.4f}<br>' +
            'β = %{y:.4f}<br>' +
            'γ = %{z:.4f}' +
            '</span><extra></extra>'
    });

    // Gaussian curve point distribution
    let numLayers = 200;
    let windowSize = (vmax - vmin) / 50;
    let thresholds = linspace(vmin, vmax, numLayers);
    const tracesPerLayer = ENABLE_DISTANCE_LINES ? 2 : 1;

    // ========== CREATE SECTIONED LAYER TRACES ==========
    for (let i = 0; i < numLayers; i++) {
        const threshold = thresholds[i];
        const layerX = [], layerY = [], layerZ = [], layerD = [];

        const lowerBound = threshold - windowSize / 2;
        const upperBound = threshold + windowSize / 2;
        const minSpacing = 0.0;

        // Data is already sorted by z-coordinate, so filtering preserves depth order
        for (let j = 0; j < sortedXData.length; j++) {
            if (sortedDData[j] >= lowerBound && sortedDData[j] <= upperBound) {
                const alpha = sortedXData[j];
                const beta = sortedYData[j];
                const gamma = sortedZData[j];

                if ((alpha - 1.0) < minSpacing ||
                    (beta - alpha) < minSpacing ||
                    (gamma - beta) < minSpacing) {
                    continue;
                }

                layerX.push(alpha);
                layerY.push(beta);
                layerZ.push(gamma);
                layerD.push(sortedDData[j]);
            }
        }

        if (layerX.length === 0) continue;

        // CONDITIONAL: Create lines only if ENABLE_DISTANCE_LINES is true
        if (ENABLE_DISTANCE_LINES) {
            const lineX = [], lineY = [], lineZ = [];
            const lineColors = [];
            const maxDistance = 0.02;
            const maxConnectionsPerPoint = 6;

            for (let p = 0; p < layerX.length; p++) {
                const neighbors = [];
                for (let q = 0; q < layerX.length; q++) {
                    if (p === q) continue;
                    const dist = Math.sqrt(
                        Math.pow(layerX[p] - layerX[q], 2) +
                        Math.pow(layerY[p] - layerY[q], 2) +
                        Math.pow(layerZ[p] - layerZ[q], 2)
                    );
                    if (dist < maxDistance) {
                        neighbors.push({ q, dist });
                    }
                }

                neighbors.sort((a, b) => a.dist - b.dist);
                neighbors.slice(0, maxConnectionsPerPoint).forEach(n => {
                    const avgDiss = (layerD[p] + layerD[n.q]) / 2;
                    lineX.push(layerX[p], layerX[n.q], null);
                    lineY.push(layerY[p], layerY[n.q], null);
                    lineZ.push(layerZ[p], layerZ[n.q], null);
                    lineColors.push(avgDiss, avgDiss, avgDiss);
                });
            }

            if (lineX.length > 0) {
                traces.push({
                    type: 'scatter3d',
                    mode: 'lines',
                    x: lineX,
                    y: lineY,
                    z: lineZ,
                    line: {
                        color: lineColors,
                        colorscale: myColor,
                        cmin: vmin,
                        cmax: vmax,
                        width: 1.0
                    },
                    showlegend: false,
                    hoverinfo: 'skip',
                    visible: i === 0,
                    opacity: 0.5
                });
            }
        }

        // Add zone point trace
        traces.push({
            type: 'scatter3d',
            mode: 'markers',
            x: layerX,
            y: layerY,
            z: layerZ,
            marker: {
                symbol: 'pentagon', //circle , square , diamond , cross , x , triangle , pentagon , hexagram , star , hourglass , bowtie , asterisk , hash , y , and line
                size: zoneSize,
                color: layerD,
                colorscale: myColor,
                cmin: vmin,
                cmax: vmax,
                showscale: false,  // Hide Plotly colorbar - we use P5 instead
                opacity: 0.7
            },
            name: `${(threshold - windowSize / 2).toFixed(3)} - ${(threshold + windowSize / 2).toFixed(3)}`,
            visible: i === 0, // Only first layer visible
            hovertemplate: '<span style="font-family:Source Code Pro">' +
                '<b>Ratios</b><br>' +
                'α = %{x:.4f}<br>' +
                'β = %{y:.4f}<br>' +
                'γ = %{z:.4f}' +
                '</span><extra></extra>'
        });
    }

    // ========== ADD CHORD MARKERS (both modes) ==========

    // Find nodes - only calculate once, then reuse the cached positions
    if (cachedHarmonicNodes === null) {
        const rawNodes = findHarmonicNodes(alphaRange, betaRange, gammaRange, dissonance3d, numNodes, 5);

        // Refine nodes with stochastic search
        console.log('Refining nodes with stochastic search...');
        cachedHarmonicNodes = rawNodes.map((node, idx) => {
            const refined = refineNodeStochastic(node, baseFreq, 6, 100);
            // const improvement = node.dissonance - refined.dissonance;

            return refined;
        });
    }
    const nodes = cachedHarmonicNodes;

    //Local minima nodes ---------------------------------------------------------------
    if (nodes.length > 0) {
        traces.push({
            type: 'scatter3d',
            mode: 'markers+text',
            x: nodes.map(n => n.alpha),
            y: nodes.map(n => n.beta),
            z: nodes.map(n => n.gamma),
            marker: {
                size: localMinSize,
                color: 'rgba(235, 235, 235, 1)',
                symbol: 'circle',
                opacity: 1
            },
            text: nodes.map((_, i) => String(i + 1)),
            textposition: 'middle center',
            textfont: { size: localMinSize - 1, color: 'rgba(41, 41, 41, 1)', font: 'Source Code Pro' },
            name: 'Local-minima',
            visible: true,
            hovertemplate: '<span style="font-family:Source Code Pro">' +
                '<b>Node %{text}</b><br>' +
                'α = %{x:.4f}<br>' +
                'β = %{y:.4f}<br>' +
                'γ = %{z:.4f}' +
                '</span><extra></extra>'
        });
    }

    // Add 12-TET chords ---------------------------------------------------------------
    const chords12TET = get12TETChordPositions();
    const chordData12TET = chords12TET.filter(([name, a, b, g]) =>
        a >= alphaRange[0] && a <= alphaRange[alphaRange.length - 1] &&
        b >= betaRange[0] && b <= betaRange[betaRange.length - 1] &&
        g >= gammaRange[0] && g <= gammaRange[gammaRange.length - 1]
    );

    if (chordData12TET.length > 0) {
        // Get dissonance value for each chord
        const chordDissonances = chordData12TET.map(([name, a, b, g]) =>
            getDissonanceAtPoint(a, b, g, alphaRange, betaRange, gammaRange, dissonance3d)
        );
        traces.push({
            type: 'scatter3d',
            mode: 'markers+text',
            x: chordData12TET.map(c => c[1]),
            y: chordData12TET.map(c => c[2]),
            z: chordData12TET.map(c => c[3]),
            customdata: chordData12TET.map((c, i) => `${c[0]} (D: ${chordDissonances[i]?.toFixed(3) || 'N/A'})`),
            marker: {
                size: chordSize,
                color: chordDissonances,
                colorscale: myColor,
                cmin: vmin,
                cmax: vmax,
                symbol: 'square',
                // line: { color: 'rgba(255, 255, 255, 1)', width: 1 },
                opacity: 1
            },
            text: chordData12TET.map(c => c[0]),
            textposition: 'top center',
            textfont: { size: 12, color: 'rgba(255, 255, 255, 1)' },
            name: '12-TET Chords',
            visible: true,
            hovertemplate: '<span style="font-family:Source Code Pro">' +
                '<b>%{customdata}</b><br>' +
                'α = %{x:.4f}<br>' +
                'β = %{y:.4f}<br>' +
                'γ = %{z:.4f}' +
                '</span><extra></extra>'
        });
    }

    // Add 31-TET chords --------------------------------------------------------------
    const chords31TET = get31TETChordPositions();
    const chordData31TET = chords31TET.filter(([name, a, b, g]) =>
        a >= alphaRange[0] && a <= alphaRange[alphaRange.length - 1] &&
        b >= betaRange[0] && b <= betaRange[betaRange.length - 1] &&
        g >= gammaRange[0] && g <= gammaRange[gammaRange.length - 1]
    );

    if (chordData31TET.length > 0) {
        // Get dissonance value for each chord
        const chordDissonances = chordData31TET.map(([name, a, b, g]) =>
            getDissonanceAtPoint(a, b, g, alphaRange, betaRange, gammaRange, dissonance3d)
        );
        traces.push({
            type: 'scatter3d',
            mode: 'markers+text',
            x: chordData31TET.map(c => c[1]),
            y: chordData31TET.map(c => c[2]),
            z: chordData31TET.map(c => c[3]),
            customdata: chordData31TET.map((c, i) => `${c[0]} (D: ${chordDissonances[i]?.toFixed(3) || 'N/A'})`),
            marker: {
                size: chordSize - 1,
                color: chordDissonances,
                colorscale: myColor,
                cmin: vmin,
                cmax: vmax,
                symbol: 'diamond',
                // line: { color: 'rgba(255, 200, 0, 1)', width: 2 },
                opacity: 1,
                showscale: false
            },
            text: chordData31TET.map(c => c[0]),
            textposition: 'top center',
            textfont: { size: 12, color: 'rgba(255, 200, 0, 1)' },
            name: '31-TET Chords',
            visible: true,
            hovertemplate: '<span style="font-family:Source Code Pro">' +
                '<b>%{customdata}</b><br>' +
                'α = %{x:.4f}<br>' +
                'β = %{y:.4f}<br>' +
                'γ = %{z:.4f}' +
                '</span><extra></extra>'
        });
    }

    // Add 53-TET chords --------------------------------------------------------------
    const chords53TET = get53TETChordPositions();
    const chordData53TET = chords53TET.filter(([name, a, b, g]) =>
        a >= alphaRange[0] && a <= alphaRange[alphaRange.length - 1] &&
        b >= betaRange[0] && b <= betaRange[betaRange.length - 1] &&
        g >= gammaRange[0] && g <= gammaRange[gammaRange.length - 1]
    );

    if (chordData53TET.length > 0) {
        // Get dissonance value for each chord
        const chordDissonances = chordData53TET.map(([name, a, b, g]) =>
            getDissonanceAtPoint(a, b, g, alphaRange, betaRange, gammaRange, dissonance3d)
        );

        traces.push({
            type: 'scatter3d',
            mode: 'markers+text',
            x: chordData53TET.map(c => c[1]),
            y: chordData53TET.map(c => c[2]),
            z: chordData53TET.map(c => c[3]),
            customdata: chordData53TET.map((c, i) => `${c[0]} (D: ${chordDissonances[i]?.toFixed(3) || 'N/A'})`),
            marker: {
                size: chordSize,
                color: chordDissonances,
                colorscale: myColor,
                cmin: vmin,
                cmax: vmax,
                symbol: 'circle',
                // line: { color: 'rgba(202, 202, 202, 1)', width: 1 },
                opacity: 1,
                showscale: false  // Don't show separate colorbar for chords
            },
            text: chordData53TET.map(c => c[0]),
            textposition: 'top center',
            textfont: { size: 12, color: 'white' },
            name: '53-TET Chords',
            visible: true,  // VISIBLE AT START
            hovertemplate: '<span style="font-family:Source Code Pro">' +
                '<b>%{customdata}</b><br>' +
                'α = %{x:.4f}<br>' +
                'β = %{y:.4f}<br>' +
                'γ = %{z:.4f}' +
                '</span><extra></extra>'
        });
    }

    // ======================= LAYOUT ======================= 
    let thickness = 2.0;
    const layout = {
        scene: {
            domain: {
                x: [0, 1.0],
                y: [0, 1.0]
            },
            xaxis: {
                title: 'α (2nd note)',
                gridcolor: 'rgba(90, 90, 90, 1)',
                showspikes: true,
                spikecolor: 'rgba(255, 119, 0, 0.5)',
                spikethickness: thickness,
                spikesides: true,
                spikedash: 'solid',
                range: [1.0, 2.0]
            },
            yaxis: {
                title: 'β (3rd note)',
                gridcolor: 'rgba(90, 90, 90, 1)',
                showspikes: true,
                spikecolor: 'rgba(118, 236, 0, 0.5)',
                spikethickness: thickness,
                spikesides: true,
                spikedash: 'solid',
                range: [1.0, 2.0]
            },
            zaxis: {
                title: 'γ (4th note)',
                gridcolor: 'rgba(90, 90, 90, 1)',
                showspikes: true,
                spikecolor: 'rgba(0, 128, 255, 0.5)',
                spikethickness: thickness,
                spikesides: true,
                spikedash: 'solid',
                range: [1.0, 2.0]
            },
            bgcolor: 'rgba(0, 0, 0, 1)',
            aspectmode: 'cube'
        },
        legend: {
            x: 0.98,
            y: 0.15,
            xanchor: 'right',
            yanchor: 'top',
            bgcolor: 'rgba(0,0,0,0.0)',
            bordercolor: 'rgba(255,255,255,0.3)',
            borderwidth: 0,
            font: { size: 12, family: 'Source Code Pro', weight: 'normal' },
            fontFamily: 'Source Code Pro',
            fontWeight: 'normal',
            itemsizing: 'constant',
            itemwidth: 25
        },
        paper_bgcolor: 'rgba(0, 0, 0, 1)',
        font: { color: 'white', family: 'Source Code Pro', weight: 'normal' },
        margin: { l: 0, r: 0, t: 0, b: 0 },
        clickmode: 'event+select',
        hovermode: 'closest'
    };

    // ========== SLIDER (REMOVED - Using P5 colorbar slider instead) ==========
    // Calculate layer info for P5 slider


    const layerStartIndex = 1;
    const actualNumLayers = Math.floor((traces.length - layerStartIndex - 4) / tracesPerLayer); // -4 for nodes and chords

    // Store thresholds and layer info globally for P5 slider to use
    window.plotlyLayerInfo = {
        thresholds: thresholds,
        windowSize: windowSize,
        tracesPerLayer: tracesPerLayer,
        layerStartIndex: layerStartIndex,
        actualNumLayers: actualNumLayers
    };

    // ========== RENDER ==========
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const config = {
        displayModeBar: true,
        scrollZoom: true,
        responsive: true,
        plotGlPixelRatio: isSafari ? 2.0 : 1.0,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d'],
        modeBarButtonsToAdd: [{
            name: 'center',
            title: 'Center view on chord nodes',
            icon: Plotly.Icons.autoscale,
            attr: 'data-title',
            val: 'center',
            click: function (gd) {
                const camera = {
                    center: { x: -0.2730976653225596, y: -0.02881156623103831, z: 0.33368750844216766 },
                    eye: { x: -0.27292369375114334, y: 0.32303500457365386, z: 0.3835990385131691 },
                    projection: { type: 'perspective' },
                    up: { x: -0.00153875592856815, y: -0.14044893400507186, z: 0.9900867281036707 }
                };
                Plotly.relayout(gd, { 'scene.camera': camera });
            }
        }],
        displaylogo: false
    };

    const plotDiv = document.getElementById('plot');

    // Set initial camera to optimal viewing position
    layout.scene.camera = {
        center: { x: -0.2730976653225596, y: -0.02881156623103831, z: 0.33368750844216766 },
        eye: { x: -0.28211018700032187, y: 0.6829744133578857, z: 0.3294558403646424 },
        projection: { type: 'perspective' },
        up: { x: 0.0013124728315837674, y: 0.005961648647514917, z: 0.9999813679066577 }
    };

    Plotly.newPlot('plot', traces, layout, config).then(() => {
        const scene = document.getElementById('plot')._fullLayout.scene._scene;
        const gl = scene.glplot.gl;
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // Add colorful styling to modebar icons - aggressive approach
        setTimeout(() => {
            // Function to color the SVG paths directly
            function colorizeButton(btn, color, hoverColor = null) {
                const svg = btn.querySelector('svg');
                const paths = btn.querySelectorAll('path');

                if (svg && paths.length > 0) {
                    // Set the fill color directly on all path elements
                    paths.forEach(path => {
                        path.style.fill = color;
                        path.style.transition = 'all 0.2s ease';
                    });

                    // Add hover effects if specified
                    if (hoverColor) {
                        btn.addEventListener('mouseenter', () => {
                            paths.forEach(path => path.style.fill = hoverColor);
                            btn.style.transform = 'scale(1.05)';
                        });

                        btn.addEventListener('mouseleave', () => {
                            paths.forEach(path => path.style.fill = color);
                            btn.style.transform = 'scale(1)';
                        });
                    }
                }
            }

            // Direct JavaScript reorganization of modebar
            function organizeModebar() {
                const modebar = document.querySelector('.modebar');
                if (!modebar) return;

                // Apply direct styles to modebar container
                modebar.style.display = 'flex';
                modebar.style.alignItems = 'center';
                modebar.style.gap = '8px';
                modebar.style.padding = '6px 10px';
                modebar.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                modebar.style.borderRadius = '6px';

                // Find all button groups
                const groups = modebar.querySelectorAll('.modebar-group');
                groups.forEach((group, index) => {
                    // Style each group
                    group.style.display = 'flex';
                    group.style.alignItems = 'center';
                    group.style.gap = '3px';

                    // Add separator between groups (except last)
                    if (index < groups.length - 1) {
                        group.style.marginRight = '8px';
                        group.style.paddingRight = '8px';
                        group.style.borderRight = '1px solid rgba(255, 255, 255, 0.2)';
                    }
                });
            }

            // Apply organization
            organizeModebar();

            // Find and style all modebar buttons with unified theme and consistent sizing
            const buttons = document.querySelectorAll('.modebar-btn');
            buttons.forEach(btn => {
                // Uniform button sizing and spacing
                btn.style.width = '28px';
                btn.style.height = '28px';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.margin = '0 1px';
                btn.style.padding = '4px';
                btn.style.borderRadius = '4px';
                btn.style.transition = 'all 0.2s ease';

                // Standardize SVG size
                const svg = btn.querySelector('svg');
                if (svg) {
                    svg.style.width = '16px';
                    svg.style.height = '16px';
                }

                // All buttons use the same color scheme for clean, unified look
                colorizeButton(btn, '#1d96ffff', '#6ed1feff');

                // Add general hover background effect
                btn.addEventListener('mouseenter', () => {
                    btn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.backgroundColor = 'transparent';
                });
            });

            console.log(`Colored ${buttons.length} modebar buttons`);
        }, 200);

        // Initialize P5 colorbar slider with threshold data
        if (typeof colorbarP5 !== 'undefined' && window.plotlyLayerInfo) {
            colorbarP5.setThresholds(
                window.plotlyLayerInfo.thresholds,
                window.plotlyLayerInfo.windowSize,
                0  // Start at first layer
            );
        }
    });

    // plotDiv.on('plotly_relayout', function (eventData) {
    //     if (eventData['scene.camera']) {
    //         console.log('Camera updated:', eventData['scene.camera']);
    //     }
    // });

    // Attach click event listener - works perfectly with plotly!
    plotDiv.on('plotly_click', async function (eventData) {
        if (eventData.points && eventData.points.length > 0) {
            const point = eventData.points[0];
            const alpha = point.x;
            const beta = point.y;
            const gamma = point.z;

            // Play the chord (sends MIDI note-on + schedules note-off)
            await playChord(alpha, beta, gamma, currentBaseFreq);

            // Update chord visualization with clicked frequencies
            if (typeof setChordVisualization === 'function') {
                setChordVisualization(alpha, beta, gamma, currentBaseFreq);
            }

            // Record last clicked chord so it can be stored in the grid
            try {
                // Extract chord metadata
                let chordName = null;
                let cellColor = null;
                let tetSystem = null;

                // DEBUG: Log point structure
                console.log('Point data:', point);
                console.log('point.data:', point.data);
                console.log('point.fullData:', point.fullData);
                console.log('point.pointIndex:', point.pointIndex);
                console.log('point.pointNumber:', point.pointNumber);

                // Extract color for ALL points (nodes and TET chords)
                if (point.fullData && point.fullData.marker) {
                    const marker = point.fullData.marker;
                    console.log('marker:', marker);
                    console.log('marker.color:', marker.color);

                    // Helper to parse rgba color strings
                    const parseRgba = (rgbaStr) => {
                        const match = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                        return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : null;
                    };

                    // Case 1: Color is a string (TET chords)
                    if (typeof marker.color === 'string') {
                        cellColor = parseRgba(marker.color);
                        console.log('cellColor (from string):', cellColor);
                    }
                    // Case 2: Color is an array (nodes with dissonance values)
                    else if (marker.color && Array.isArray(marker.color)) {
                        // Use point.pointNumber as index if pointIndex is undefined
                        const colorIndex = point.pointIndex !== undefined ? point.pointIndex : point.pointNumber;

                        if (colorIndex !== undefined && colorIndex < marker.color.length) {
                            const dissValue = marker.color[colorIndex];
                            console.log('dissValue:', dissValue);
                            const cmin = marker.cmin || 0;
                            const cmax = marker.cmax || 15;
                            const norm = Math.max(0, Math.min(1, (dissValue - cmin) / (cmax - cmin)));
                            console.log('norm:', norm);

                            // Use the actual colorscale from the visualization
                            const colorscale = marker.colorscale || [
                                [0.0, 'rgba(0, 0, 255, 1)'],
                                [0.25, 'rgba(0, 200, 255, 1)'],
                                [0.5, 'rgba(255, 255, 255, 1)'],
                                [0.75, 'rgba(255, 200, 0, 1)'],
                                [1.0, 'rgba(255, 0, 0, 1)']
                            ];

                            // Find the two color stops to interpolate between
                            let lowerStop = colorscale[0];
                            let upperStop = colorscale[colorscale.length - 1];

                            for (let i = 0; i < colorscale.length - 1; i++) {
                                if (norm >= colorscale[i][0] && norm <= colorscale[i + 1][0]) {
                                    lowerStop = colorscale[i];
                                    upperStop = colorscale[i + 1];
                                    break;
                                }
                            }

                            const color1 = parseRgba(lowerStop[1]);
                            const color2 = parseRgba(upperStop[1]);

                            if (color1 && color2) {
                                // Interpolate between the two colors
                                const t = (norm - lowerStop[0]) / (upperStop[0] - lowerStop[0]);
                                cellColor = [
                                    Math.round(color1[0] + (color2[0] - color1[0]) * t),
                                    Math.round(color1[1] + (color2[1] - color1[1]) * t),
                                    Math.round(color1[2] + (color2[2] - color1[2]) * t)
                                ];
                                console.log('cellColor (from array):', cellColor);
                            }
                        }
                    }
                }

                // Check if this is a named TET chord
                if (point.data && point.data.name) {
                    const traceName = point.data.name;

                    if (traceName === '12-TET Chords') {
                        tetSystem = '12-TET';
                    } else if (traceName === '31-TET Chords') {
                        tetSystem = '31-TET';
                    } else if (traceName === '53-TET Chords') {
                        tetSystem = '53-TET';
                    }

                    // Extract chord name from customdata (format: "chord_name (D: value)")
                    if (point.customdata && typeof point.customdata === 'string') {
                        const match = point.customdata.match(/^(.+?)\s*\(/);
                        if (match) {
                            chordName = match[1].trim();
                        }
                    }
                }

                window.lastClickedChord = {
                    root: currentBaseFreq,
                    alpha: alpha,
                    beta: beta,
                    gamma: gamma,
                    frequencies: [
                        currentBaseFreq,
                        currentBaseFreq * alpha,
                        currentBaseFreq * beta,
                        currentBaseFreq * gamma
                    ],
                    nodeNumber: (tetSystem === null && point.pointNumber !== undefined) ? point.pointNumber : (point.pointIndex !== undefined ? point.pointIndex : null),
                    chordName: chordName,
                    cellColor: cellColor,
                    tetSystem: tetSystem
                };
                console.log('lastClickedChord:', window.lastClickedChord);

                // Update keyboard mapping visualization with the color immediately
                if (cellColor && typeof window.updateKeyboardMapping === 'function') {
                    const baseFrequencies = [
                        currentBaseFreq,
                        currentBaseFreq * alpha,
                        currentBaseFreq * beta,
                        currentBaseFreq * gamma
                    ];
                    window.updateKeyboardMapping(baseFrequencies, cellColor);
                }
            } catch (e) {
                console.warn('Failed to record lastClickedChord', e);
            }
            // Do not auto-open the grid; leave the grid toggle button to the user.
            // If the grid is already open, prepare it now so the user can click a cell immediately.
            try {
                const container = document.getElementById('grid-container');
                if (container && container.style.display !== 'none' && typeof gridSketch !== 'undefined' && gridSketch && gridSketch.getGrid) {
                    const grid = gridSketch.getGrid();
                    if (grid && typeof grid.prepareToStore === 'function') {
                        grid.prepareToStore(window.lastClickedChord);
                    }
                }
            } catch (e) {
                // Non-fatal: grid may not be initialized yet
            }

        }
    });
}

// Fast toggle function - single update for all traces
function toggleVisualizationMode() {
    const plotDiv = document.getElementById('plot');
    const totalTraces = plotDiv.data.length;
    const tracesPerLayer = ENABLE_DISTANCE_LINES ? 2 : 1;
    const numChordTraces = 4; // nodes + 12TET + 31TET + 53TET
    const numLayerTraces = totalTraces - 1 - numChordTraces; // minus full3D and chord traces

    // Build complete visibility array for ALL traces at once
    const visibilityArray = new Array(totalTraces);

    if (visualizationMode === 'sectioned') {
        // Switch to FULL 3D mode
        visualizationMode = 'full3d';

        visibilityArray[0] = true; // Full 3D trace visible

        // All layer traces hidden
        for (let i = 1; i <= numLayerTraces; i++) {
            visibilityArray[i] = false;
        }

        // Chord traces always visible
        for (let i = numLayerTraces + 1; i < totalTraces; i++) {
            visibilityArray[i] = true;
        }

        // Single update: visibility only (no Plotly slider)
        Plotly.update(plotDiv, { visible: visibilityArray }, {});

        // Hide slider with smooth animation
        const colorbarContainer = document.getElementById('colorbar-container');
        if (colorbarContainer) {
            colorbarContainer.classList.add('hidden');
        }

    } else {
        // Switch to SECTIONED mode
        visualizationMode = 'sectioned';

        // Show slider with smooth animation
        const colorbarContainer = document.getElementById('colorbar-container');
        if (colorbarContainer) {
            colorbarContainer.classList.remove('hidden');
        }

        visibilityArray[0] = false; // Full 3D trace hidden

        // Get current step from P5 slider (maintains position)
        let currentLayer = 0;
        if (typeof colorbarP5 !== 'undefined' && colorbarP5.getCurrentStep) {
            currentLayer = colorbarP5.getCurrentStep();
        }

        // Show the layer at current slider position
        const actualNumLayers = Math.floor(numLayerTraces / tracesPerLayer);
        for (let i = 0; i < actualNumLayers; i++) {
            if (ENABLE_DISTANCE_LINES) {
                visibilityArray[1 + i * 2] = (i === currentLayer);
                visibilityArray[1 + i * 2 + 1] = (i === currentLayer);
            } else {
                visibilityArray[1 + i] = (i === currentLayer);
            }
        }

        // Chord traces always visible
        for (let i = numLayerTraces + 1; i < totalTraces; i++) {
            visibilityArray[i] = true;
        }

        // Single update: visibility only (no Plotly slider)
        Plotly.update(plotDiv, { visible: visibilityArray }, {});
    }
}

// Function to update layer visibility - called by P5 colorbar slider
window.updatePlotlyLayer = function (layerIndex) {
    const plotDiv = document.getElementById('plot');
    const totalTraces = plotDiv.data.length;
    const tracesPerLayer = ENABLE_DISTANCE_LINES ? 2 : 1;
    const numChordTraces = 4; // nodes + 12TET + 31TET + 53TET
    const numLayerTraces = totalTraces - 1 - numChordTraces;
    const actualNumLayers = Math.floor(numLayerTraces / tracesPerLayer);

    // Only update if in sectioned mode
    if (visualizationMode !== 'sectioned') return;

    // Build visibility array
    const layerVisibility = Array(actualNumLayers * tracesPerLayer).fill(false);

    if (ENABLE_DISTANCE_LINES) {
        layerVisibility[layerIndex * 2] = true;
        layerVisibility[layerIndex * 2 + 1] = true;
    } else {
        layerVisibility[layerIndex] = true;
    }

    const layerIndices = Array.from({ length: actualNumLayers * tracesPerLayer }, (_, idx) => 1 + idx);

    // Update only the layer traces
    Plotly.restyle(plotDiv, 'visible', layerVisibility, layerIndices);
}

// Save binary
function saveDatasetBinary(data, baseFreq) {
    const { alphaRange, betaRange, gammaRange, dissonance3d } = data;

    // Flatten 3D array
    const flat = [];
    for (let i = 0; i < dissonance3d.length; i++) {
        for (let j = 0; j < dissonance3d[i].length; j++) {
            flat.push(...dissonance3d[i][j]);
        }
    }

    // Pack: [alphaRange, betaRange, gammaRange, dissonance3d]
    const buffer = new Float32Array([
        ...alphaRange,
        ...betaRange,
        ...gammaRange,
        ...flat
    ]);

    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harmonic-${baseFreq}Hz.bin`;
    a.click();
}


window.addEventListener('keydown', function (e) {
    const freq = keyToFreq[e.key.toLowerCase()];
    if (freq) {
        currentBaseFreq = freq;
        // rootSelector.value = freq;
        document.getElementById('click-output').textContent =
            `Root: ${freqToName[freq]} (${freq.toFixed(2)} Hz) - Click any point to hear`;

        // Update chord visualization root
        if (typeof setRootVisualization === 'function') {
            setRootVisualization(freq);
        }

        // Clear any playing chord when root changes
        if (typeof clearChordVisualization === 'function') {
            clearChordVisualization();
        }
    }
});

// Function to update root from chord visualization clicks
window.updateGlobalRoot = function (freq) {
    currentBaseFreq = freq;
    document.getElementById('click-output').textContent =
        `Root: ${freqToName[freq]} (${freq.toFixed(2)} Hz) - Click any point to hear`;

    // Update chord visualization root
    if (typeof setRootVisualization === 'function') {
        setRootVisualization(freq);
    }

    // Clear any playing chord when root changes
    if (typeof clearChordVisualization === 'function') {
        clearChordVisualization();
    }
};

// Function to update chord with current doubling settings
window.updateChordWithDoubling = function () {
    // Get the current playing frequencies from the chord visualization
    const playbackFreqs = typeof window.getActualPlaybackFrequencies === 'function' ?
        window.getActualPlaybackFrequencies() : [];

    if (playbackFreqs.length === 4) {
        // We have a complete chord playing, replay it with new doubling settings
        // Extract the ratios from the original frequencies
        const rootFreq = playbackFreqs[0].originalFreq;
        const alpha = playbackFreqs[1].originalFreq / rootFreq;
        const beta = playbackFreqs[2].originalFreq / rootFreq;
        const gamma = playbackFreqs[3].originalFreq / rootFreq;

        // Play the chord with the updated doubling
        playChord(alpha, beta, gamma, currentBaseFreq);

        // Update both temporary chord memory and grid's selected chord
        // This ensures the x2 configuration is captured when storing to grid
        const doublingFlags = typeof window.getDoublingFlags === 'function' ?
            window.getDoublingFlags() : { R: false, α: false, β: false, γ: false };

        const updatedChord = {
            root: currentBaseFreq,
            alpha: alpha,
            beta: beta,
            gamma: gamma,
            frequencies: [
                currentBaseFreq,
                currentBaseFreq * alpha,
                currentBaseFreq * beta,
                currentBaseFreq * gamma
            ],
            nodeNumber: window.lastClickedChord?.nodeNumber,
            chordName: window.lastClickedChord?.chordName,
            cellColor: window.lastClickedChord?.cellColor,
            tetSystem: window.lastClickedChord?.tetSystem
        };

        // Always update lastClickedChord
        window.lastClickedChord = updatedChord;

        // Update grid to prepare for storage with the modified chord
        if (typeof window.updateGridSelectedChord === 'function') {
            window.updateGridSelectedChord(updatedChord);
        }

        console.log('Updated chord with new doubling flags:', doublingFlags);
    }
};

// Manual test function - call from console: testRootChange(130.81)
window.testRootChange = function (newFreq) {
    currentBaseFreq = newFreq;
    createVisualization(globalDissonanceData, currentBaseFreq, 77);
};

// Run computation -------------------------------------------------------------------------------------------------------------------------
window.addEventListener('load', async () => {
    currentBaseFreq = 220.0;
    const localNodes = 77;
    const harmonics = 6;
    const zoneNodes = 400;

    // Try to load pre-computed data first, with progress bar updates
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const clickOutput = document.getElementById('click-output');

    if (progressContainer) progressContainer.style.display = 'block';
    if (clickOutput) clickOutput.style.display = 'none';
    if (progressText) progressText.textContent = 'Loading pre-computed data…';

    const onProgress = (percent, text) => {
        if (progressBar) progressBar.style.setProperty('--progress', `${Math.max(0, Math.min(100, percent))}%`);
        if (progressText && text) progressText.textContent = text;
    };

    try {
        globalDissonanceData = await loadDissonanceMap(currentBaseFreq, zoneNodes, onProgress);
    } catch (e) {
        console.warn('Precomputed dataset failed to load, falling back to compute:', e);
        if (progressText) progressText.textContent = 'Computing dissonance map (this may take a while)…';
        globalDissonanceData = await calculate3dDissonanceMap(currentBaseFreq, 1.0, 2.0, zoneNodes, harmonics, "min");
    }

    // Create visualization
    document.getElementById('click-output').textContent = 'Creating visualization...';
    // If precomputed harmonic nodes were loaded with the dataset, use them
    if (globalDissonanceData && Array.isArray(globalDissonanceData.nodes) && globalDissonanceData.nodes.length > 0) {
        // Cache nodes so createVisualization won't attempt to re-compute them
        cachedHarmonicNodes = globalDissonanceData.nodes.map(n => ({
            alpha: n.alpha,
            beta: n.beta,
            gamma: n.gamma,
            dissonance: n.dissonance
        }));
        console.log('Using precomputed harmonic nodes from metadata, count=', cachedHarmonicNodes.length);
    }

    createVisualization(globalDissonanceData, currentBaseFreq, localNodes);

    // Initialize chord visualization with current root
    if (typeof setRootVisualization === 'function') {
        setRootVisualization(currentBaseFreq);
    }

    // Hide progress, ready to play
    if (progressContainer) progressContainer.style.display = 'none';

    // Show info overlay now that data is loaded and visualization is ready
    // Small delay to ensure plot is fully rendered
    setTimeout(() => {
        if (window.infoOverlay && typeof window.infoOverlay.showWhenReady === 'function') {
            window.infoOverlay.showWhenReady();
        }
    }, 200);

    // Initialize MIDI controller now that data is loaded and visualization is ready
    setTimeout(async () => {
        if (window.midiController && typeof window.midiController.initialize === 'function') {
            const initialized = await window.midiController.initialize();
            if (initialized) {
                // Wait a moment for device enumeration to complete
                await new Promise(resolve => setTimeout(resolve, 200));
                console.log('MIDI Controller ready');
                console.log('Available devices:', window.midiController.getOutputDevices());

                // Create MIDI button now that controller is ready
                if (window.midiController.midiEnabled) {
                    const midiButton = document.createElement('button');
                    midiButton.id = 'midi-toggle';
                    midiButton.innerHTML = `
                        <span class="midi-icon">🎹</span>
                        <span>MIDI</span>
                    `;
                    midiButton.addEventListener('click', () => {
                        window.midiController.toggleUI();
                    });
                    document.body.appendChild(midiButton);
                    console.log('MIDI integration ready');
                }
            }
        }
    }, 400);

    // Create Store Chord button (stores last clicked chord into the grid)
    (function createStoreChordButton() {
        const storeBtn = document.createElement('button');
        storeBtn.id = 'store-chord-btn';
        storeBtn.title = 'Store last selected chord into the chord grid';
        storeBtn.textContent = 'Store Chord';
        storeBtn.style.marginLeft = '8px';
        storeBtn.style.padding = '6px 8px';
        storeBtn.style.borderRadius = '6px';
        storeBtn.style.background = 'rgba(29,150,255,0.12)';
        storeBtn.style.color = '#cfefff';
        storeBtn.style.border = '1px solid rgba(29,150,255,0.18)';
        storeBtn.addEventListener('click', () => {
            // Prefer the last clicked chord (Plotly click)
            if (window.lastClickedChord) {
                if (typeof window.prepareChordForStorage === 'function') {
                    window.prepareChordForStorage(window.lastClickedChord);
                } else {
                    alert('Chord grid not initialized yet. Open the grid and try again.');
                }
                return;
            }

            // Fallback: try to use currently-playing visualization frequencies
            const playback = (typeof window.getActualPlaybackFrequencies === 'function') ? window.getActualPlaybackFrequencies() : null;
            if (playback && playback.length === 4) {
                try {
                    const root = playback[0].originalFreq || currentBaseFreq;
                    const alpha = playback[1].originalFreq / root;
                    const beta = playback[2].originalFreq / root;
                    const gamma = playback[3].originalFreq / root;
                    const chordData = {
                        root: root,
                        alpha: alpha,
                        beta: beta,
                        gamma: gamma,
                        frequencies: [root, root * alpha, root * beta, root * gamma],
                        nodeNumber: null
                    };
                    if (typeof window.prepareChordForStorage === 'function') {
                        window.prepareChordForStorage(chordData);
                    } else {
                        alert('Chord grid not initialized yet. Open the grid and try again.');
                    }
                } catch (e) {
                    console.warn('Failed to prepare chord for storage from playback data', e);
                }
                return;
            }

            alert('No chord selected. Click a chord in the visualization first.');
        });

        document.body.appendChild(storeBtn);
    })();

    /// Add root note selector event listener (if it exists)
    const rootSelector = document.getElementById('root-select');

    if (rootSelector) {
        rootSelector.addEventListener('change', function (e) {
            currentBaseFreq = parseFloat(e.target.value);
            const rootName = e.target.options[e.target.selectedIndex].text;

            document.getElementById('click-output').textContent = `Root: ${rootName} (${currentBaseFreq.toFixed(2)} Hz) - Click any point to hear`;

            // Update chord visualization root
            if (typeof setRootVisualization === 'function') {
                setRootVisualization(currentBaseFreq);
            }

            // Clear any playing chord when root changes
            if (typeof clearChordVisualization === 'function') {
                clearChordVisualization();
            }
        });
    }

    // Visualization mode toggle button - uses fast restyle instead of recreating plot
    const toggleButton = document.getElementById('viz-mode-toggle');
    if (toggleButton) {
        toggleButton.addEventListener('click', function () {
            toggleVisualizationMode();

            this.textContent = visualizationMode === 'sectioned'
                ? 'Switch to Full 3D View'
                : 'Switch to Sectioned View';
        });
    }
});

// Keyboard shortcut: Press 'M' to toggle MIDI panel
document.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') {
        if (window.midiController) {
            window.midiController.toggleUI();
        }
    }
});