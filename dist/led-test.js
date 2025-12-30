import { DeviceManager } from './DeviceManager.js';
const manager = new DeviceManager();
console.log('=== LED Test Tool ===\n');
if (!manager.isDeviceConnected()) {
    console.error('DDJ-SP1 not found!');
    process.exit(1);
}
manager.connect();
console.log('Connected to:', manager.getDeviceName());
console.log('\nTesting all LED combinations...\n');
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function testAllLEDs() {
    // Test channels 0-8
    for (let channel = 0; channel <= 8; channel++) {
        console.log(`\n=== Testing Channel ${channel} ===`);
        // Test notes 0-127
        for (let note = 0; note < 128; note++) {
            // Turn on LED
            manager.setLED(channel, note, 127);
            await sleep(50); // 50ms on
            // Turn off LED
            manager.setLED(channel, note, 0);
            await sleep(10); // 10ms off
            if (note % 16 === 0) {
                process.stdout.write(`Note ${note}... `);
            }
        }
        console.log('done');
    }
    console.log('\n=== Test Complete ===');
    manager.disconnect();
    process.exit(0);
}
testAllLEDs();
