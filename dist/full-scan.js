/**
 * Full MIDI Note Scanner
 * Scans ALL notes 0-127 on channel 6
 */
import { DeviceManager } from './DeviceManager.js';
const device = new DeviceManager();
console.log('🔍 FULL MIDI Scanner (0-127)');
console.log('=============================\n');
try {
    device.connect();
    console.log('✅ Connected\n');
    console.log('Watch for RED lights under FX ASSIGN buttons!\n');
    const channel = 6;
    let note = 0;
    const interval = setInterval(() => {
        if (note > 127) {
            console.log('\n✅ Complete!');
            device.disconnect();
            process.exit(0);
        }
        if (note % 10 === 0) {
            console.log(`Testing notes ${note}-${Math.min(note + 9, 127)}...`);
        }
        device.setLED(channel, note, 127);
        setTimeout(() => device.setLED(channel, note, 0), 200);
        note++;
    }, 250);
}
catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
}
