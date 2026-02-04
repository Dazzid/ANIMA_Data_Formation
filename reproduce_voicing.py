
import sys
import os

# Add the src directory to the path so we can import modules
sys.path.append(os.path.abspath('src'))

from voicing import Voicing
from music21 import midi, stream, note, chord, environment

def test_voicing():
    v = Voicing()
    
    # Create a simple progression: D min7 -> G dom7 -> C maj7 -> C maj7/B
    # Using the token format expected by convert_chords_to_voicing
    # . duration root nature
    sequence = [
        '.', '1.0', 'D', 'm7', 'add 9',
        '.', '1.0', 'G', 'dom7',
        '.', '1.0', 'C', 'maj7',
        '.', '1.0', 'C', 'maj7', '/', 'A'
    ]
    
    print("Converting sequence...")
    try:
        # Using convert_chords_to_voicing as it handles voice leading properly
        midi_seq, status = v.convert_chords_to_voicing(sequence)
        
        print(f"Generated {len(midi_seq)} chords.")
        for i, item in enumerate(midi_seq):
            # item is (midi_notes, duration, label)
            notes_list = item[0]
            duration = item[1]
            label = item[2]
            
            # Filter non-zero notes
            notes = [n for n in notes_list if n > 0]
            note_names = []
            for n in notes:
                # Convert midi number to note name for better readability
                m_note = note.Note()
                m_note.pitch.midi = n
                note_names.append(f"{m_note.nameWithOctave}({n})")
                
            print(f"Chord {i} ({label}, dur={duration}): {note_names}")
            
        # Export to MIDI for listening
        print("Exporting to MIDI...")
        v.export_to_midi(midi_seq, "voicing_test", path="dataset/midi_files/")
        print("MIDI exported to dataset/midi_files/voicing_test.mid")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_voicing()
