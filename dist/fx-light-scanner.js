/**
 * FX Light Scanner
 *
 * Scans MIDI notes on channel 6 to find which notes control
 * the amber lights below the FX ASSIGN buttons (1, 2 on each side)
 */
import { DeviceManager } from './DeviceManager.js';
const device = new DeviceManager();
console.log('🔍 FX Light Scanner - Finding amber light note numbers');
console.log('================================================\n');
try {
    device.connect();
    console.log('✅ Connected to DDJ-SP1\n');
    // Scan range of notes on channel 6
    // FX ASSIGN buttons are 76, 77, 80, 81
    // Lights might be nearby or in a different range
    const channel = 6;
    const startNote = 70;
    const endNote = 90;
    console.log(`Scanning notes ${startNote}-${endNote} on channel ${channel}`);
    console.log('Watch for amber lights below FX ASSIGN buttons (1, 2)!\n');
    let noteIndex = startNote;
    const scanInterval = setInterval(() => {
        if (noteIndex > endNote) {
            console.log('\n✅ Scan complete!');
            console.log('Note which numbers lit up the amber lights below the buttons.');
            device.disconnect();
            process.exit(0);
        }
        // Turn on current note
        console.log(`Testing note ${noteIndex}...`);
        device.setLED(channel, noteIndex, 127);
        // Turn off after 300ms
        setTimeout(() => {
            device.setLED(channel, noteIndex, 0);
        }, 300);
        noteIndex++;
    }, 500);
}
catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
}
