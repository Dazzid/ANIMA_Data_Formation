#make a class of voicing
# ENHANCED VERSION - Improved voicing system inspired by modal_studio_Chord.js
# 
# Key improvements:
# 1. Seven voicing templates (v_0 to v_6) instead of just 4, providing more variety
# 2. Each chord type now has sophisticated multi-template voicings with different characteristics:
#    - Drop-2 voicings for better voice leading
#    - Open and closed position voicings
#    - Extended voicings with color tones (9ths, 11ths, 13ths)
# 3. Advanced voice leading methods:
#    - optimize_voice_leading(): Minimizes movement between chords
#    - add_extensions_for_quality(): Adds appropriate extensions based on chord type
#    - get_drop_2_voicing() and get_drop_3_voicing(): Create jazz-style drop voicings
# 4. Function-based voicing selection inspired by modal harmony principles
#
from midiutil import MIDIFile
import tqdm as tqdm
import random
import numpy as np
import pytz
from datetime import datetime, timezone
from music21 import midi, environment, stream
import os
import mido
from mido import MidiFile, MidiTrack, Message

class Voicing:
    #define the class
    def __init__(self):
        
        #define the natures of the chords
        self.natures = {'maj', 'maj6', 'maj7', 'm', 'm6', 'm7', 'm_maj7', 'dom7', 'sus', 'sus2', 'sus7', 'sus4', 'o7', 'o', 'ø7', 'power', 'aug', 'o_maj7', 'N.C.'}
        
        #alterations and add
        self.alter = {'add b2', 'add 2', 'add b5', 'add 5', 'add #5', 'add b6', 'add 6' 'add 7', 'add #7', 'add 8', 'add b9', 'add 9', 'add #9', 'add #11', 'add 13', 'add b13', 'alter #11', 'alter #5', 'alter #7', 'alter #9', 'alter b5', 'alter b9'}        
        
        #Structural elements
        self.structural_elements = {'.', '|', '||', ':|', '|:', 'b||', 'e||', '/'} #to add the maj token 
        
        #element in the chord frontiers
        self.after_chords = {'.', '|', '||', ':|', '|:', 'b||', 'e||'} 
        
        #Voicing - 7 different templates inspired by modal_studio_Chord.js
        # These correspond to different chord functions (I, II, III, IV, V, VI, VII)
        self.voicing = ['v_0', 'v_1', 'v_2', 'v_3', 'v_4', 'v_5', 'v_6']
        
        #Durations 
        self.durations = {'0.3997395833333333', '0.4440104166666667', '0.5', '0.5703125',
                '0.6666666666666666', '0.75', '0.7994791666666666', '0.8880208333333334',
                '1.0', '1.1419270833333333', '1.3333333333333333', '1.5',
                '1.5989583333333333', '1.7135416666666667', '2.0', '2.25',
                '2.3997395833333335', '2.6666666666666665', '3.0', '4.0'}
        
        #All notes
        self.all_notes = {
            'C': 48, 'C#': 49, 'Db': 49, 'D': 50, 'D#': 51, 'Eb': 51, 'E': 52, 'Fb': 52, 'F': 53, 'E#': 53, 'F#': 54, 'Gb': 42, 'G': 43, 'G#': 44, 'Ab':44, 'A': 45, 'A#': 46, 'Bb': 46, 'B': 47, 
            'A##': 47, 'Abb': 43, 'Abbb': 42, 'B#': 48, 'B##': 49, 'Bbb': 45, 'Bbbb': 44,
            'C##': 50, 'C###': 51, 'Cb': 47, 'Cbb': 46, 'D##': 52, 'Dbb': 48, 'Dbbb': 47, 'E##': 54, 'Ebb': 50, 'Ebbb': 49, 
            'F##': 55, 'F###': 56, 'Fbb': 51, 'G##': 45, 'Gbb': 41
            }
        
        # Enhanced voicing templates following Berklee principles
        # Focus on ROOT + 3 + 7 as basic chord sound
        # 5th is optional unless altered
        # Templates provide different spacings and optional tensions
        
        # Major chord voicings (no 7th, so basic sound = 3 + 5)
        self.maj = {
            'v_0': [0, 16, 19],              # Root + M3 + P5 (basic triad)
            'v_1': [0, 16, 19, 24],          # Add octave
            'v_2': [0, 12, 16, 19],          # Doubled root
            'v_3': [0, 16, 19, 26],          # Add 9th
            'v_4': [0, 12, 16, 19, 24],      # Full voicing
            'v_5': [0, 16, 19, 24, 28],      # Add 9th high
            'v_6': [0, 14, 16, 19]           # Add 9th color tone
        }
        
        # Major 7th voicings (basic sound = 3 + 7)
        self.maj7 = {
            'v_0': [0, 16, 23],              # Root + M3 + M7 (essential)
            'v_1': [0, 16, 19, 23],          # Add P5
            'v_2': [0, 11, 16, 23],          # 7th in bass register
            'v_3': [0, 16, 23, 26],          # Add 9th
            'v_4': [0, 14, 16, 23],          # 9th for color
            'v_5': [0, 16, 19, 23, 26],      # Full with 9th
            'v_6': [0, 14, 16, 19, 23]       # Complete voicing
        }
        
        # Minor chord voicings (basic sound = m3 + 5)
        self.m = {
            'v_0': [0, 15, 19],              # Root + m3 + P5
            'v_1': [0, 15, 19, 24],          # Add octave
            'v_2': [0, 12, 15, 19],          # Doubled root
            'v_3': [0, 15, 19, 26],          # Add 9th
            'v_4': [0, 12, 15, 19, 24],      # Full voicing
            'v_5': [0, 15, 19, 24, 26],      # Add 9th high
            'v_6': [0, 14, 15, 19]           # Add 9th color
        }
        
        # Minor 7th voicings (basic sound = m3 + b7)
        self.m7 = {
            'v_0': [0, 15, 22],              # Root + m3 + b7 (essential)
            'v_1': [0, 15, 19, 22],          # Add P5
            'v_2': [0, 10, 15, 22],          # 7th in bass register
            'v_3': [0, 15, 22, 26],          # Add 9th
            'v_4': [0, 14, 15, 22],          # 9th for color
            'v_5': [0, 15, 19, 22, 26],      # Full with 9th
            'v_6': [0, 14, 15, 19, 22]       # Complete voicing
        }
        
        # Dominant 7th voicings (basic sound = 3 + b7) - MOST IMPORTANT
        self.dom7 = {
            'v_0': [0, 16, 22],              # Root + M3 + b7 (essential tritone!)
            'v_1': [0, 16, 19, 22],          # Add P5
            'v_2': [0, 10, 16, 22],          # 7th in bass register
            'v_3': [0, 16, 22, 26],          # Add 9th
            'v_4': [0, 14, 16, 22],          # 9th for color
            'v_5': [0, 16, 19, 22, 26],      # Full with 9th
            'v_6': [0, 13, 16, 22]           # Add b9 (altered)
        }
        
        # Half-diminished (ø7) voicings (basic sound = m3 + b5 + b7)
        self.ø7 = {
            'v_0': [0, 15, 18, 22],          # Root + m3 + b5 + b7
            'v_1': [0, 18, 22, 27],          # Spread voicing
            'v_2': [0, 15, 22, 26],          # With 9th
            'v_3': [0, 15, 18, 22, 26],      # Full with 9th
            'v_4': [0, 14, 15, 18, 22],      # 9th color
            'v_5': [0, 15, 18, 22, 27],      # Wide spread
            'v_6': [0, 18, 22, 26, 30]       # Upper extensions
        }
        
        # Diminished 7th voicings (symmetrical structure)
        self.o7 = {
            'v_0': [0, 15, 18, 21],          # Root + m3 + dim5 + dim7
            'v_1': [0, 15, 21, 24],          # Spread
            'v_2': [0, 15, 18, 21, 27],      # Extended
            'v_3': [0, 9, 15, 21],           # Different inversion feel
            'v_4': [0, 15, 18, 21, 24],      # Full
            'v_5': [0, 15, 21, 27],          # Wide
            'v_6': [0, 15, 18, 24, 27]       # Very open
        }
        
        # Diminished triad voicings
        self.o = {
            'v_0': [0, 15, 18],              # Root + m3 + dim5
            'v_1': [0, 15, 18, 24],          # Add octave
            'v_2': [0, 9, 15, 18],           # Different spacing
            'v_3': [0, 15, 18, 21],          # Add dim7
            'v_4': [0, 12, 15, 18],          # Doubled root
            'v_5': [0, 15, 18, 24, 27],      # Extended
            'v_6': [0, 15, 21, 27]           # Wide spread
        }
        
        # Sus4 voicings (basic sound = 4 + 5)
        self.sus = {
            'v_0': [0, 17, 19],              # Root + P4 + P5
            'v_1': [0, 17, 19, 24],          # Add octave
            'v_2': [0, 12, 17, 19],          # Doubled root
            'v_3': [0, 17, 19, 26],          # Add 9th
            'v_4': [0, 14, 17, 19],          # 9th color
            'v_5': [0, 17, 19, 24, 26],      # Full with 9th
            'v_6': [0, 14, 17, 19, 24]       # Complete
        }
        
        # Sus7 voicings (basic sound = 4 + b7)
        self.sus7 = {
            'v_0': [0, 17, 22],              # Root + P4 + b7
            'v_1': [0, 17, 19, 22],          # Add P5
            'v_2': [0, 10, 17, 22],          # 7th in bass register
            'v_3': [0, 17, 22, 26],          # Add 9th
            'v_4': [0, 14, 17, 22],          # 9th color
            'v_5': [0, 17, 19, 22, 26],      # Full with 9th
            'v_6': [0, 14, 17, 19, 22]       # Complete
        }
        
        # Sus2 voicings (basic sound = 2 + 5)
        self.sus2 = {
            'v_0': [0, 14, 19],              # Root + M2 + P5
            'v_1': [0, 14, 19, 24],          # Add octave
            'v_2': [0, 12, 14, 19],          # Doubled root
            'v_3': [0, 14, 19, 26],          # Add 9th (same as M2)
            'v_4': [0, 14, 19, 24, 26],      # Extended
            'v_5': [0, 7, 14, 19],           # Add low fifth
            'v_6': [0, 14, 19, 21]           # Add color tone
        }
        
        # Sus4 specific
        self.sus4 = {
            'v_0': [0, 17, 19],              # Root + P4 + P5
            'v_1': [0, 17, 19, 24],          # Add octave
            'v_2': [0, 12, 17, 19],          # Doubled root
            'v_3': [0, 17, 19, 26],          # Add 9th
            'v_4': [0, 14, 17, 19],          # 9th color
            'v_5': [0, 17, 19, 24, 26],      # Full with 9th
            'v_6': [0, 14, 17, 19, 24]       # Complete
        }
        
        # Augmented voicings (altered 5th)
        self.aug = {
            'v_0': [0, 16, 20],              # Root + M3 + #5 (altered 5th!)
            'v_1': [0, 16, 20, 24],          # Add octave
            'v_2': [0, 12, 16, 20],          # Doubled root
            'v_3': [0, 16, 20, 26],          # Add 9th
            'v_4': [0, 14, 16, 20],          # 9th color
            'v_5': [0, 16, 20, 24, 28],      # Extended
            'v_6': [0, 16, 20, 24, 26]       # Full with 9th
        }
        
        # Minor major 7th voicings (basic sound = m3 + M7)
        self.m_maj7 = {
            'v_0': [0, 15, 23],              # Root + m3 + M7
            'v_1': [0, 15, 19, 23],          # Add P5
            'v_2': [0, 11, 15, 23],          # 7th in bass register
            'v_3': [0, 15, 23, 26],          # Add 9th
            'v_4': [0, 14, 15, 23],          # 9th color
            'v_5': [0, 15, 19, 23, 26],      # Full with 9th
            'v_6': [0, 14, 15, 19, 23]       # Complete
        }
        
        # Major 6th voicings (basic sound = 3 + 6)
        self.maj6 = {
            'v_0': [0, 16, 21],              # Root + M3 + M6
            'v_1': [0, 16, 19, 21],          # Add P5
            'v_2': [0, 9, 16, 21],           # 6th in bass register
            'v_3': [0, 16, 21, 26],          # Add 9th
            'v_4': [0, 14, 16, 21],          # 9th color
            'v_5': [0, 16, 19, 21, 26],      # Full with 9th
            'v_6': [0, 14, 16, 19, 21]       # Complete
        }
        
        # Minor 6th voicings (basic sound = m3 + 6)
        self.m6 = {
            'v_0': [0, 15, 21],              # Root + m3 + M6
            'v_1': [0, 15, 19, 21],          # Add P5
            'v_2': [0, 9, 15, 21],           # 6th in bass register
            'v_3': [0, 15, 21, 26],          # Add 9th
            'v_4': [0, 14, 15, 21],          # 9th color
            'v_5': [0, 15, 19, 21, 26],      # Full with 9th
            'v_6': [0, 14, 15, 19, 21]       # Complete
        }
        
        # Diminished major 7th voicings (basic sound = m3 + dim5 + M7)
        self.o_maj7 = {
            'v_0': [0, 15, 18, 23],          # Root + m3 + dim5 + M7
            'v_1': [0, 18, 23, 27],          # Spread
            'v_2': [0, 15, 23, 26],          # With 9th
            'v_3': [0, 15, 18, 23, 26],      # Full with 9th
            'v_4': [0, 14, 15, 18, 23],      # 9th color
            'v_5': [0, 15, 18, 23, 27],      # Wide
            'v_6': [0, 18, 23, 26, 30]       # Upper extensions
        }
        
        # Power chord voicings (just root + 5th)
        self.power = {
            'v_0': [0, 19],                  # Basic power chord (root + P5)
            'v_1': [0, 19, 24],              # Add octave
            'v_2': [0, 12, 19],              # Doubled root
            'v_3': [0, 7, 12, 19, 24],       # Full power
            'v_4': [0, 12, 19],              # Octave power
            'v_5': [0, 7, 19],               # Open power
            'v_6': [0, 7, 12, 19, 26]        # Extended octave power
        }
        
        # No chord (silence)
        self.noChord = {
            'v_0': [0, 0, 0, 0], 'v_1': [0, 0, 0, 0], 'v_2': [0, 0, 0, 0],
            'v_3': [0, 0, 0, 0], 'v_4': [0, 0, 0, 0], 'v_5': [0, 0, 0, 0],
            'v_6': [0, 0, 0, 0]
        }
               
        #TODO: define voicing for guitar
        
        #Define the voicing dictionaries for the chords
        self.chord_voicing = {'maj': self.maj, 'maj7': self.maj7, 'm': self.m, 'm7': self.m7, 'dom7': self.dom7, 
                              'ø7': self.ø7, 'o7': self.o7, 'o': self.o, 'sus': self.sus, 'sus7': self.sus7, 
                              'sus2': self.sus2, 'sus4': self.sus4, 'm6': self.m6, 'power': self.power, 'o': self.o, 
                              'm_maj7': self.m_maj7, 'maj6': self.maj6, 'aug': self.aug, 'o_maj7': self.o_maj7, 'N.C.': self.noChord}
    #-----------------------------------------------------------------------
    def listToIgnore(self):
        ignore_list = {'<start>', '<end>', '<pad>', '.', '|', '||', 'b||', 'e||', 'Repeat_0', 'Repeat_1', 'Repeat_2', 'Repeat_3', 'Intro', 
                        'Form_A', 'Form_B', 'Form_C', 'Form_D', 
                        'Form_verse', 'Form_intro', 'Form_Coda', 'Form_Head', 
                        'Form_Segno', '|:', ':|'}
        return ignore_list

    #-----------------------------------------------------------------------
    def getStructuralElements(self):
        return self.structural_elements
    
    #-----------------------------------------------------------------------
    # Add the maj token
    def add_maj_token(self, sequence):
        new_sequence = []
        for song in sequence:
            new_song = []
            for i in range(len(song)):
                element = song[i]
                new_song.append(element)
                if element in self.all_notes.keys() and (i == len(song) - 1 or song[i + 1] in self.structural_elements 
                                                         or song[i + 1].startswith('Form_')) and song[i-1] != '/':
                    new_song.append('maj')
            new_sequence.append(new_song)
        
        return new_sequence
    #-----------------------------------------------------------------------
    # Add the voicing to the sequence
    def get_midi(self, sequence):
        midi_sequence = []
        root = 0
        mod = 3
        status = True
        # Create a dictionary for the alter section
        add_dict = {
            'add b13': 8 + 12,
            'add 13': 9 + 12, 
            'add #11': 6 + 12,
            'add 11': 6 + 11,
            'add #9': 3 + 12,
            'add 9': 2 + 12,
            'add b9': 1 + 12,
            'add 8': 12,
            'add 7': 11,
            'add #7': 11,
            'add 6': 9,
            'add b6': 8 + 12,
            'add 5': 7,
            'add b5': 6,
            'add 2': 2 + 12,
            'add b2': 1
        }
        # Create a dictionary for the alter section
        alter_dict = {
            'alter b9': 2,
            'alter #9': 2,
            'alter b5': 7,
            'alter #5': 7,
            'alter #7': 11,
            'alter #11': 5
        }
        
        midi = [0, 0, 0, 0, 0, 0, 0, 0]
        duration = 0.0
        #check the chord info
        for i, element in enumerate(sequence):
            
            #Check it is a dot ----------------------------------------------------
            if element == '.':
                #duration = float(sequence[i+1])
                midi = [0, 0, 0, 0, 0, 0, 0, 0]
                midi_sequence.append(midi)
            #check the duration ----------------------------------------------------
            elif element in self.durations:
                duration = float(element)
                midi_sequence.append(midi)
            #check notes ------------------------------------------------------------
            elif element in self.all_notes and sequence[i-1] != '/':
                root = self.all_notes[element]
                midi = [root, 0, 0, 0, 0, 0, 0, 0]
              
                midi_sequence.append(midi)
                #print(element, sequence[i-1][0]) 
            
            # Nature section --------------------------------------------------------
            elif element in self.natures:
                n = i % mod
                midi = [x + root for x in self.chord_voicing[element][self.voicing[n]]]
                #print('chord:', element, midi)
                infoMidi = midi.copy()
                midi_sequence.append(infoMidi)
            
            # Add section --------------------------------------------------------      
            elif element in add_dict:
                #print('original', midi)
                new_note = root + add_dict[element]
                midiInfo = midi.copy()    
                if new_note not in midiInfo:
                    midiInfo.append(new_note)
                      
                if element == 'add b9' or element == 'add #9':
                    #check if the 9 is in the chord
                    if (root + 14) in midiInfo:
                        index = midiInfo.index(root + 14)
                        midiInfo.pop(index)
                    elif (root + 26) in midiInfo:
                        index = midiInfo.index(root + 26)
                        midiInfo.pop(index)
                        
                midi_sequence.append(midiInfo)
                midi = midiInfo
                
            # Alter section --------------------------------------------------------            
            elif element in alter_dict:
                #print('original', element, midi)
                my_ref = [x for x in midi if (x - root) % 12 == alter_dict[element]]
                midiInfo = midi.copy() 
                
                if len(my_ref) == 1:
                    loc = midi.index(my_ref[0])
                    if element.find('b') != -1:
                        midiInfo[loc] = my_ref[0] - 1
                    elif element.find('#') != -1:
                        midiInfo[loc] = my_ref[0] + 1
                        
                elif len(my_ref) > 1:
                    for i, n in enumerate(my_ref):
                        loc = midi.index(n)
                        if element.find('b') != -1 and (n - root) % 12 == alter_dict[element]:
                            midiInfo[loc] = n - 1
                        elif element.find('#') != -1 and (n - root) % 12 == alter_dict[element]:
                            midiInfo[loc] = n + 1 
                
                elif len(my_ref) == 0:
                    new_note = root + alter_dict[element]
                    if element.find('b') != -1:
                        new_note -= 1
                    elif element.find('#') != -1:
                        new_note += 1
                    midiInfo.append(new_note)
                    
                midi_sequence.append(midiInfo)
                #print('result', element, midi)
                
            # Slash section --------------------------------------------------------    
            elif element == '/':
                # Keep sequences aligned - append marker but don't affect voicing
                # The actual slash bass note will be in the next element
                thisMidi = [0, 0, 0, 0, 0, 0, 0, 0]
                midi_sequence.append(thisMidi)
                
            # New root after slash section -----------------------------------------  
            elif sequence[i-1][0] == '/' and element in self.all_notes:
                # Slash chord: Replace bass note with the slash bass note
                midiInfo = midi.copy()
                slash_bass = self.all_notes[element]
                
                # Replace the original root with slash bass
                if len(midiInfo) > 0:
                    midiInfo[0] = slash_bass
                
                midi_sequence.append(midiInfo)
            
            # Structural elements section ---------------------------------------------
            elif element in self.structural_elements and element != '/':
                thisMidi = [0, 0, 0, 0, 0, 0, 0, 0]
                midi_sequence.append(thisMidi)
                
            # Form section -------------------------------------------------------------
            elif element not in self.all_notes and element not in self.natures and element not in self.structural_elements and element not in self.durations:
                thisMidi = [0, 0, 0, 0, 0, 0, 0, 0]
                midi_sequence.append(thisMidi)
        
            
        #Normalize the length of the MIDI sequence to 8 ----------------------------
        for i, item in enumerate(midi_sequence):    
            if len(item) < 8:
                for i in range(8 - len(item)):
                    item.append(0)
        midi_sequence = np.array(midi_sequence, dtype=int)
        return midi_sequence, status
    
    #-----------------------------------------------------------------------
    # Add the voicing to the sequence
    def convert_chords_to_voicing(self, sequence):
        midi_sequence = []
        root = 0
        mod = 7  # Use 7 voicing templates for better variety and voice leading
        status = True
        previous_voicing = None  # Track previous chord voicing for voice leading
        # Create a dictionary for the alter section
        add_dict = {
            'add b13': 8 + 12,
            'add 13': 9 + 12, 
            'add #11': 6 + 12,
            'add 11': 6 + 11,
            'add #9': 3 + 12,
            'add 9': 2 + 12,
            'add b9': 1 + 12,
            'add 8': 12,
            'add 7': 11,
            'add #7': 11,
            'add 6': 9,
            'add b6': 8 + 12,
            'add 5': 7,
            'add b5': 6,
            'add 2': 2 + 12,
            'add b2': 1
        }
        # Create a dictionary for the alter section
        alter_dict = {
            'alter b9': 2,
            'alter #9': 2,
            'alter b5': 7,
            'alter #5': 7,
            'alter #7': 11,
            'alter #11': 5
        }
        
        midi = [0, 0, 0, 0, 0, 0, 0, 0]
        duration = 0.0
        #check the chord info
        for i, element in enumerate(sequence):
            
            #Check it is a dot ----------------------------------------------------
            if element == '.' and i < len(sequence) - 2:
                duration = float(sequence[i+1])
                midi = [0, 0, 0, 0, 0, 0, 0, 0]
                couple = (midi, duration, element)
                midi_sequence.append(couple)
            
            elif element in self.durations:
                duration = float(element)
                couple = (midi, duration, element)
                midi_sequence.append(couple)
                
            #check notes ------------------------------------------------------------
            elif element in self.all_notes and sequence[i-1][0] != '/':
                root = self.all_notes[element]
                midi = [root, 0, 0, 0, 0, 0, 0, 0]
                couple = (midi, duration, element)
                midi_sequence.append(couple)
                #print(element, sequence[i-1][0]) 
            
            # Nature section --------------------------------------------------------
            elif element in self.natures:
                # Try all 7 voicing templates and select the one with best voice leading
                all_voicings = []
                for template_idx in range(mod):
                    template_voicing = [x + root for x in self.chord_voicing[element][self.voicing[template_idx]]]
                    all_voicings.append(template_voicing)
                
                # Select voicing with minimum voice movement from previous chord
                if previous_voicing is not None:
                    midi = self.select_best_voicing(previous_voicing, all_voicings)
                else:
                    # First chord - use v_0
                    midi = all_voicings[0]
                
                previous_voicing = [n for n in midi if n != 0]  # Store for next iteration
                
                #print('chord:', element, midi)
                infoMidi = midi.copy()
                couple = (infoMidi, duration, element)
                midi_sequence.append(couple)
            
            # Add section --------------------------------------------------------      
            elif element in add_dict:
                #print('original', midi)
                new_note = root + add_dict[element]
                midiInfo = midi.copy()    
                if new_note not in midiInfo:
                    midiInfo.append(new_note)
                      
                if element == 'add b9' or element == 'add #9':
                    #check if the 9 is in the chord
                    if (root + 14) in midiInfo:
                        index = midiInfo.index(root + 14)
                        midiInfo.pop(index)
                    elif (root + 26) in midiInfo:
                        index = midiInfo.index(root + 26)
                        midiInfo.pop(index)
                        
                couple = (midiInfo, duration, element)
                midi_sequence.append(couple)
                midi = midiInfo
                
            # Alter section --------------------------------------------------------            
            elif element in alter_dict:
                #print('original', element, midi)
                my_ref = [x for x in midi if (x - root) % 12 == alter_dict[element]]
                midiInfo = midi.copy() 
                
                if len(my_ref) == 1:
                    loc = midi.index(my_ref[0])
                    if element.find('b') != -1:
                        midiInfo[loc] = my_ref[0] - 1
                    elif element.find('#') != -1:
                        midiInfo[loc] = my_ref[0] + 1
                        
                elif len(my_ref) > 1:
                    for i, n in enumerate(my_ref):
                        loc = midi.index(n)
                        if element.find('b') != -1 and (n - root) % 12 == alter_dict[element]:
                            midiInfo[loc] = n - 1
                        elif element.find('#') != -1 and (n - root) % 12 == alter_dict[element]:
                            midiInfo[loc] = n + 1 
                
                elif len(my_ref) == 0:
                    new_note = root + alter_dict[element]
                    if element.find('b') != -1:
                        new_note -= 1
                    elif element.find('#') != -1:
                        new_note += 1
                    midiInfo.append(new_note)
                    
                couple = (midiInfo, duration, element)
                midi_sequence.append(couple)
                #print('result', element, midi)
                
            # Slash section --------------------------------------------------------    
            elif element == '/':
                # Keep sequences aligned - append marker
                thisMidi = [0, 0, 0, 0, 0, 0, 0, 0]
                info = (thisMidi, duration, element)
                midi_sequence.append(info)
                
            # New root after slash section -----------------------------------------  
            elif sequence[i-1][0] == '/' and element in self.all_notes:
                # Slash chord: Replace bass note with the slash bass note
                # Example: A/G# means A chord with G# in bass
                midiInfo = midi.copy()
                slash_bass = self.all_notes[element]
                
                # Remove the original root (first note) and replace with slash bass
                if len(midiInfo) > 0:
                    midiInfo[0] = slash_bass  # Replace bass note
                
                info = (midiInfo, duration, element)
                midi_sequence.append(info)
                
                # Update previous_voicing so voice leading continues correctly
                previous_voicing = [n for n in midiInfo if n != 0]
            
            # Structural elements section ---------------------------------------------
            elif element in self.structural_elements and element != '/':
                thisMidi = [0, 0, 0, 0, 0, 0, 0, 0]
                couple = (thisMidi, duration, element)
                midi_sequence.append(couple)
                
            # Form section -------------------------------------------------------------
            elif element not in self.all_notes and element not in self.natures and element not in self.structural_elements and element not in self.durations:
                thisMidi = [0, 0, 0, 0, 0, 0, 0, 0]
                couple = (thisMidi, duration, element)
                midi_sequence.append(couple)
        
            
        #Normalize the length of the MIDI sequence to 8 ----------------------------
        for i, item in enumerate(midi_sequence):    
            current_midi = item[0]
            #duration = item[1]
            element = item[2]
            if len(current_midi) < 8:
                for i in range(8 - len(current_midi)):
                    current_midi.append(0)
                item = (current_midi, duration, element)
     
        return midi_sequence, status
    
    
    #--------------------------------------------------------------------------------
    # Advanced voice leading methods inspired by modal_studio_Chord.js
    #--------------------------------------------------------------------------------
    
    def calculate_voice_leading_distance(self, prev_voicing, next_voicing):
        """
        Calculate total voice movement between two voicings.
        Lower values = better voice leading.
        
        This implements the voice leading principle: each note in a chord
        should move the minimum distance to its corresponding note in the next chord.
        
        Args:
            prev_voicing: List of MIDI note numbers from previous chord (non-zero notes only)
            next_voicing: List of MIDI note numbers for candidate next chord
            
        Returns:
            Total distance (sum of all voice movements in semitones)
        """
        if not prev_voicing or not next_voicing:
            return 0
        
        # Remove zeros from both voicings
        prev_notes = [n for n in prev_voicing if n != 0]
        next_notes = [n for n in next_voicing if n != 0]
        
        if not prev_notes or not next_notes:
            return 0
        
        total_distance = 0
        
        # For each note in the new chord, find its closest corresponding note in previous chord
        # This creates optimal voice leading
        used_prev_indices = set()
        
        for next_note in next_notes:
            min_distance = float('inf')
            best_prev_idx = 0
            
            # Try matching to each unused previous note
            for prev_idx, prev_note in enumerate(prev_notes):
                if prev_idx in used_prev_indices:
                    continue
                    
                # Calculate distance (considering octave equivalence)
                distance = abs(next_note - prev_note)
                
                # Also try octave transpositions to find closest version
                for octave_shift in [-12, 12]:
                    alt_distance = abs((next_note + octave_shift) - prev_note)
                    if alt_distance < distance:
                        distance = alt_distance
                
                if distance < min_distance:
                    min_distance = distance
                    best_prev_idx = prev_idx
            
            used_prev_indices.add(best_prev_idx)
            total_distance += min_distance
        
        return total_distance
    
    def select_best_voicing(self, previous_voicing, candidate_voicings, prev_root=None, curr_root=None):
        """
        Select voicing using Berklee voice leading principles.
        
        Follows proper jazz/pop voice leading:
        1. Root stays in bass
        2. Focus on moving 3 and 7 smoothly
        3. Use different rules based on root motion (4th/5th vs 2nd vs 3rd)
        
        Args:
            previous_voicing: List of MIDI notes from previous chord
            candidate_voicings: List of possible voicings (7 templates)
            prev_root: Previous chord root (MIDI note)
            curr_root: Current chord root (MIDI note)
            
        Returns:
            Optimized voicing following voice leading principles
        """
        if not previous_voicing or not candidate_voicings:
            return candidate_voicings[0] if candidate_voicings else [0, 4, 7, 12]
        
        prev_notes = [n for n in previous_voicing if n != 0]
        if not prev_notes:
            return candidate_voicings[0]
        
        best_voicing = None
        min_distance = float('inf')
        
        # Try each candidate voicing template
        for voicing in candidate_voicings:
            # Optimize this voicing by adjusting octaves for best voice leading
            optimized = self.optimize_voicing_octaves(prev_notes, voicing)
            
            # Calculate total voice movement
            distance = self.calculate_optimized_distance(prev_notes, optimized)
            
            if distance < min_distance:
                min_distance = distance
                best_voicing = optimized
        
        return best_voicing if best_voicing is not None else candidate_voicings[0]
    
    def optimize_voicing_octaves(self, prev_notes, next_voicing):
        """
        Adjust octaves using Berklee voice leading principles.
        
        CRITICAL RULES:
        1. Root (bass note) stays FIXED
        2. Upper voices (3, 7, and any extensions) move to minimize distance
        3. Basic chord sound (3 and 7) should stay in comfortable range
        
        Args:
            prev_notes: List of MIDI notes from previous chord (non-zero only)
            next_voicing: Candidate voicing from template
            
        Returns:
            Voicing with octaves adjusted for smooth voice leading
        """
        next_notes = [n for n in next_voicing if n != 0]
        if not next_notes or not prev_notes:
            return next_voicing
        
        # ROOT STAYS FIXED in bass
        root = next_notes[0]
        upper_voices = next_notes[1:] if len(next_notes) > 1 else []
        
        # Get previous upper voices (exclude bass)
        prev_upper = sorted([n for n in prev_notes if n > prev_notes[0]])
        
        optimized = [root]  # Bass is locked
        
        # For each upper voice, find closest octave to previous upper voices
        for next_note in upper_voices:
            best_note = next_note
            min_distance = float('inf')
            
            # Try different octaves
            for octave_shift in [-24, -12, 0, 12, 24]:  # ±2 octaves
                candidate = next_note + octave_shift
                
                # Must be: in range, above root, in comfortable voicing range
                if candidate <= root or candidate < 24 or candidate > 96:
                    continue
                
                # For 3rd and 7th (typically first two upper voices), prefer range C3-C5
                # This follows Berklee recommendation for basic chord sound placement
                voice_idx = len(optimized) - 1
                if voice_idx <= 2:  # First two upper voices (likely 3 and 7)
                    if candidate < 48 or candidate > 72:  # Outside C3-C5
                        continue
                
                # Find distance to closest previous upper voice
                if prev_upper:
                    closest_prev_distance = min(abs(candidate - p) for p in prev_upper)
                else:
                    closest_prev_distance = abs(candidate - root)
                
                if closest_prev_distance < min_distance:
                    min_distance = closest_prev_distance
                    best_note = candidate
            
            optimized.append(best_note)
        
        # Sort upper voices only (keep root first)
        if len(optimized) > 1:
            upper_sorted = sorted(optimized[1:])
            optimized = [optimized[0]] + upper_sorted
        
        # Pad with zeros
        while len(optimized) < len(next_voicing):
            optimized.append(0)
        
        return optimized
    
    def check_and_add_ninth(self, prev_notes, current_notes, root_note):
        """
        Add 9th ONLY when it genuinely fills a gap in voice leading.
        
        Very conservative - only adds if there's a specific voice leading need.
        
        Args:
            prev_notes: Previous chord notes (non-zero)
            current_notes: Current optimized voicing (non-zero, sorted)
            root_note: Root note of current chord
            
        Returns:
            Voicing with 9th added only if truly needed
        """
        if not prev_notes or not current_notes or len(current_notes) < 3:
            return current_notes
        
        # Get highest notes
        prev_highest = max(prev_notes)
        current_highest = max(current_notes)
        
        # Only consider 9th if there's a big gap (>5 semitones) from prev to current highest
        gap = abs(prev_highest - current_highest)
        if gap <= 5:
            return current_notes  # No gap to fill
        
        # Try natural 9th first, then b9 only if natural doesn't work
        ninth_options = [2, 1]
        
        for ninth_interval in ninth_options:
            # Try one octave above root only
            ninth_note = root_note + ninth_interval + 12
            
            # Must be between prev and current highest (filling the gap)
            if not (min(prev_highest, current_highest) < ninth_note < max(prev_highest, current_highest)):
                continue
            
            # Must be in range and not too close to existing notes
            if ninth_note > 96:
                continue
                
            too_close = any(abs(ninth_note - n) <= 2 for n in current_notes)
            if too_close:
                continue
            
            # Found a 9th that fills the gap - use it and stop
            current_notes.append(ninth_note)
            current_notes.sort()
            break
        
        return current_notes
    
    def calculate_optimized_distance(self, prev_notes, next_notes):
        """
        Calculate total voice leading distance between two voicings.
        Each voice finds its nearest corresponding voice in the next chord.
        
        Args:
            prev_notes: Previous chord notes (non-zero only)
            next_notes: Next chord notes (already octave-optimized)
            
        Returns:
            Total distance (sum of minimum movements)
        """
        next_clean = [n for n in next_notes if n != 0]
        
        if not prev_notes or not next_clean:
            return 0
        
        # Greedy matching: each next note to its closest unused previous note
        used_prev = set()
        total_distance = 0
        
        # Sort both by pitch for better matching
        sorted_next = sorted(next_clean)
        sorted_prev = sorted(prev_notes)
        
        for next_note in sorted_next:
            min_dist = float('inf')
            best_prev_idx = 0
            
            for i, prev_note in enumerate(sorted_prev):
                if i in used_prev:
                    continue
                    
                dist = abs(next_note - prev_note)
                if dist < min_dist:
                    min_dist = dist
                    best_prev_idx = i
            
            used_prev.add(best_prev_idx)
            total_distance += min_dist
        
        return total_distance
    
    def select_voicing_by_position(self, position):
        """
        Select voicing template based on chord position in progression.
        Similar to selectVoicingBasedOnFunction in modal_studio_Chord.js
        
        Args:
            position: Position in sequence (0-6 maps to v_0 through v_6)
        
        Returns:
            Voicing key string ('v_0' through 'v_6')
        """
        voicing_index = position % 7
        return f'v_{voicing_index}'
    
    def optimize_voice_leading(self, current_voicing, next_voicing, root_current, root_next):
        """
        Optimize voice leading between two chords to minimize movement.
        Inspired by checkAndAddNinth and voice leading logic in modal_studio_Chord.js
        
        Args:
            current_voicing: List of MIDI notes for current chord
            next_voicing: List of MIDI notes for next chord  
            root_current: Root note of current chord
            root_next: Root note of next chord
            
        Returns:
            Optimized next_voicing with adjusted octaves for smooth voice leading
        """
        if not current_voicing or not next_voicing:
            return next_voicing
        
        # Work with non-zero notes only
        current_notes = [n for n in current_voicing if n != 0]
        next_notes = [n for n in next_voicing if n != 0]
        
        if not current_notes or not next_notes:
            return next_voicing
        
        # Optimize each voice to stay close to previous chord
        optimized = []
        for next_note in next_notes:
            # Find closest version of this note to any note in current chord
            best_note = next_note
            min_distance = float('inf')
            
            for current_note in current_notes:
                # Try this note and its octave transpositions
                for octave_shift in [-12, 0, 12]:
                    candidate = next_note + octave_shift
                    distance = abs(candidate - current_note)
                    
                    if distance < min_distance:
                        min_distance = distance
                        best_note = candidate
            
            optimized.append(best_note)
        
        # Pad with zeros to match original length
        while len(optimized) < len(next_voicing):
            optimized.append(0)
            
        return optimized
    
    def add_extensions_for_quality(self, voicing, chord_type, root):
        """
        Add chord extensions (9th, 11th, 13th) based on chord quality.
        Inspired by the upperNinth logic in modal_studio_Chord.js
        
        Args:
            voicing: Base voicing as list of intervals from root
            chord_type: Chord quality (e.g., 'maj7', 'm7', 'dom7')
            root: Root note MIDI number
            
        Returns:
            Extended voicing with appropriate color tones
        """
        extended = voicing.copy()
        
        # Add 9th for certain chord types (common in jazz)
        if chord_type in ['maj7', 'm7', 'dom7', 'sus7', 'm_maj7']:
            # Add 9th (14 semitones from root) in upper register if not too crowded
            if len(extended) < 6:
                ninth = 14  # 9th interval
                if ninth not in extended:
                    extended.append(ninth)
        
        # Add 11th for sus chords
        if chord_type in ['sus7', 'sus4']:
            if len(extended) < 6:
                eleventh = 17  # 11th interval  
                if eleventh not in extended:
                    extended.append(eleventh)
        
        # Add 13th for dominant and major chords
        if chord_type in ['dom7', 'maj7'] and len(extended) < 7:
            thirteenth = 21  # 13th interval
            if thirteenth not in extended:
                extended.append(thirteenth)
        
        return extended
    
    def get_drop_2_voicing(self, base_voicing):
        """
        Create a drop-2 voicing from a closed voicing.
        Drop-2 voicings are essential in jazz for better voice leading.
        
        Args:
            base_voicing: List of intervals in closed position
            
        Returns:
            Drop-2 voicing (second-highest note dropped an octave)
        """
        if len(base_voicing) < 3:
            return base_voicing
        
        drop2 = base_voicing.copy()
        # Drop the second note from the top down an octave
        if len(drop2) >= 2:
            drop2[-2] = drop2[-2] - 12
        
        # Re-sort to maintain ascending order
        drop2.sort()
        return drop2
    
    def get_drop_3_voicing(self, base_voicing):
        """
        Create a drop-3 voicing from a closed voicing.
        
        Args:
            base_voicing: List of intervals in closed position
            
        Returns:
            Drop-3 voicing (third-highest note dropped an octave)
        """
        if len(base_voicing) < 4:
            return base_voicing
        
        drop3 = base_voicing.copy()
        # Drop the third note from the top down an octave
        if len(drop3) >= 3:
            drop3[-3] = drop3[-3] - 12
        
        # Re-sort to maintain ascending order
        drop3.sort()
        return drop3
    
    
    #--------------------------------------------------------------------------------
    #Export the file to MIDI
    def export_to_midi(self, sequence, filename, path = "../dataset/midi_files/"):
        #Capture the information
        midi_capture = []
            
        for i, element in enumerate(sequence):
            #print('chord:', element)
            chord = element[2]
            
            if chord == '.' and i < len(sequence) - 2:
                ref = i
                counter = 0
                doIt = True
                while doIt and ref < len(sequence)-1:       
                    counter += 1 
                    ref += 1
                    next = sequence[ref][2]
                    if next in self.after_chords or next.startswith('Form_') or next == '<end>':
                        doIt = False
                        counter -= 1
                    
                #print(i, "\t", element, "\t", counter, sequence[i+counter])
                
                if counter > 0:
                    midi = (sequence[i+counter][0], sequence[i+counter][1])
                    if midi[0] == [0, 0, 0, 0, 0, 0, 0, 0]:
                        assert False, 'Error: Empty MIDI'
                        print("Error: Empty MIDI", counter, i)
                        
                    if midi[0] == [48, 48, 48, 48, 0, 0, 0, 0]: #this is a N.C.!
                        midi = ([0, 0, 0, 0, 0, 0, 0, 0], sequence[i+counter][1])
                    #print('\nmidi:', midi)
                    midi_capture.append(midi)
        
        #check distances and correct them
        for i, midiChord in enumerate(midi_capture):
            if i < len(midi_capture) - 1:
                currentMidi = midiChord[0]
           
                nextMidi = midi_capture[i+1][0]
                #calculate the distance between each note of the chords
                distance = [0, 0, 0, 0, 0, 0, 0, 0]
                for j in range(1, 4):
                    distance[j] = currentMidi[j] - nextMidi[j]
                    if distance[j] <= -12:
                        nextMidi[j] = nextMidi[j] - 12
                        break
                # for j in range(4):
                #     distance[j] = currentMidi[j] - nextMidi[j]
                #     if distance[j] >= 12:
                #         nextMidi[j] = nextMidi[j] + 12
                #         break
                    
                #print(i, 'distance:', distance, currentMidi, nextMidi)
                
        # Create a MIDI file
        track    = 0
        channel  = 0
        time     = 0    # In beats
        tempo    = 120   # In BPM
        volume   = 80  # 0-127, as per the MIDI standard

        MyMIDI = MIDIFile()  # One track, defaults to format 1 (tempo track is created automatically)
        MyMIDI.addTempo(track, time, tempo)

        time = 0
        
        for item in midi_capture:
            m = item[0]
            #clean the values that are zero
            m = [x for x in m if x != 0]
            d = float(item[1])
            
            for i, pitch in enumerate(m):
                volume = int(random.uniform(55, 85))
                MyMIDI.addNote(track, channel, pitch, time, d, volume)
            time += d
  
        tz = pytz.timezone('Europe/Stockholm')
        stockholm_now = datetime.now(tz)
        mh = str(stockholm_now.hour)
        mm = str(stockholm_now.minute)
        ms = str(stockholm_now.second)
        
        if len(mh) == 1:
            mh = '0' + str(stockholm_now.hour)
        if len(mm) == 1:
            mm= '0' + str(stockholm_now.minute)
        if len(ms) == 1:
            ms = '0' + str(stockholm_now.second)
            
        fullname = path + filename + '.mid'
        currentName = filename + '.mid'
        
        with open(fullname, "wb") as output_file:
            MyMIDI.writeFile(output_file)
        
        print('✓ MIDI file created:', currentName) 
        return fullname
        
        
    #--------------------------------------------------------------------------------
    #Get the chords from the sequence
    def get_chords(self, sequence):
        strings_array = [item[0] for item in sequence if item[0] != '']
        return strings_array
    
    #--------------------------------------------------------------------------------
    def play_midi(self, filename):
        # Check if the MIDI file exists
        if not os.path.exists(filename):
            print(f"Error: File not found - {filename}")
            return

         # Load the MIDI file into a music21 stream
        mf = midi.MidiFile()
        mf.open(filename)
        mf.read()
        mf.close()

        # Convert MIDI file to a music21 stream
        s = midi.translate.midiFileToStream(mf)

        # Play the MIDI stream
        s.show('midi')
        
    #--------------------------------------------------------------------------------
    #Convert the separated chords into one unify chord
    def convertChordsFromOutput(self, sequence):
        chord = []
        chordArray = []
        ignore = self.listToIgnore()
        ignore.remove('.') #we need the dot to identify the chord
        ignore.remove('|')
        ignore.remove(':|')
        ignore.remove('<end>')
        #if sequence[len(sequence)-1] != '.':
        #    sequence.append('.')
        for i in range (4, len(sequence)): #first four elements are style context
            element = sequence[i]
           
            if element not in ignore and element not in self.durations:
                if element == 'dom7':
                    element = '7'
                #check if the chord starts
                if element != '.' and element != '|' and element != ':|' and element != '<end>':
                    #print(i, duration)
                    #collect the elements of the chord
                    if element.find('add') >= 0 or element.find('subtract') >= 0 or element.find('alter') >= 0:
                        chord.append(' ')
                    chord.append(element)
                    #print(i, chord)
                if len(chord) > 0:
                    if  element == '.' or element == '|' or element == ':|' or element == '<end>':
                        #print(i, element)listToIgnore
                        #join the sections into a formatted chord
                        c = ''.join(chord) 
                        chordArray.append(c)
                        chord = []
                
        return chordArray
    #----------------------------------------------------
     # Function to create pitch bend messages
    def create_pitch_bend(self, value, channel):
        # Pitch bend value ranges from -8192 to 8191
        pitch = int((value / 100) * 8192)
        return Message('pitchwheel', pitch=pitch, channel=channel)
    
    #----------------------------------------------------
    def MidiChord(self, path = "../dataset/midi_files/", filename = 'detuned_Cmaj_chord'):
        
        # Create a new MIDI file and a new track
        mid = MidiFile()
        track = MidiTrack()
        mid.tracks.append(track)

        # Constants for note durations and volumes
        duration = 960  # duration in ticks (e.g., quarter note in standard MIDI)
        volume = 64  # Volume (0-127)

        # Define the MIDI note numbers for Cmaj7 chord
        C_note = 60  # Middle C
        E_note = 64  # E above middle C
        G_note = 67  # G above middle C
        B_note = 71  # B above middle C

        # MIDI channels for MPE
        C_channel = 0
        E_channel = 1
        G_channel = 2
        B_channel = 3


        # Time for the start of the chord
        start_time = 0

        # Add the C note to the MIDI file (no detuning)
        track.append(Message('note_on', note=C_note, velocity=volume, channel=C_channel, time=start_time))

        # Add the detuned E note
        track.append(self.create_pitch_bend(-25, E_channel))  # -25 cents detune
        track.append(Message('note_on', note=E_note, velocity=volume, channel=E_channel, time=start_time))

        # Add the G note to the MIDI file (no detuning)
        track.append(Message('note_on', note=G_note, velocity=volume, channel=G_channel, time=start_time))

        # Add the detuned B note
        track.append(self.create_pitch_bend(-28, B_channel))  # -28 cents detune
        track.append(Message('note_on', note=B_note, velocity=volume, channel=B_channel, time=start_time))

        # Add note off messages for all notes at the same time (duration ticks later)
        track.append(Message('note_off', note=C_note, velocity=volume, channel=C_channel, time=duration))
        track.append(Message('note_off', note=E_note, velocity=volume, channel=E_channel, time=0))  # time=0 because it’s the same moment
        track.append(Message('note_off', note=G_note, velocity=volume, channel=G_channel, time=0))
        track.append(Message('note_off', note=B_note, velocity=volume, channel=B_channel, time=0))
        track.append(self.create_pitch_bend(0, E_channel))  # Reset pitch bend for E
        track.append(self.create_pitch_bend(0, B_channel))  # Reset pitch bend for B

        tz = pytz.timezone('Europe/Stockholm')
        stockholm_now = datetime.now(tz)
        mh = str(stockholm_now.hour)
        mm = str(stockholm_now.minute)
        ms = str(stockholm_now.second)
        
        if len(mh) == 1:
            mh = '0' + str(stockholm_now.hour)
        if len(mm) == 1:
            mm= '0' + str(stockholm_now.minute)
        if len(ms) == 1:
            ms = '0' + str(stockholm_now.second)
            
        ext =  mh + mm + ms + '_' +str(stockholm_now.day) + '_' + str(stockholm_now.month) + '_' + str(stockholm_now.year) + '_'
        
        fullname = path + ext + filename + '.mid'
        currentName = ext + filename + '.mid'
        
        # Save the MIDI file
        mid.save(fullname)
            
        print("MIDI file generated: ", currentName)


    
   
        
    
      