/**
 * FX Light Scanner - Slow Mode
 *
 * Scans MIDI notes on channel 6 one at a time with user control
 * to identify which notes control the amber lights
 */
import { DeviceManager } from './DeviceManager.js';
const device = new DeviceManager();
console.log('🔍 FX Light Scanner - SLOW MODE');
console.log('================================================\n');
try {
    device.connect();
    console.log('✅ Connected to DDJ-SP1\n');
    const channel = 6;
    const startNote = 70;
    const endNote = 90;
    console.log('This will test each note for 2 seconds.');
    console.log('Watch the amber lights below the FX ASSIGN buttons!\n');
    console.log('Button positions:');
    console.log('  Left side:  1 (top) = FX1→Deck1, 2 (bottom) = FX2→Deck1');
    console.log('  Right side: 1 (top) = FX1→Deck2, 2 (bottom) = FX2→Deck2\n');
    let noteIndex = startNote;
    const scanInterval = setInterval(() => {
        if (noteIndex > endNote) {
            console.log('\n✅ Scan complete!');
            console.log('\nPlease report which notes lit up which lights:');
            console.log('  - Light under left 1 (FX1→Deck1):');
            console.log('  - Light under left 2 (FX2→Deck1):');
            console.log('  - Light under right 1 (FX1→Deck2):');
            console.log('  - Light under right 2 (FX2→Deck2):');
            device.disconnect();
            process.exit(0);
        }
        // Turn on current note
        console.log(`\n>>> Testing note ${noteIndex} <<<`);
        device.setLED(channel, noteIndex, 127);
        // Turn off after 1.5 seconds
        setTimeout(() => {
            device.setLED(channel, noteIndex, 0);
        }, 1500);
        noteIndex++;
    }, 2000);
}
catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
}
