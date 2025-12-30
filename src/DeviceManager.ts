import easymidi from 'easymidi';
import { EventEmitter } from 'events';
import { ControllerEvent } from './types.js';
import { ControlStateManager } from './ControlStateManager.js';

export class DeviceManager extends EventEmitter {
  private input: easymidi.Input | null = null;
  private output: easymidi.Output | null = null;
  private deviceName: string | null = null;
  private stateManager: ControlStateManager;

  constructor() {
    super();
    this.stateManager = new ControlStateManager();
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
    this.output = new easymidi.Output(sp1Device);
    this.setupListeners();
  }

  /**
   * Disconnect from the device
   */
  disconnect(): void {
    if (this.input) {
      this.input.close();
      this.input = null;
    }
    if (this.output) {
      this.output.close();
      this.output = null;
    }
    this.deviceName = null;
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

  /**
   * Send LED control message to the device
   * @param channel - MIDI channel
   * @param note - Note number
   * @param velocity - Velocity (0 = off, 127 = on, other values for different colors/brightness)
   */
  setLED(channel: number, note: number, velocity: number): void {
    if (!this.output) {
      console.warn('Cannot set LED: output not connected');
      return;
    }

    (this.output as any).send('noteon', {
      note: note,
      velocity: velocity,
      channel: channel
    });
  }

  /**
   * Turn on a button LED
   */
  turnOnLED(channel: number, note: number): void {
    this.setLED(channel, note, 127);
  }

  /**
   * Turn off a button LED
   */
  turnOffLED(channel: number, note: number): void {
    this.setLED(channel, note, 0);
  }

  private setupListeners(): void {
    if (!this.input) return;

    // Handle button presses (Note On/Off)
    this.input.on('noteon', (msg: any) => {
      console.log('🔵 BUTTON:', `note=${msg.note}`, `channel=${msg.channel}`, `velocity=${msg.velocity}`);

      // Check if this is the SHIFT button (button-64-ch6)
      if (msg.channel === 6 && msg.note === 64) {
        this.stateManager.setShiftPressed(msg.velocity > 0);
        console.log('⬆️  SHIFT:', this.stateManager.isShiftPressed() ? 'PRESSED' : 'RELEASED');
      }

      // Check if this is a shifted FX button
      const isShiftedFX = this.stateManager.isShiftedFXNote(msg.note, msg.channel);

      // Map shifted note to original note
      const originalNote = isShiftedFX ? this.stateManager.getOriginalNote(msg.note) : msg.note;

      // Check if this is an FX button
      const isFXButton = this.stateManager.isFXButton(msg.channel, originalNote);

      // Handle shifted FX button press (toggle lock)
      if (isShiftedFX) {
        const lockChange = this.stateManager.handleShiftedFXPress(msg.channel, msg.note, msg.velocity);

        if (lockChange) {
          console.log('🔒 BUTTON LOCK:', `note=${lockChange.button}`, `channel=${lockChange.channel}`, `locked=${lockChange.locked}`);

          // Update LED based on lock state
          this.setLED(lockChange.channel, lockChange.button, lockChange.locked ? 127 : 0);

          // Emit lock state change event
          this.emit('lock', lockChange);
        }
      } else if (isFXButton) {
        // For FX buttons, use state manager to get proper LED velocity
        const ledVelocity = this.stateManager.getLEDVelocity(msg.channel, msg.note, msg.velocity);
        this.setLED(msg.channel, msg.note, ledVelocity);
      } else {
        // For other buttons, just echo normally
        this.setLED(msg.channel, msg.note, msg.velocity);
      }

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
      console.log('🔄 KNOB:', `controller=${msg.controller}`, `channel=${msg.channel}`, `value=${msg.value}`);
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
