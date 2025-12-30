import { describe, it, expect, beforeEach } from 'vitest';
import { ControlStateManager } from './ControlStateManager.js';

describe('ControlStateManager', () => {
  let manager: ControlStateManager;

  beforeEach(() => {
    manager = new ControlStateManager();
  });

  describe('Shift Button Management', () => {
    it('should initialize with shift not pressed', () => {
      expect(manager.isShiftPressed()).toBe(false);
    });

    it('should update shift pressed state', () => {
      manager.setShiftPressed(true);
      expect(manager.isShiftPressed()).toBe(true);

      manager.setShiftPressed(false);
      expect(manager.isShiftPressed()).toBe(false);
    });
  });

  describe('Shifted FX Note Detection', () => {
    it('should detect shifted FX notes on channels 4 and 5', () => {
      expect(manager.isShiftedFXNote(99, 4)).toBe(true);
      expect(manager.isShiftedFXNote(100, 5)).toBe(true);
      expect(manager.isShiftedFXNote(101, 4)).toBe(true);
      expect(manager.isShiftedFXNote(102, 5)).toBe(true);
    });

    it('should not detect shifted FX notes on other channels', () => {
      expect(manager.isShiftedFXNote(99, 0)).toBe(false);
      expect(manager.isShiftedFXNote(100, 6)).toBe(false);
    });

    it('should not detect non-shifted notes as shifted', () => {
      expect(manager.isShiftedFXNote(71, 4)).toBe(false);
      expect(manager.isShiftedFXNote(50, 5)).toBe(false);
    });
  });

  describe('Note Mapping', () => {
    it('should map shifted notes to original notes', () => {
      expect(manager.getOriginalNote(99)).toBe(71);
      expect(manager.getOriginalNote(100)).toBe(72);
      expect(manager.getOriginalNote(101)).toBe(73);
      expect(manager.getOriginalNote(102)).toBe(67);
    });

    it('should return same note if not shifted', () => {
      expect(manager.getOriginalNote(71)).toBe(71);
      expect(manager.getOriginalNote(50)).toBe(50);
    });
  });

  describe('FX Button Detection', () => {
    it('should detect FX buttons on channels 4 and 5', () => {
      expect(manager.isFXButton(4, 71)).toBe(true);
      expect(manager.isFXButton(4, 72)).toBe(true);
      expect(manager.isFXButton(4, 73)).toBe(true);
      expect(manager.isFXButton(4, 74)).toBe(true);
      expect(manager.isFXButton(4, 67)).toBe(true);

      expect(manager.isFXButton(5, 71)).toBe(true);
      expect(manager.isFXButton(5, 72)).toBe(true);
    });

    it('should not detect FX buttons on other channels', () => {
      expect(manager.isFXButton(0, 71)).toBe(false);
      expect(manager.isFXButton(6, 72)).toBe(false);
    });

    it('should not detect non-FX notes as FX buttons', () => {
      expect(manager.isFXButton(4, 50)).toBe(false);
      expect(manager.isFXButton(5, 100)).toBe(false);
    });
  });

  describe('Button Lock Management', () => {
    it('should initialize buttons as unlocked', () => {
      expect(manager.isButtonLocked(4, 71)).toBe(false);
      expect(manager.isButtonLocked(5, 72)).toBe(false);
    });

    it('should toggle button lock state', () => {
      const nowLocked = manager.toggleButtonLock(4, 71);
      expect(nowLocked).toBe(true);
      expect(manager.isButtonLocked(4, 71)).toBe(true);

      const nowUnlocked = manager.toggleButtonLock(4, 71);
      expect(nowUnlocked).toBe(false);
      expect(manager.isButtonLocked(4, 71)).toBe(false);
    });

    it('should handle lock state for multiple buttons independently', () => {
      manager.toggleButtonLock(4, 71);
      manager.toggleButtonLock(5, 72);

      expect(manager.isButtonLocked(4, 71)).toBe(true);
      expect(manager.isButtonLocked(5, 72)).toBe(true);
      expect(manager.isButtonLocked(4, 72)).toBe(false);
    });

    it('should return all locked buttons', () => {
      manager.toggleButtonLock(4, 71);
      manager.toggleButtonLock(5, 72);
      manager.toggleButtonLock(4, 73);

      const locked = manager.getLockedButtons();
      expect(locked).toHaveLength(3);
      expect(locked).toContainEqual({ channel: 4, note: 71 });
      expect(locked).toContainEqual({ channel: 5, note: 72 });
      expect(locked).toContainEqual({ channel: 4, note: 73 });
    });

    it('should clear all locks', () => {
      manager.toggleButtonLock(4, 71);
      manager.toggleButtonLock(5, 72);

      manager.clearAllLocks();

      expect(manager.isButtonLocked(4, 71)).toBe(false);
      expect(manager.isButtonLocked(5, 72)).toBe(false);
      expect(manager.getLockedButtons()).toHaveLength(0);
    });
  });

  describe('LED Velocity Management', () => {
    it('should echo velocity for unlocked buttons', () => {
      expect(manager.getLEDVelocity(4, 71, 127)).toBe(127);
      expect(manager.getLEDVelocity(4, 71, 0)).toBe(0);
      expect(manager.getLEDVelocity(4, 71, 64)).toBe(64);
    });

    it('should return 127 for locked buttons regardless of velocity', () => {
      manager.toggleButtonLock(4, 71);

      expect(manager.getLEDVelocity(4, 71, 0)).toBe(127);
      expect(manager.getLEDVelocity(4, 71, 64)).toBe(127);
      expect(manager.getLEDVelocity(4, 71, 127)).toBe(127);
    });
  });

  describe('Shifted FX Button Press Handling', () => {
    it('should toggle lock on shifted FX button press', () => {
      const result = manager.handleShiftedFXPress(4, 99, 127);

      expect(result).not.toBeNull();
      expect(result?.button).toBe(71);
      expect(result?.channel).toBe(4);
      expect(result?.locked).toBe(true);
      expect(manager.isButtonLocked(4, 71)).toBe(true);
    });

    it('should not toggle lock on button release (velocity 0)', () => {
      const result = manager.handleShiftedFXPress(4, 99, 0);

      expect(result).toBeNull();
      expect(manager.isButtonLocked(4, 71)).toBe(false);
    });

    it('should toggle lock back off on second press', () => {
      manager.handleShiftedFXPress(4, 99, 127);
      const result = manager.handleShiftedFXPress(4, 99, 127);

      expect(result).not.toBeNull();
      expect(result?.locked).toBe(false);
      expect(manager.isButtonLocked(4, 71)).toBe(false);
    });
  });
});
