import { DeviceManager } from './DeviceManager.js';
console.log('=== DDJ-SP1 Controller Manager ===\n');
const manager = new DeviceManager();
// List available devices
const devices = manager.getAvailableDevices();
console.log('Available MIDI Devices:');
devices.forEach((device, index) => {
    console.log(`  ${index + 1}. ${device}`);
});
if (devices.length === 0) {
    console.log('  No MIDI devices found!');
    process.exit(1);
}
// Connect to DDJ-SP1
try {
    manager.connect();
    console.log(`\nConnected to: ${manager.getDeviceName()}`);
    console.log('Listening for controller events...\n');
}
catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
// Listen to button events
manager.on('button', (event) => {
    console.log(`Button ${event.button}: ${event.pressed ? 'PRESSED' : 'RELEASED'} (channel ${event.channel})`);
});
// Listen to knob events
manager.on('knob', (event) => {
    console.log(`Knob ${event.knob}: value ${event.value} (channel ${event.channel})`);
});
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nDisconnecting...');
    manager.disconnect();
    process.exit(0);
});
