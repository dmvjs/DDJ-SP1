import easymidi from 'easymidi';
import { EventEmitter } from 'events';
export class DeviceManager extends EventEmitter {
    constructor() {
        super();
        this.input = null;
        this.deviceName = null;
    }
    /**
     * Get list of available MIDI input devices
     */
    getAvailableDevices() {
        return easymidi.getInputs();
    }
    /**
     * Check if DDJ-SP1 is connected
     */
    isDeviceConnected() {
        const devices = this.getAvailableDevices();
        return devices.some(name => name.includes('DDJ-SP1'));
    }
    /**
     * Connect to the DDJ-SP1
     */
    connect() {
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
    disconnect() {
        if (this.input) {
            this.input.close();
            this.input = null;
            this.deviceName = null;
        }
    }
    /**
     * Get the connected device name
     */
    getDeviceName() {
        return this.deviceName;
    }
    /**
     * Check if currently connected
     */
    isConnected() {
        return this.input !== null;
    }
    setupListeners() {
        if (!this.input)
            return;
        // Handle button presses (Note On/Off)
        this.input.on('noteon', (msg) => {
            console.log('🔵 BUTTON:', `note=${msg.note}`, `channel=${msg.channel}`, `velocity=${msg.velocity}`);
            const event = {
                type: 'button',
                button: msg.note,
                pressed: msg.velocity > 0,
                channel: msg.channel
            };
            this.emit('event', event);
            this.emit('button', event);
        });
        // Handle knobs and dials (Control Change)
        this.input.on('cc', (msg) => {
            console.log('🔄 KNOB:', `controller=${msg.controller}`, `channel=${msg.channel}`, `value=${msg.value}`);
            const event = {
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
