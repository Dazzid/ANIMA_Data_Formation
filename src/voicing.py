#make a class of voicing
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
        
        #Voicing
        self.voicing = ['v_0', 'v_1', 'v_2', 'v_3']
        
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
        
        #define voicing for natures for piano
        self.maj = {'v_0':[0, 7, 12, 16], 'v_1':[0, 7, 16, 19], 'v_2':[0, 12, 16, 19], 'v_3':[0, 7, 12, 16]}
        self.m6 = {'v_0':[0, 7, 9, 16], 'v_1':[0, 9, 16, 19], 'v_2':[0, 9, 12, 16], 'v_3':[0, 9, 12, 16, 19]}
        self.maj7 = {'v_0':[0, 11, 14, 16, 19], 'v_1':[0, 11, 16, 19], 'v_2':[0, 11, 14, 16], 'v_3':[0, 11, 14, 16, 19]}
        self.maj6 = {'v_0':[0, 7, 9, 12, 16], 'v_1':[0, 7, 9, 16], 'v_2':[0, 7, 14, 16, 21], 'v_3':[0, 4, 7, 9, 12, 14]}
        self.power = {'v_0':[0, 7, 12, 19], 'v_1':[0, 7, 12, 19], 'v_2':[0, 7, 12, 24], 'v_3':[0, 7, 12, 24]}
        self.m = {'v_0':[0, 12, 15, 19], 'v_1':[0, 7, 12, 15], 'v_2':[0, 7, 12, 15, 19], 'v_3':[0, 7, 14, 15, 19]}
        self.m7 = {'v_0':[0, 10, 15, 19], 'v_1':[0, 7, 10, 15], 'v_2':[0, 10, 14, 15], 'v_3':[0, 10, 14, 15]}
        self.m_maj7 = {'v_0':[0, 11, 15, 19], 'v_1':[0, 7, 11, 12, 15], 'v_2':[0, 7, 11, 14, 15], 'v_3':[0, 11, 15, 19]}
        self.dom7 = {'v_0':[0, 10, 14, 16, 19], 'v_1':[0, 10, 16, 19], 'v_2':[0, 10, 14, 16], 'v_3':[0, 10, 14, 16, 19]}
        self.ø7 =  {'v_0':[0, 15, 18, 22], 'v_1':[0, 10, 15, 18], 'v_2':[0, 12, 15, 18, 22], 'v_3':[0, 6, 10, 15, 18]}
        self.o7 = {'v_0':[0, 6, 10, 14, 15], 'v_1':[0, 15, 18, 21, 24], 'v_2':[0, 15, 18, 21, 24], 'v_3':[0, 12, 15, 18, 21]}
        self.o = {'v_0':[0, 3, 6, 12], 'v_1':[0, 6, 12, 15], 'v_2':[0, 15, 18, 21], 'v_3':[0, 12, 15, 18, 21]}
        self.sus = {'v_0':[0, 12, 17, 19], 'v_1':[0, 17, 19, 24], 'v_2':[0, 10, 14, 17], 'v_3':[0, 7, 14, 17, 19]} 
        self.sus7 = {'v_0':[0, 10, 17, 19], 'v_1':[0, 10, 14, 17, 19], 'v_2':[0, 10, 14, 17], 'v_3':[0, 10, 14, 17, 19]}
        self.sus2 = {'v_0':[0, 10, 17, 19], 'v_1':[0, 10, 14, 17, 19], 'v_2':[0, 10, 14, 17], 'v_3':[0, 10, 14, 17, 19]}
        self.sus4 = {'v_0':[0, 5, 7, 12, 14], 'v_1':[0, 7, 14, 17], 'v_2':[0, 7, 12, 17, 19], 'v_3':[0, 14, 12, 17, 10]}
        self.aug = {'v_0':[0, 4, 8, 12, 16], 'v_1':[0, 8, 12, 16, 20], 'v_2':[0, 12, 16, 20, 24], 'v_3':[0, 8, 12, 16]}
        self.o_maj7 = {'v_0':[0, 11, 15, 18], 'v_1':[0, 6, 11, 15], 'v_2':[0, 6, 11, 15, 18], 'v_3':[0, 11, 12, 15, 18]}
        self.noChord = {'v_0':[0, 0, 0, 0], 'v_1':[0, 0, 0, 0], 'v_2':[0, 0, 0, 0], 'v_3':[0, 0, 0, 0]}
               
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
                midi_for_slash = [0, 0, 0, 0, 0, 0, 0, 27]
                midi_sequence.append(midi_for_slash)
                
            # New root after slash section -----------------------------------------  
            elif sequence[i-1][0] == '/' and element in self.all_notes:
                midiInfo = midi.copy()
                slash_root = self.all_notes[element]
                midiInfo[0] = midiInfo[0] + 12
                midiInfo.insert(0, slash_root)
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
                n = i % mod
                midi = [x + root for x in self.chord_voicing[element][self.voicing[n]]]
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
                midi_for_slash = [0, 0, 0, 0, 0, 0, 0, 27]
                info = (midi_for_slash, duration, element)
                midi_sequence.append(info)
                
            # New root after slash section -----------------------------------------  
            elif sequence[i-1][0] == '/' and element in self.all_notes:
                midiInfo = midi.copy()
                slash_root = self.all_notes[element]
                midiInfo[0] = midiInfo[0] + 12
                midiInfo.insert(0, slash_root)
                info = (midiInfo, duration, element)
                midi_sequence.append(info)
            
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
            
        ext =  mh + mm + ms + '_' +str(stockholm_now.day) + '_' + str(stockholm_now.month) + '_' + str(stockholm_now.year) + '_'
        
        fullname = path + ext + filename + '.mid'
        currentName = ext + filename + '.mid'
        
        with open(fullname, "wb") as output_file:
            MyMIDI.writeFile(output_file)
        
        #Save sequence as text file
        textFileName = ext + filename + '.txt'
        with open(path + textFileName, 'w') as file:
            for item in sequence:
                file.write("%s\n" % str(item))

        print('song:', currentName) 
        print('file:', textFileName)
        print("MIDI file created!", '\n---------------------------------')
        return currentName
        
        
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


    
   
        
    
      