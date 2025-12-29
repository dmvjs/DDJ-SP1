import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DeviceManager } from './DeviceManager.js';

describe('DeviceManager', () => {
  let manager: DeviceManager;

  beforeEach(() => {
    manager = new DeviceManager();
  });

  afterEach(() => {
    if (manager.isConnected()) {
      manager.disconnect();
    }
  });

  describe('Device Detection', () => {
    it('should list available MIDI devices', () => {
      const devices = manager.getAvailableDevices();
      expect(Array.isArray(devices)).toBe(true);
    });

    it('should detect if DDJ-SP1 is connected', () => {
      const isConnected = manager.isDeviceConnected();
      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('Connection Management', () => {
    it('should start disconnected', () => {
      expect(manager.isConnected()).toBe(false);
      expect(manager.getDeviceName()).toBe(null);
    });

    it('should connect to DDJ-SP1 if available', () => {
      if (!manager.isDeviceConnected()) {
        expect(() => manager.connect()).toThrow('Pioneer DDJ-SP1 not found');
        return;
      }

      manager.connect();
      expect(manager.isConnected()).toBe(true);
      expect(manager.getDeviceName()).toContain('DDJ-SP1');
    });

    it('should disconnect cleanly', () => {
      if (!manager.isDeviceConnected()) {
        return; // Skip if device not connected
      }

      manager.connect();
      manager.disconnect();
      expect(manager.isConnected()).toBe(false);
      expect(manager.getDeviceName()).toBe(null);
    });

    it('should throw error when connecting without device', () => {
      if (manager.isDeviceConnected()) {
        return; // Skip if device is actually connected
      }

      expect(() => manager.connect()).toThrow('Pioneer DDJ-SP1 not found');
    });
  });

  describe('Event Handling', () => {
    it('should have event listener methods', () => {
      expect(typeof manager.on).toBe('function');
      expect(typeof manager.once).toBe('function');
      expect(typeof manager.emit).toBe('function');
    });

    it('should be able to register event listeners', () => {
      const buttonHandler = () => {};
      const knobHandler = () => {};

      manager.on('button', buttonHandler);
      manager.on('knob', knobHandler);

      expect(manager.listenerCount('button')).toBe(1);
      expect(manager.listenerCount('knob')).toBe(1);

      manager.removeListener('button', buttonHandler);
      manager.removeListener('knob', knobHandler);

      expect(manager.listenerCount('button')).toBe(0);
      expect(manager.listenerCount('knob')).toBe(0);
    });
  });
});
