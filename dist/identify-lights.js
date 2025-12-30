/**
 * Identify Light Notes
 * Turn off each note to see which light it controls
 */
import { DeviceManager } from './DeviceManager.js';
const device = new DeviceManager();
console.log('🔍 Identifying Light Notes');
console.log('===========================\n');
try {
    device.connect();
    console.log('✅ Connected\n');
    console.log('Turning lights OFF one at a time...\n');
    const channel = 6;
    // Known button notes (keep these on)
    const buttonNotes = [76, 77, 80, 81];
    let note = 0;
    const interval = setInterval(() => {
        if (note > 127) {
            console.log('\n✅ Complete!');
            console.log('\nWhich notes turned off which lights?');
            device.disconnect();
            process.exit(0);
        }
        // Skip button notes
        if (!buttonNotes.includes(note)) {
            console.log(`Turning OFF note ${note}...`);
            device.setLED(channel, note, 0);
        }
        note++;
    }, 1500);
}
catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
}
