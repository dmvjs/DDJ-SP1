import { DeviceManager } from './DeviceManager.js';

const manager = new DeviceManager();
manager.connect();

console.log('Testing FX ASSIGN button LEDs...');
console.log('Looking for 4 buttons with "1 1" and "2 2" labels\n');

// Test a wider range of notes across channels to find the LED lights
// The buttons are 76,77,80,81 but the LEDs might be different
const notes = [70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88];
const channels = [0, 1, 2, 3, 4, 5, 6];

async function test() {
  for (const channel of channels) {
    console.log(`\nTrying channel ${channel}:`);
    for (const note of notes) {
      console.log(`  LED ON: ch${channel} note${note}`);
      manager.setLED(channel, note, 127);
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log(`  LED OFF: ch${channel} note${note}`);
      manager.setLED(channel, note, 0);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  console.log('\nTest complete!');
  manager.disconnect();
  process.exit(0);
}

test();
