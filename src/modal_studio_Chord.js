// Chord.js - Direct port from C++ Chord.cpp
class Chord {
    // C++ Chord.cpp lines 12-20 - Modal base colors (static)
    static modalBaseColors = [
        [200, 200, 200],  // I   - Tonic
        [210, 210, 210],  // II  - Supertonic
        [220, 220, 220],  // III - Mediant
        [230, 230, 230],  // IV  - Subdominant
        [240, 240, 240],  // V   - Dominant
        [250, 250, 250],  // VI  - Submediant
        [255, 255, 255]   // VII - Leading tone
    ];
    
    constructor() {
        this.notes = [];
        this.quality = ''; // String representation (e.g., "Cmaj7")
        this.root = null;
        this.pos = { x: 0, y: 0 };
        this.size = { x: 160, y: 50 };
        this.noteVoicing = [];
        this.numVoicing = 0;
        this.voicingType = 0; // Which voicing template (0-6) is being used - preserves across note changes
        this.chordFunction = 'I'; // Roman numeral function (I, II, III, etc.)
        this.globalInversion = 0; // Inversion state (0=root, 1=first, 2=second, etc.)
        this.previousVoicing = []; // C++ Chord.hpp line 191 - for voice leading
        this.info = ''; // Display text for Empty, Drop Here, Clean, etc.
        this.myTextSize = 12;

        // ChordQuality struct (C++ Chord.hpp lines 17-39)
        this.chordQuality = {
            note: '',
            quality: '',
            function: 'I',
            inversion: 0,
            notes: [],
            id: 1,
            name: '' // Full chord name (e.g., "Cmaj7")
        };
        
        // C++ Chord.cpp lines 37-43 - voicing arrays (1-indexed positions)
        this.voicing_1 = [8, 17, 19, 21, 22];
        this.voicing_2 = [8, 14, 17, 19, 22];
        this.voicing_3 = [8, 14, 17, 19, 21];
        this.voicing_4 = [8, 12, 14, 17, 19, 21];
        this.voicing_5 = [1, 8, 12, 14, 17, 19];
        this.voicing_6 = [1, 7, 12, 14, 17, 19];
        this.voicing_7 = [1, 7, 10, 12, 14, 17];
        
        // C++ Chord.hpp line 192 - potential positions for 9th in upper register
        this.upperNinth = [23, 27];
        
        // C++ Chord.hpp lines 202-203, 213-216 - hover and click states
        this.mouseHoverCheck = false;
        this.mouseClicked = false;
        this.defaultColor = [240, 240, 240];
        this.hoverColor = [255, 255, 255];
        this.chordClicked = [255, 200, 0];
        this.rounded = 10;
        this.alpha = 255;
    }
    
    // C++: void Chord::setNotes(vector<Note> subScale)
    // C++ Chord.cpp lines 218-226: setNotes
    setNotes(subScale) {
        this.notes = subScale; // C++ line 219: notes = inNotes
        this.chordQuality.notes = subScale; // C++ line 220
        // C++ line 223-225: Set root_53 to first note
        if (subScale.length > 0) {
            this.root = subScale[0];
            this.root_53 = subScale[0]; // C++ line 224: root_53 = notes.at(0)
        }
    }
    
    // C++ Chord.hpp line 91: void setRoot53(Note noteRef)
    setRoot53(noteRef) {
        this.root_53 = noteRef;
        this.note_53 = noteRef.ft_note;
    }
    
    // C++ Chord.cpp lines 269-278 - Get note name from note number
    getNoteName(noteNumber) {
        // Given a reference note number, get the note name
        for (const note of this.notes) {
            if (note.ft_note === noteNumber) {
                return note.name;
            }
        }
        return "Unknown";
    }
    
    // C++ Chord.cpp lines 134-144 - Get base color for modal function
    getModalBaseColor(chordFunction) {
        const degreeMap = {
            'I': 0, 'II': 1, 'III': 2, 'IV': 3,
            'V': 4, 'VI': 5, 'VII': 6, 'VIII': 7
        };
        
        const index = degreeMap[chordFunction] !== undefined ? degreeMap[chordFunction] : 0;
        return Chord.modalBaseColors[index];
    }
    
