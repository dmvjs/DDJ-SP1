/**
 * Test FX ASSIGN notes on different channels
 */
import { DeviceManager } from './DeviceManager.js';
const device = new DeviceManager();
console.log('🔍 Testing FX ASSIGN notes on different channels');
console.log('=================================================\n');
try {
    device.connect();
    const notes = [76, 77, 80, 81];
    const channels = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    console.log('Testing notes 76, 77, 80, 81 on channels 0-8\n');
    let i = 0;
    const interval = setInterval(() => {
        if (i >= channels.length) {
            console.log('\n✅ Done! Did any light up the RED lights?');
            device.disconnect();
            process.exit(0);
        }
        const channel = channels[i];
        console.log(`\nChannel ${channel}:`);
        notes.forEach(note => {
            console.log(`  Setting ch${channel} note${note} ON`);
            device.setLED(channel, note, 127);
        });
        setTimeout(() => {
            notes.forEach(note => device.setLED(channel, note, 0));
        }, 2000);
        i++;
    }, 2500);
}
catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
}
