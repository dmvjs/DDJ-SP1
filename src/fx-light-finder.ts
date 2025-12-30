/**
 * FX Light Finder - Interactive Mode
 *
 * Tests specific notes to identify the red lights
 */

import { DeviceManager } from './DeviceManager.js';
import * as readline from 'readline';

const device = new DeviceManager();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔍 FX Light Finder - Interactive Mode');
console.log('=====================================\n');

try {
  device.connect();
  console.log('✅ Connected to DDJ-SP1\n');

  // First, turn off all potential lights
  const channel = 6;
  console.log('Turning off all lights in range 70-90...\n');
  for (let note = 70; note <= 90; note++) {
    device.setLED(channel, note, 0);
  }

  console.log('Now let\'s find each light!\n');
  console.log('Target: RED light under LEFT 1 (FX1→Deck1)\n');

  const lightsFound: { [key: string]: number } = {};

  async function testNote(note: number, description: string): Promise<void> {
    return new Promise((resolve) => {
      console.log(`\nTesting note ${note}...`);
      device.setLED(channel, note, 127);

      rl.question(`Did the ${description} light up? (y/n): `, (answer) => {
        if (answer.toLowerCase() === 'y') {
          console.log(`✅ Found it! Note ${note} = ${description}`);
          lightsFound[description] = note;
          device.setLED(channel, note, 0);
          resolve();
        } else {
          device.setLED(channel, note, 0);
          resolve();
        }
      });
    });
  }

  async function scanForLight(description: string, startNote: number = 70, endNote: number = 90): Promise<number> {
    for (let note = startNote; note <= endNote; note++) {
      await testNote(note, description);
      if (lightsFound[description]) {
        return lightsFound[description];
      }
    }
    return -1;
  }

  (async () => {
    const left1 = await scanForLight('RED light under LEFT 1 (FX1→Deck1)');
    if (left1 === -1) {
      console.log('❌ Not found');
      rl.close();
      device.disconnect();
      process.exit(1);
    }

    console.log('\n\nNow finding: RED light under LEFT 2 (FX2→Deck1)');
    const left2 = await scanForLight('RED light under LEFT 2 (FX2→Deck1)');

    console.log('\n\nNow finding: RED light under RIGHT 1 (FX1→Deck2)');
    const right1 = await scanForLight('RED light under RIGHT 1 (FX1→Deck2)');

    console.log('\n\nNow finding: RED light under RIGHT 2 (FX2→Deck2)');
    const right2 = await scanForLight('RED light under RIGHT 2 (FX2→Deck2)');

    console.log('\n\n✅ ALL LIGHTS FOUND!');
    console.log('===================');
    console.log(`Left 1 (FX1→Deck1):  note ${left1}`);
    console.log(`Left 2 (FX2→Deck1):  note ${left2}`);
    console.log(`Right 1 (FX1→Deck2): note ${right1}`);
    console.log(`Right 2 (FX2→Deck2): note ${right2}`);

    rl.close();
    device.disconnect();
    process.exit(0);
  })();

} catch (error) {
  console.error('❌ Error:', error);
  rl.close();
  process.exit(1);
}
