import easymidi from 'easymidi';
import { EventEmitter } from 'events';
import { ControllerEvent } from './types.js';

export class DeviceManager extends EventEmitter {
  private input: easymidi.Input | null = null;
  private deviceName: string | null = null;

  constructor() {
    super();
  }

  /**
   * Get list of available MIDI input devices
   */
  getAvailableDevices(): string[] {
    return easymidi.getInputs();
  }

  /**
   * Check if DDJ-SP1 is connected
   */
  isDeviceConnected(): boolean {
    const devices = this.getAvailableDevices();
    return devices.some(name => name.includes('DDJ-SP1'));
  }

  /**
   * Connect to the DDJ-SP1
   */
  connect(): void {
    const devices = this.getAvailableDevices();
    const sp1Device = devices.find(name => name.includes('DDJ-SP1'));

    if (!sp1Device) {
      throw new Error('Pioneer DDJ-SP1 not found. Make sure it is connected via USB.');
    }

    this.deviceName = sp1Device;
    this.input = new easymidi.Input(sp1Device);
    this.setupListeners();
  }

  /**
   * Disconnect from the device
   */
  disconnect(): void {
    if (this.input) {
      this.input.close();
      this.input = null;
      this.deviceName = null;
    }
  }

  /**
   * Get the connected device name
   */
  getDeviceName(): string | null {
    return this.deviceName;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.input !== null;
  }

  private setupListeners(): void {
    if (!this.input) return;

    // Handle button presses (Note On/Off)
    this.input.on('noteon', (msg: any) => {
      const event: ControllerEvent = {
        type: 'button',
        button: msg.note,
        pressed: msg.velocity > 0,
        channel: msg.channel
      };
      this.emit('event', event);
      this.emit('button', event);
    });

    // Handle knobs and dials (Control Change)
    this.input.on('cc', (msg: any) => {
      const event: ControllerEvent = {
        type: 'knob',
        knob: msg.controller,
        value: msg.value,
        channel: msg.channel
      };
      this.emit('event', event);
      this.emit('knob', event);
    });
  }
}
