/**
 * ControllerState
 *
 * Manages the state of all controls on the DDJ-SP1 controller.
 * Single source of truth for button states, knob values, and lock states.
 */
export class ControllerState {
  constructor() {
    this.controls = new Map();
    this.lockedButtons = new Set();
    this.knobClickButtons = {
      'button-67-ch4': 'knob-0-ch4',
      'button-67-ch5': 'knob-0-ch5',
      'button-13-ch0': 'knob-23-ch0',
      'button-13-ch1': 'knob-23-ch1',
      'button-65-ch6': 'knob-64-ch6'
    };
  }

  /**
   * Register a control element
   */
  registerControl(id, element) {
    this.controls.set(id, {
      id,
      element,
      type: this.getControlType(element),
      value: null
    });
  }

  /**
   * Register a knob-click button (button that shows ring on knob)
   */
  registerKnobClickButton(buttonId, targetKnobId) {
    this.controls.set(buttonId, {
      id: buttonId,
      type: 'knob-click',
      targetKnob: targetKnobId
    });
  }

  /**
   * Get control type from element
   */
  getControlType(element) {
    if (element.querySelector('.button')) return 'button';
    if (element.querySelector('.slider-container')) return 'slider';
    if (element.querySelector('.knob-container')) return 'knob';
    return 'unknown';
  }

  /**
   * Check if a control exists
   */
  hasControl(id) {
    return this.controls.has(id);
  }

  /**
   * Get a control by ID
   */
  getControl(id) {
    return this.controls.get(id);
  }

  /**
   * Get all controls
   */
  getAllControls() {
    return Array.from(this.controls.values());
  }

  /**
   * Update button state
   */
  updateButton(id, pressed) {
    const control = this.controls.get(id);
    if (control) {
      control.value = pressed;
      return control;
    }
    return null;
  }

  /**
   * Update knob value
   */
  updateKnob(id, value) {
    const control = this.controls.get(id);
    if (control) {
      control.value = value;
      return control;
    }
    return null;
  }

  /**
   * Update slider value
   */
  updateSlider(id, value) {
    const control = this.controls.get(id);
    if (control) {
      control.value = value;
      return control;
    }
    return null;
  }

  /**
   * Set button lock state
   */
  setButtonLocked(lockKey, locked) {
    if (locked) {
      this.lockedButtons.add(lockKey);
    } else {
      this.lockedButtons.delete(lockKey);
    }
  }

  /**
   * Check if button is locked
   */
  isButtonLocked(lockKey) {
    return this.lockedButtons.has(lockKey);
  }

  /**
   * Get knob click button mapping
   */
  getKnobClickTarget(buttonId) {
    return this.knobClickButtons[buttonId];
  }

  /**
   * Clear all state (useful for reset)
   */
  clear() {
    this.controls.clear();
    this.lockedButtons.clear();
  }
}