    // C++ Chord.cpp lines 146-152 - Check if color needs white text
    needsWhiteText(color) {
        const luminance = (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]) / 255.0;
        const alpha = (color.length > 3 ? color[3] : 255) / 255.0;
        const adjustedLuminance = luminance * alpha + (1.0 - alpha);
        return adjustedLuminance < 0.6;
    }
    
    // C++ Chord.cpp lines 155-214 - Tint base color by chord quality ----------------------------------------
    tintForQuality(baseColor, quality) {
        let result = [...baseColor];
        const blendFactor = 0.1;
        let qualityColor;
        
        // Dominant seventh family
        if (quality.includes("Mm7") || quality === "Mm7") {
            qualityColor = [233, 233, 233, 1]; // rgba(233, 233, 233, 1)
        }
        // Major seventh family 
        else if (quality.includes("maj7")) {
            qualityColor = [255, 190, 0, 1]; // rgba(255, 160, 0, 1)
        }
        // Major family
        else if (quality.includes("M")) {
            qualityColor = [255, 140, 0, 1]; // rgba(255, 98, 0, 1)
        }
        // Up-major family
        else if (quality.includes("^M")) {
            qualityColor = [255, 140, 0, 1]; // rgba(255, 140, 0, 1)
        }

        // minor Neutral family 
        else if (quality.includes("n")) {
            qualityColor = [200, 200, 200, 1]; // rgba(200, 200, 200, 1)
        }

        // major Neutral family 
        else if (quality.includes("N")) {
            qualityColor = [222, 222, 222, 1]; // rgba(222, 222, 222, 1)
        }
        // Down-minor family 
        else if (quality.includes("vm")) {
            qualityColor = [0, 200, 255, 1]; // rgba(0, 200, 255, 1) - cyan
        }
        // Minor family 
        else if (quality.includes("m") || quality.includes("m_")) {
            qualityColor = [0, 150, 255, 1]; // rgba(0, 150, 255, 1) - blue
        }
        // Augmented family
        else if (quality.includes("aug")) {
            qualityColor = [118, 118, 118, 1]; // rgba(118, 118, 118, 1)
        }
        else {
            qualityColor = [118, 118, 118, 1]; //Default
        }
        
        // Blend base color with quality color
        // result[0] = baseColor[0] * (1 - blendFactor) + qualityColor[0] * blendFactor;
        // result[1] = baseColor[1] * (1 - blendFactor) + qualityColor[1] * blendFactor;
        // result[2] = baseColor[2] * (1 - blendFactor) + qualityColor[2] * blendFactor;
        result[0] = qualityColor[0];
        result[1] = qualityColor[1];
        result[2] = qualityColor[2];
        result[3] = qualityColor[3] * 200;
        
        // Apply modifiers
        if (quality.includes("S")) {
            result[0] = Math.min(255, result[0] + 15);
            result[1] = Math.min(255, result[1] + 10);
        }
        if (quality.includes("sm")) {
            result[2] = Math.min(255, result[2] + 20);
        }
        if (quality.includes("N")) {
            result[0] = Math.min(255, result[0] + 10);
            result[1] = Math.min(255, result[1] + 5);
        }
        if (quality.includes("*")) {
            result[2] = Math.min(255, result[2] + 20);
            result[1] = Math.min(255, result[1] + 10);
        }
        
        // Calculate hover color
        this.hoverColor = [
            Math.min(255, result[0] * 1.1),
            Math.min(255, result[1] * 1.1),
            Math.min(255, result[2] * 1.1),
            225
        ];
        
        return result;
    }
    
    // C++ Chord.cpp lines 852-863 - Get chord color based on quality ----------------------------------------
    getChordColor() {
        if (this.notes.length === 0) {
            return this.defaultColor;
        }
        
        const baseColor = this.getModalBaseColor(this.chordFunction);
        return this.tintForQuality(baseColor, this.quality);
    }
    
    // C++: void Chord::setChordQuality() - EXACT logic from Chord.cpp lines 722-850 ------------------------------
    setChordQuality() {
        // C++ line 931: Store original voicing to preserve it
        const originalVoicing = [...this.noteVoicing];
        const hadVoicing = originalVoicing.length > 0;
        
        // C++ Chord.cpp lines 933-945: Handle empty or invalid chord
        if (this.notes.length < 3) {
            this.quality = "Empty";
            this.chordFunction = "Empty";
            this.chordQuality.note = "Empty";
            this.chordQuality.quality = "Empty";
            this.chordQuality.function = "Empty";
            this.chordQuality.id = -1;
            this.chordQuality.notes = [];
            this.noteVoicing = [];
            return;
        }
        
        // C++ Chord.cpp lines 950-952: Return to root position for quality analysis if needed
        if (this.globalInversion !== 0 && this.noteVoicing.length > 0) {
            this.setInversion(0);
        }
        
        // C++ interval maps from Chord.cpp lines 725-772
        const thirdIntervals = {
            10: "subminor", 11: "subminor", 12: "downminor", 13: "minor", 14: "upminor",
            15: "neutralminor", 16: "neutralmajor", 17: "downmajor", 18: "major",
            19: "upmajor", 20: "supermajor"
        };
        
        const fifthIntervals = {
            26: "diminished", 27: "diminished", 28: "diminished", 29: "diminished",
            30: "perfect", 31: "perfect", 32: "perfect",
            33: "augmented", 34: "augmented", 35: "augmented", 36: "augmented"
        };
        
        const seventhIntervals = {
            33: "subdiminished", 34: "downdiminished", 35: "diminished", 36: "updiminished",
            42: "subminor", 43: "downminor", 44: "minor", 45: "upminor",
            46: "neutralminor", 47: "neutralmajor", 48: "downmajor", 49: "major",
            50: "upmajor", 51: "supermajor"
        };
        
        // C++ chord name lookup table from Chord.hpp lines 287-485 (COMPLETE)
        const chordNames = {
            // Super-major combinations
            "supermajor_perfect_supermajor": "SMSM7",
            "supermajor_perfect_upmajor": "SM^M7",
            "supermajor_perfect_major": "SMmaj7",
            "supermajor_perfect_downmajor": "SMvM7",
            "supermajor_perfect_neutralmajor": "SMN7",
            "supermajor_perfect_neutralminor": "SMn7",
            "supermajor_perfect_upminor": "SM^m7",
            "supermajor_perfect_minor": "SMm7",
            "supermajor_perfect_downminor": "SMvm7",
            "supermajor_perfect_subminor": "SMsm7",

            // Up-major combinations
            "upmajor_perfect_supermajor": "^MSM7",
            "upmajor_perfect_upmajor": "^M^M7",
            "upmajor_perfect_major": "^Mmaj7",
            "upmajor_perfect_downmajor": "^MvM7",
            "upmajor_perfect_neutralmajor": "^MN7",
            "upmajor_perfect_neutralminor": "^Mn7",
            "upmajor_perfect_upminor": "^M^m7",
            "upmajor_perfect_minor": "^Mm7",
            "upmajor_perfect_downminor": "^Mvm7",
            "upmajor_perfect_subminor": "^Msm7",

            // Major combinations
            "major_perfect_supermajor": "MSM7",
            "major_perfect_upmajor": "M^M7",
            "major_perfect_major": "maj7",
            "major_perfect_downmajor": "MvM7",
            "major_perfect_neutralmajor": "MN7",
            "major_perfect_neutralminor": "Mn7",
            "major_perfect_upminor": "M^m7",
            "major_perfect_minor": "Mm7",
            "major_perfect_downminor": "Mvm7",
            "major_perfect_subminor": "Msm7",

            // Down-major combinations
            "downmajor_perfect_supermajor": "vMSM7",
            "downmajor_perfect_upmajor": "vM^M7",
            "downmajor_perfect_major": "vMmaj7",
            "downmajor_perfect_downmajor": "vMvM7",
            "downmajor_perfect_neutralmajor": "vMN7",
            "downmajor_perfect_neutralminor": "vMn7",
            "downmajor_perfect_upminor": "vM^m7",
            "downmajor_perfect_minor": "vMm7",
            "downmajor_perfect_downminor": "vMvm7",
            "downmajor_perfect_subminor": "vMsm7",

            // Neutral-major combinations
            "neutralmajor_perfect_supermajor": "NSM7",
            "neutralmajor_perfect_upmajor": "N^M7",
            "neutralmajor_perfect_major": "Nmaj7",
            "neutralmajor_perfect_downmajor": "NvM7",
            "neutralmajor_perfect_neutralmajor": "NN7",
            "neutralmajor_perfect_neutralminor": "Nn7",
            "neutralmajor_perfect_upminor": "N^m7",
            "neutralmajor_perfect_minor": "Nm7",
            "neutralmajor_perfect_downminor": "Nvm7",
            "neutralmajor_perfect_subminor": "Nsm7",

            // Neutral-minor combinations
            "neutralminor_perfect_supermajor": "nSM7",
            "neutralminor_perfect_upmajor": "n^M7",
            "neutralminor_perfect_major": "nmaj7",
            "neutralminor_perfect_downmajor": "nvM7",
            "neutralminor_perfect_neutralmajor": "nN7",
            "neutralminor_perfect_neutralminor": "nn7",
            "neutralminor_perfect_upminor": "n^m7",
            "neutralminor_perfect_minor": "nm7",
            "neutralminor_perfect_downminor": "nvm7",
            "neutralminor_perfect_subminor": "nsm7",

            // Up-minor combinations
            "upminor_perfect_supermajor": "^mSM7",
            "upminor_perfect_upmajor": "^m^M7",
            "upminor_perfect_major": "^mmaj7",
            "upminor_perfect_downmajor": "^mvM7",
            "upminor_perfect_neutralmajor": "^mN7",
            "upminor_perfect_neutralminor": "^mn7",
            "upminor_perfect_upminor": "^m^m7",
            "upminor_perfect_minor": "^mm7",
            "upminor_perfect_downminor": "^mvm7",
            "upminor_perfect_subminor": "^msm7",
            
            // Minor combinations
            "minor_perfect_supermajor": "mSM7",
            "minor_perfect_upmajor": "m^M7",
            "minor_perfect_major": "mmaj7",
            "minor_perfect_downmajor": "mvM7",
            "minor_perfect_neutralmajor": "mN7",
            "minor_perfect_neutralminor": "mn7",
            "minor_perfect_upminor": "m^m7",
            "minor_perfect_minor": "m7",
            "minor_perfect_downminor": "mvm7",
            "minor_perfect_subminor": "msm7",
            "minor_downperfect_minor": "m7*",
            "minor_upperfect_minor": "m7*",

            // Down-minor combinations
            "downminor_perfect_supermajor": "vmSM7",
            "downminor_perfect_upmajor": "vm^M7",
            "downminor_perfect_major": "vmmaj7",
            "downminor_perfect_downmajor": "vmvM7",
            "downminor_perfect_neutralmajor": "vmN7",
            "downminor_perfect_neutralminor": "vmn7",
            "downminor_perfect_upminor": "vm^m7",
            "downminor_perfect_minor": "vm7",
            "downminor_perfect_downminor": "vmvm7",
            "downminor_perfect_subminor": "vmsm7",

            // Sub-minor combinations
            "subminor_perfect_supermajor": "smSM7",
            "subminor_perfect_upmajor": "sm^M7",
            "subminor_perfect_major": "smmaj7",
            "subminor_perfect_downmajor": "smvM7",
            "subminor_perfect_neutralmajor": "smN7",
            "subminor_perfect_neutralminor": "smn7",
            "subminor_perfect_upminor": "sm^m7",
            "subminor_perfect_minor": "sm7",
            "subminor_perfect_downminor": "smvm7",
            "subminor_perfect_subminor": "smsm7",

            // Half diminished upminor combinations
            "upminor_diminished_supermajor": "øSM7",
            "upminor_diminished_upmajor": "ø^M7",
            "upminor_diminished_major": "ømaj7",
            "upminor_diminished_downmajor": "øvM7",
            "upminor_diminished_neutralmajor": "øN7",
            "upminor_diminished_neutralminor": "øn7",
            "upminor_diminished_upminor": "ø^m7",
            "upminor_diminished_minor": "ø7",
            "upminor_diminished_downminor": "øvm7",
            "upminor_diminished_subminor": "øsm7",

            // Half_Diminished minor combinations
            "minor_diminished_supermajor": "øS7",
            "minor_diminished_upmajor": "ø^M7",
            "minor_diminished_major": "ømaj7",
            "minor_diminished_downmajor": "øvM7",
            "minor_diminished_neutralmajor": "øNM7",
            "minor_diminished_neutralminor": "øn7",
            "minor_diminished_upminor": "øv7",
            "minor_diminished_minor": "ø7",
            "minor_diminished_downminor": "øvm7",
            "minor_diminished_subminor": "øsm7",

            // Half Diminished downminor combinations
            "downminor_diminished_supermajor": "vøS7",
            "downminor_diminished_upmajor": "vø^M7",
            "downminor_diminished_major": "vømaj7",
            "downminor_diminished_downmajor": "vøvM7",
            "downminor_diminished_neutralmajor": "vøN7",
            "downminor_diminished_neutralminor": "vøn7",
            "downminor_diminished_upminor": "vø^m7",
            "downminor_diminished_minor": "vø7",
            "downminor_diminished_downminor": "vøvm7",
            "downminor_diminished_subminor": "vøsm7",

            // Half Diminished subminor combinations
            "subminor_diminished_supermajor": "søS7",
            "subminor_diminished_upmajor": "sø^M7",
            "subminor_diminished_major": "sømaj7",
            "subminor_diminished_downmajor": "søvM7",
            "subminor_diminished_neutralmajor": "søN7",
            "subminor_diminished_neutralminor": "søn7",
            "subminor_diminished_upminor": "sø^m7",
            "subminor_diminished_minor": "sø7",
            "subminor_diminished_downminor": "søvm7",
            "subminor_diminished_subminor": "søsm7",
            
            // Full diminished
            "minor_diminished_updiminished": "o^7",
            "minor_diminished_diminished": "o7",
            "minor_diminished_downdiminished": "ov7",
            "minor_diminished_subdiminished": "ovv7",

            // Augmented combinations
            "major_augmented_super-major": "M+S7",
            "major_augmented_upmajor": "M+^M7",
            "major_augmented_major": "M+maj7",
            "major_augmented_downmajor": "M+vM7",
            "major_augmented_neutral-major": "M+NM7",
            "major_augmented_neutral": "M+N7",
            "major_augmented_neutral-minor": "M+n7",
            "major_augmented_minor": "M+m7",
            "major_augmented_downminor": "M+vm7",
            "major_augmented_subminor": "M+sm7",

            // Add downperfect ones
            "downmajor_downperfect_downmajor": "vMvM*",
            "neutralmajor_diminished_downminor": "Nøvm",
            "neutralminor_diminished_neutralmajor": "nøN"
        };
        
        // C++ Chord.cpp line 962-964: Use root_53 (masterRoot) for interval calculation, not notes[0]
        const masterRoot = this.root_53;
        let thirdQuality = "unknown";
        let fifthQuality = "perfect";
        let seventhQuality = "unknown";
        
        // Calculate intervals from masterRoot (C++ determineChordQualities lines 775-793)
        if (this.notes.length >= 2) {
            const thirdInterval = this.notes[2].ft_note - masterRoot.ft_note;
            if (thirdIntervals[thirdInterval]) {
                thirdQuality = thirdIntervals[thirdInterval];
            }
        }
        
        if (this.notes.length >= 3) {
            const fifthInterval = this.notes[4].ft_note - masterRoot.ft_note;
            if (fifthIntervals[fifthInterval]) {
                fifthQuality = fifthIntervals[fifthInterval];
            }
        }
        
        if (this.notes.length >= 4) {
            const seventhInterval = this.notes[6].ft_note - masterRoot.ft_note;
            if (seventhIntervals[seventhInterval]) {
                seventhQuality = seventhIntervals[seventhInterval];
            }
        }
        
        // Build quality key and lookup (C++ lines 828-829)
        const qualityKey = `${thirdQuality}_${fifthQuality}_${seventhQuality}`;
        const myQuality = chordNames[qualityKey] || "";
        
        // Debug: Log unknown chord qualities
        // if (!chordNames[qualityKey]) {
        //     console.warn(`⚠️ Unknown chord quality: "${qualityKey}" for chord with intervals:`, {
        //         third: this.notes.length >= 2 ? (this.notes[2].ft_note - this.root_53.ft_note) : 'N/A',
        //         fifth: this.notes.length >= 3 ? (this.notes[4].ft_note - this.root_53.ft_note) : 'N/A',
        //         seventh: this.notes.length >= 4 ? (this.notes[6].ft_note - this.root_53.ft_note) : 'N/A'
        //     });
        // }
        
        const rootName = this.notes[0].name.slice(0, -1); // Remove octave
        
        // C++ Chord.cpp lines 686-717 - Determine chord function (Roman numeral)
        const localInterval = this.notes[0].localInterval;
        const functionMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII' };
        const idMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 };
        this.chordFunction = functionMap[localInterval] || 'I';
        
        // Update chord quality string and object
        this.quality = rootName + myQuality;
        
        // Update ChordQuality struct (C++ Chord.cpp lines 686-717)
        this.chordQuality.note = rootName;
        this.chordQuality.quality = myQuality;
        this.chordQuality.function = this.chordFunction;
        this.chordQuality.id = idMap[localInterval] || 1;
        this.chordQuality.notes = this.notes;
        this.chordQuality.inversion = this.globalInversion;
        this.chordQuality.name = this.quality; // Full name
        
        // C++ Chord.cpp line 848 - Construct finalInfo with function in brackets (NO space before [)
        this.finalInfo = this.chordQuality.note + this.chordQuality.quality + '[' + this.chordQuality.function + ']';
        
        // C++ line 967: If no voicing is provided, generate the default one
        if (!hadVoicing) {
            this.selectVoicingBasedOnFunction(this.chordFunction);
        }
        
        // C++ Chord.cpp lines 837-851 - Set default color based on quality
        this.defaultColor = this.getChordColor();
        
        // C++ Chord.cpp lines 976-978: Restore original inversion if needed
        if (this.globalInversion !== 0) {
            this.handleInversions(this.globalInversion);
        }
    }
    
    // C++ Chord.cpp lines 799-810: selectVoicingBasedOnFunction
    selectVoicingBasedOnFunction(chordRoot) {
        // Map chord functions to voicing numbers
        const voicingMap = {
            'I': 0, 'II': 1, 'III': 2, 'IV': 3, 'V': 4, 'VI': 5, 'VII': 6
        };
        
        if (voicingMap[chordRoot] !== undefined) {
            this.numVoicing = voicingMap[chordRoot];
            this.voicing(this.numVoicing);
        } else {
            this.numVoicing = 0;
            this.voicing(0);
        }
    }
    
    getChordQuality() {
        return this.chordQuality;
    }
    
    // C++ Chord.cpp lines 236-264 - Check and add ninth for voice leading
    checkAndAddNinth(baseVoicing) {
        const MAX_DISTANCE = 7;
        
        if (!this.previousVoicing || this.previousVoicing.length === 0) {
            return baseVoicing;
        }
        
        // Get the highest ft_note from previous voicing (previousVoicing contains ft_note values)
        const prevHighestNote = Math.max(...this.previousVoicing);
        
        // Get the highest ft_note from current voicing (convert positions to ft_notes)
        let currentHighestNote = 0;
        for (const pos of baseVoicing) {
            const ftNote = this.notes[pos - 1].ft_note;
            if (ftNote > currentHighestNote) {
                currentHighestNote = ftNote;
            }
        }
        
        // Try each ninth possibility
        for (const ninth of this.upperNinth) {
            const ninthFtNote = this.notes[ninth - 1].ft_note;
            
            // Check distance from previous highest note
            const distFromPrev = Math.abs(ninthFtNote - prevHighestNote);
            
            // Check distance from current highest note
            const distFromCurrent = Math.abs(ninthFtNote - currentHighestNote);
            
            if (distFromPrev <= MAX_DISTANCE || distFromCurrent <= MAX_DISTANCE) {
                baseVoicing.push(ninth);
                return baseVoicing;
            }
        }
        return baseVoicing;
    }
    
    // C++ Chord.cpp lines 367-408 - voicing selection
    voicing(type) {
        if (this.notes.length === 0) return;
        
        // Store the voicing type so we can regenerate after note changes
        this.voicingType = type;
        
        this.noteVoicing = [];
        let baseVoicing = [];
        
        // Get base voicing based on type
        switch(type) {
            case 0: baseVoicing = [...this.voicing_1]; break;
            case 1: baseVoicing = [...this.voicing_2]; break;
            case 2: baseVoicing = [...this.voicing_3]; break;
            case 3: baseVoicing = [...this.voicing_4]; break;
            case 4: baseVoicing = [...this.voicing_5]; break;
            case 5: baseVoicing = [...this.voicing_6]; break;
            case 6: baseVoicing = [...this.voicing_7]; break;
            default: baseVoicing = [...this.voicing_1];
        }
        
        // Check and add ninth if appropriate (C++ Chord.cpp line 399)
        baseVoicing = this.checkAndAddNinth(baseVoicing);
        
        // Convert 1-indexed positions to actual note references
        for (let i = 0; i < baseVoicing.length; i++) {
            const pos = baseVoicing[i] - 1; // Convert to 0-indexed
            if (pos < this.notes.length) {
                this.noteVoicing.push(this.notes[pos].ft_note);
            }
        }
    }
    
    getNoteVoicing() {
        return this.noteVoicing;
    }
    
    // C++ Chord.cpp lines 280-338 - setInversion method  
    setInversion(interval) {
        //console.log(`    🎵 setInversion(${interval}) ENTRY - voicing:`, this.noteVoicing.length, 'notes:', this.notes.length);
        
        if (this.noteVoicing.length === 0 || this.notes.length === 0) {
            //console.log('    ❌ setInversion: No voicing or notes, returning');
            return;
        }
        
        // C++ lines 295-301: Find root reference in notes array
        let ref = -1;
        for (let i = 0; i < this.notes.length; i++) {
            if (this.root_53 && this.root_53.ft_note === this.notes[i].ft_note) {
                ref = i - 1;
                break;
            }
        }
        
        //console.log(`    🎵 setInversion: ref=${ref}, root_53.ft_note=${this.root_53?.ft_note}`);
        
        if (interval === 0) {
            // C++ line 312-314: Restore the original root
            this.noteVoicing[0] = this.root_53.ft_note;
            this.finalInfo = this.chordQuality.note + this.chordQuality.quality + '[' + this.chordQuality.function + ']';
            //console.log(`    ✅ setInversion: ROOT POSITION - finalInfo="${this.finalInfo}"`);
        } else if (interval > 0) {
            // C++ line 317-318: Replace bass note with the interval note
            // Note: ref can be -1 when root is at index 0, so ref+interval gives the correct position
            this.noteVoicing[0] = this.notes[ref + interval].ft_note;
            
            // C++ line 319: Get the new root name
            const newRoot = this.getNoteName(this.notes[ref + interval].ft_note);
            
            // C++ line 322: Remove octave number (e.g., "E1" -> "E")
            const newRootName = newRoot.substring(0, newRoot.length - 1);
            
            // C++ line 325: Update finalInfo with slash notation
            this.finalInfo = this.chordQuality.note + this.chordQuality.quality + '/' + newRootName + '[' + this.chordQuality.function + ']';
            //console.log(`    ✅ setInversion: INVERSION ${interval} - finalInfo="${this.finalInfo}"`);
        }
    }
    
    // C++ Chord.cpp lines 340-368 - handleInversions method
    handleInversions(inversion) {
        //console.log('🎵 handleInversions ENTRY - inversion:', inversion, 'notes:', this.notes.length, 'voicing:', this.noteVoicing.length);
        if (this.notes.length > 0 && this.noteVoicing.length > 0) {
            //console.log('✅ handleInversions proceeding');
            // Map inversion wheel positions to interval positions
            if (inversion === 0) {
                this.setInversion(0);  // Root position
            } else if (inversion === 1) {
                this.setInversion(3);  // Third
            } else if (inversion === 2) {
                this.setInversion(4);  // Fourth
            } else if (inversion === 3) {
                this.setInversion(5);  // Fifth
            } else if (inversion === 4) {
                this.setInversion(7);  // Seventh
            } else if (inversion === 5) {
                this.setInversion(2);  // Ninth
            }
        }
    }
    
    // C++: void Chord::draw() - lines 980-1025
    draw(p, x, y, sizeX, sizeY) {
        // Store position for hit testing
        this.pos = { x, y };
        this.size = { x: sizeX, y: sizeY };
        
        // Determine fill color based on state (C++ lines 983-1000)
        let fillColor;
        if (this.mouseHoverCheck && this.mouseClicked) {
            fillColor = this.chordClicked;
            // Draw pressed state outline
            p.stroke(250);
            p.strokeWeight(1);
            p.noFill();
            p.rect(x, y, sizeX, sizeY, this.rounded);
        } else if (this.mouseHoverCheck) {
            fillColor = this.hoverColor;
        } else {
            fillColor = this.defaultColor;
        }
        
        // Draw button with state-based color
        // Use alpha channel if present (fillColor[3]), otherwise default to 255 (opaque)
        if (fillColor.length > 3) {
            p.fill(fillColor[0], fillColor[1], fillColor[2], fillColor[3]);
        } else {
            p.fill(fillColor[0], fillColor[1], fillColor[2]);
        }
        p.stroke(255);
        p.strokeWeight(1);
        p.rect(x, y, sizeX, sizeY, this.rounded);
        
        // Draw chord quality text (C++ Chord.cpp lines 1010-1020)
        // Use info first (for "Empty", "Drop Here", "Clean"), then finalInfo (quality with function), then quality
        const displayText = (this.info && this.info.length > 0) ? this.info : (this.finalInfo || this.quality);
        
        // Use white text on dark backgrounds, black text on light backgrounds
        const textColor = this.needsWhiteText(fillColor) ? 255 : 0;
        p.fill(textColor);
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(this.myTextSize);
        
        // Check if displayText contains function notation [I], [II], etc.
        const functionMatch = displayText.match(/^(.+)\[(.+)\]$/);
        if (functionMatch) {
            // Split chord quality and function
            const chordPart = functionMatch[1]; // e.g., "Cmaj7" or "Cmaj7/E"
            const functionPart = '[' + functionMatch[2] + ']'; // e.g., "[I]"
            
            // Draw chord quality slightly above center
            p.text(chordPart, x + sizeX / 2, y + sizeY / 2 - 5);
            
            // Draw function below in smaller text
            p.textSize(this.myTextSize * 0.75);
            p.text(functionPart, x + sizeX / 2, y + sizeY / 2 + 8);
        } else {
            // Single line text (for "Empty", "Drop Here", etc.)
            p.text(displayText, x + sizeX / 2, y + sizeY / 2);
        }
    }
    
    // C++ Chord.hpp line 202 - check if mouse is over button
    checkHover(mouseX, mouseY) {
        this.mouseHoverCheck = mouseX >= this.pos.x && 
                               mouseX <= this.pos.x + this.size.x &&
                               mouseY >= this.pos.y && 
                               mouseY <= this.pos.y + this.size.y;
        return this.mouseHoverCheck;
    }
    
    // C++ Chord.hpp line 92 - set clicked state
    setChordClicked(isClicked) {
        this.mouseClicked = isClicked;
    }
    
    // C++ Chord.hpp line 65 - get clicked state
    isClicked() {
        return this.mouseClicked;
    }
    
    // C++ Chord.cpp lines 103-118 - updateVoicing method
    updateVoicing(newVoicing) {
        // Store the new voicing positions
        this.noteVoicing = newVoicing;
        
        // Update root_53 if needed based on first note
        if (newVoicing.length > 0 && this.notes.length > 0) {
            for (const note of this.notes) {
                if (note.ft_note === newVoicing[0]) {
                    this.root = note;
                    break;
                }
            }
        }
        //console.log('Updated voicing:', newVoicing);
    }
    
    // C++ Chord.cpp lines 882-926 - setChordQualityFromVoicing method
    setChordQualityFromVoicing(voicing) {
        //console.log('--------------------------------');
        //console.log('Setting chord quality from voicing:', voicing);
        
        // Track if a valid voicing was provided
        const hasVoicing = voicing && voicing.length > 0;
        
        if (!this.root_53 || voicing.length === 0 || this.notes.length === 0) return;
        
        let theRootReference = this.root_53.ft_note % 53;
        if (theRootReference < 0) theRootReference += 53;
        
        // Normalize voicing to intervals from root
        let normalizedVoicing = [];
        for (let i = 0; i < voicing.length; i++) {
            let noteNum = voicing[i] % 53;
            let interval = noteNum - theRootReference;
            if (interval < 0) interval += 53;
            normalizedVoicing.push(interval);
        }
        
        //console.log('Normalized intervals:', normalizedVoicing);
        
        // Interval maps (same as in setChordQuality)
        const thirdIntervals = {
            10: "subminor", 11: "subminor", 12: "downminor", 13: "minor", 14: "upminor",
            15: "neutralminor", 16: "neutralmajor", 17: "downmajor", 18: "major",
            19: "upmajor", 20: "supermajor"
        };
        const fifthIntervals = {
            26: "diminished", 27: "diminished", 28: "diminished", 29: "diminished",
            30: "perfect", 31: "perfect", 32: "perfect", 33: "augmented",
            34: "augmented", 35: "augmented", 36: "augmented"
        };
        const seventhIntervals = {
            33: "subdiminished", 34: "downdiminished", 35: "diminished", 36: "updiminished",
            42: "subminor", 43: "downminor", 44: "minor", 45: "upminor",
            46: "neutralminor", 47: "neutralmajor", 48: "downmajor", 49: "major",
            50: "upmajor", 51: "supermajor"
        };
        
        // Chord name lookup table (complete table from C++ Chord.hpp lines 287-485)
        const chordNames = {
            "supermajor_perfect_supermajor": "SMSM7", "supermajor_perfect_upmajor": "SM^M7",
            "supermajor_perfect_major": "SMmaj7", "supermajor_perfect_downmajor": "SMvM7",
            "supermajor_perfect_neutralmajor": "SMN7", "supermajor_perfect_neutralminor": "SMn7",
            "supermajor_perfect_upminor": "SM^m7", "supermajor_perfect_minor": "SMm7",
            "supermajor_perfect_downminor": "SMvm7", "supermajor_perfect_subminor": "SMsm7",
            "upmajor_perfect_supermajor": "^MSM7", "upmajor_perfect_upmajor": "^M^M7",
            "upmajor_perfect_major": "^Mmaj7", "upmajor_perfect_downmajor": "^MvM7",
            "upmajor_perfect_neutralmajor": "^MN7", "upmajor_perfect_neutralminor": "^Mn7",
            "upmajor_perfect_upminor": "^M^m7", "upmajor_perfect_minor": "^Mm7",
            "upmajor_perfect_downminor": "^Mvm7", "upmajor_perfect_subminor": "^Msm7",
            "major_perfect_supermajor": "MSM7", "major_perfect_upmajor": "M^M7",
            "major_perfect_major": "maj7", "major_perfect_downmajor": "MvM7",
            "major_perfect_neutralmajor": "MN7", "major_perfect_neutralminor": "Mn7",
            "major_perfect_upminor": "M^m7", "major_perfect_minor": "Mm7",
            "major_perfect_downminor": "Mvm7", "major_perfect_subminor": "Msm7",
            "downmajor_perfect_supermajor": "vMSM7", "downmajor_perfect_upmajor": "vM^M7",
            "downmajor_perfect_major": "vMmaj7", "downmajor_perfect_downmajor": "vMvM7",
            "downmajor_perfect_neutralmajor": "vMN7", "downmajor_perfect_neutralminor": "vMn7",
            "downmajor_perfect_upminor": "vM^m7", "downmajor_perfect_minor": "vMm7",
            "downmajor_perfect_downminor": "vMvm7", "downmajor_perfect_subminor": "vMsm7",
            "neutralmajor_perfect_supermajor": "NSM7", "neutralmajor_perfect_upmajor": "N^M7",
            "neutralmajor_perfect_major": "Nmaj7", "neutralmajor_perfect_downmajor": "NvM7",
            "neutralmajor_perfect_neutralmajor": "NN7", "neutralmajor_perfect_neutralminor": "Nn7",
            "neutralmajor_perfect_upminor": "N^m7", "neutralmajor_perfect_minor": "Nm7",
            "neutralmajor_perfect_downminor": "Nvm7", "neutralmajor_perfect_subminor": "Nsm7",
            "neutralminor_perfect_supermajor": "nSM7", "neutralminor_perfect_upmajor": "n^M7",
            "neutralminor_perfect_major": "nmaj7", "neutralminor_perfect_downmajor": "nvM7",
            "neutralminor_perfect_neutralmajor": "nN7", "neutralminor_perfect_neutralminor": "nn7",
            "neutralminor_perfect_upminor": "n^m7", "neutralminor_perfect_minor": "nm7",
            "neutralminor_perfect_downminor": "nvm7", "neutralminor_perfect_subminor": "nsm7",
            "upminor_perfect_supermajor": "^mSM7", "upminor_perfect_upmajor": "^m^M7",
            "upminor_perfect_major": "^mmaj7", "upminor_perfect_downmajor": "^mvM7",
            "upminor_perfect_neutralmajor": "^mN7", "upminor_perfect_neutralminor": "^mn7",
            "upminor_perfect_upminor": "^m^m7", "upminor_perfect_minor": "^mm7",
            "upminor_perfect_downminor": "^mvm7", "upminor_perfect_subminor": "^msm7",
            "minor_perfect_supermajor": "mSM7", "minor_perfect_upmajor": "m^M7",
            "minor_perfect_major": "mmaj7", "minor_perfect_downmajor": "mvM7",
            "minor_perfect_neutralmajor": "mN7", "minor_perfect_neutralminor": "mn7",
            "minor_perfect_upminor": "m^m7", "minor_perfect_minor": "m7",
            "minor_perfect_downminor": "mvm7", "minor_perfect_subminor": "msm7",
            "minor_downperfect_minor": "m7*", "minor_upperfect_minor": "m7*",
            "downminor_perfect_supermajor": "vmSM7", "downminor_perfect_upmajor": "vm^M7",
            "downminor_perfect_major": "vmmaj7", "downminor_perfect_downmajor": "vmvM7",
            "downminor_perfect_neutralmajor": "vmN7", "downminor_perfect_neutralminor": "vmn7",
            "downminor_perfect_upminor": "vm^m7", "downminor_perfect_minor": "vm7",
            "downminor_perfect_downminor": "vmvm7", "downminor_perfect_subminor": "vmsm7",
            "subminor_perfect_supermajor": "smSM7", "subminor_perfect_upmajor": "sm^M7",
            "subminor_perfect_major": "smmaj7", "subminor_perfect_downmajor": "smvM7",
            "subminor_perfect_neutralmajor": "smN7", "subminor_perfect_neutralminor": "smn7",
            "subminor_perfect_upminor": "sm^m7", "subminor_perfect_minor": "sm7",
            "subminor_perfect_downminor": "smvm7", "subminor_perfect_subminor": "smsm7",
            "upminor_diminished_supermajor": "øSM7", "upminor_diminished_upmajor": "ø^M7",
            "upminor_diminished_major": "ømaj7", "upminor_diminished_downmajor": "øvM7",
            "upminor_diminished_neutralmajor": "øN7", "upminor_diminished_neutralminor": "øn7",
            "upminor_diminished_upminor": "ø^m7", "upminor_diminished_minor": "ø7",
            "upminor_diminished_downminor": "øvm7", "upminor_diminished_subminor": "øsm7",
            "minor_diminished_supermajor": "øS7", "minor_diminished_upmajor": "ø^M7",
            "minor_diminished_major": "ømaj7", "minor_diminished_downmajor": "øvM7",
            "minor_diminished_neutralmajor": "øNM7", "minor_diminished_neutralminor": "øn7",
            "minor_diminished_upminor": "øv7", "minor_diminished_minor": "ø7",
            "minor_diminished_downminor": "øvm7", "minor_diminished_subminor": "øsm7",
            "downminor_diminished_supermajor": "vøS7", "downminor_diminished_upmajor": "vø^M7",
            "downminor_diminished_major": "vømaj7", "downminor_diminished_downmajor": "vøvM7",
            "downminor_diminished_neutralmajor": "vøN7", "downminor_diminished_neutralminor": "vøn7",
            "downminor_diminished_upminor": "vø^m7", "downminor_diminished_minor": "vø7",
            "downminor_diminished_downminor": "vøvm7", "downminor_diminished_subminor": "vøsm7",
            "subminor_diminished_supermajor": "søS7", "subminor_diminished_upmajor": "sø^M7",
            "subminor_diminished_major": "sømaj7", "subminor_diminished_downmajor": "søvM7",
            "subminor_diminished_neutralmajor": "søN7", "subminor_diminished_neutralminor": "søn7",
            "subminor_diminished_upminor": "sø^m7", "subminor_diminished_minor": "sø7",
            "subminor_diminished_downminor": "søvm7", "subminor_diminished_subminor": "søsm7",
            "minor_diminished_updiminished": "o^7", "minor_diminished_diminished": "o7",
            "minor_diminished_downdiminished": "ov7", "minor_diminished_subdiminished": "ovv7",
            "major_augmented_super-major": "M+S7", "major_augmented_upmajor": "M+^M7",
            "major_augmented_major": "M+maj7", "major_augmented_downmajor": "M+vM7",
            "major_augmented_neutral-major": "M+NM7", "major_augmented_neutral": "M+N7",
            "major_augmented_neutral-minor": "M+n7", "major_augmented_minor": "M+m7",
            "major_augmented_downminor": "M+vm7", "major_augmented_subminor": "M+sm7",
            "downmajor_downperfect_downmajor": "vMvM*",
            "neutralmajor_diminished_downminor": "Nøvm",
            "neutralminor_diminished_neutralmajor": "nøN"
        };
        
        let thirdQuality = "unknown";
        let fifthQuality = "perfect";
        let seventhQuality = "unknown";
        
        // Find qualities based on intervals
        for (const interval of normalizedVoicing) {
            if (interval >= 10 && interval <= 20 && thirdIntervals[interval]) {
                thirdQuality = thirdIntervals[interval];
            }
            if (interval >= 26 && interval <= 36 && fifthIntervals[interval]) {
                fifthQuality = fifthIntervals[interval];
            }
            if ((interval >= 33 && interval <= 36) || (interval >= 42 && interval <= 51)) {
                if (seventhIntervals[interval]) {
                    seventhQuality = seventhIntervals[interval];
                }
            }
        }
        
        //console.log(`Qualities - Third: ${thirdQuality}, Fifth: ${fifthQuality}, Seventh: ${seventhQuality}`);
        
        // Build quality key and lookup chord name (C++ lines 917-920)
        const qualityKey = `${thirdQuality}_${fifthQuality}_${seventhQuality}`;
        const myQuality = chordNames[qualityKey] || "";
        
        // Get root note name without octave
        const rootName = this.root.name.slice(0, -1);
        
        // C++ Chord.cpp lines 686-717 - Determine chord function (Roman numeral)
        const localInterval = this.notes[0].localInterval;
        const functionMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII' };
        const idMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 };
        this.chordFunction = functionMap[localInterval] || 'I';
        
        // Update chord quality string (C++ line 923)
        this.quality = rootName + myQuality;
        
        // Update ChordQuality struct (matching setChordQuality logic)
        this.chordQuality.note = rootName;
        this.chordQuality.quality = myQuality;
        this.chordQuality.function = this.chordFunction;
        this.chordQuality.id = idMap[localInterval] || 1;
        this.chordQuality.notes = this.notes;
        this.chordQuality.inversion = this.globalInversion;
        this.chordQuality.name = this.quality; // Full name
        
        // C++ Chord.cpp line 848 - Construct finalInfo with function in brackets (NO space before [)
        this.finalInfo = this.chordQuality.note + this.chordQuality.quality + '[' + this.chordQuality.function + ']';
        
        // C++ Chord.cpp lines 968-970: If no voicing is provided, generate the default one
        if (!hasVoicing) {
            this.selectVoicingBasedOnFunction(this.chordQuality.function);
        }
        
        // C++ Chord.cpp lines 837-851 - Set default color based on quality
        this.defaultColor = this.getChordColor();
        
        // C++ Chord.cpp lines 974-977: Restore original inversion if needed
        //console.log('🔍 Before handleInversions check - globalInversion:', this.globalInversion, 'noteVoicing.length:', this.noteVoicing.length);
        if (this.globalInversion !== 0) {
            //console.log('✅ Calling handleInversions with:', this.globalInversion);
            this.handleInversions(this.globalInversion);
        } else {
            //console.log('❌ SKIPPED handleInversions - globalInversion is 0');
        }
        //console.log('--------------------------------');
    }
    
    // Helper methods for Grid integration
    setColor(color) {
        if (Array.isArray(color)) {
            this.defaultColor = color;
        } else {
            // p5 color object - extract RGB
            this.defaultColor = [color.levels[0], color.levels[1], color.levels[2]];
        }
    }
    
    getColor() {
        return this.defaultColor;
    }
    
    getNotes() {
        return this.notes;
    }
    
    getInfo() {
        return this.quality;
    }
    
    setInfo(text) {
        this.info = text;
        this.quality = text;
        // Also update chordFunction to match C++ behavior (Chord.cpp lines 590-596)
        this.chordFunction = text;
    }
    
    setRound(rounded) {
        this.rounded = rounded;
    }
    
    getGlobalInversion() {
        return this.globalInversion;
    }
    
    // C++ Chord.hpp line 125: int getChordId(){return chordQuality.id;}
    getChordId() {
        return this.chordQuality.id;
    }
    
    // C++ Chord.hpp line 99: void setPreviousVoicing(const vector<int> &prevVoicing)
    setPreviousVoicing(prevVoicing) {
        this.previousVoicing = prevVoicing || [];
    }
    
    // C++ Chord.cpp line 100: vector<int> getNoteVoicing()
    getNoteVoicing() {
        return this.noteVoicing || [];
    }
    
    setGlobalInversion(inversion) {
        this.globalInversion = inversion;
    }
}
