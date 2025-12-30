/**
 * Quick FX Light Scanner
 * Tests notes 78-79 and 82-85 (gaps between/after FX ASSIGN button notes)
 */
import { DeviceManager } from './DeviceManager.js';
const device = new DeviceManager();
console.log('🔍 Quick FX Light Scanner');
console.log('=========================\n');
try {
    device.connect();
    console.log('✅ Connected\n');
    const channel = 6;
    // FX ASSIGN buttons are: 76, 77, 80, 81
    // Test notes in between and after
    const testNotes = [78, 79, 82, 83, 84, 85];
    console.log('Testing notes that might control RED lights UNDER the FX ASSIGN buttons:');
    console.log('Button layout:');
    console.log('  LEFT:  1 (top/76) → Deck1, 2 (bottom/80) → Deck1');
    console.log('  RIGHT: 1 (top/77) → Deck2, 2 (bottom/81) → Deck2\n');
    let i = 0;
    const interval = setInterval(() => {
        if (i >= testNotes.length) {
            console.log('\n✅ Scan complete!');
            console.log('\nTell me which notes lit up the RED lights:');
            console.log('  Note 78 = ?');
            console.log('  Note 79 = ?');
            console.log('  Note 82 = ?');
            console.log('  Note 83 = ?');
            console.log('  Note 84 = ?');
            console.log('  Note 85 = ?');
            device.disconnect();
            process.exit(0);
        }
        const note = testNotes[i];
        console.log(`Testing note ${note}...`);
        device.setLED(channel, note, 127);
        setTimeout(() => {
            device.setLED(channel, note, 0);
        }, 800);
        i++;
    }, 1000);
}
catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
}
