/**
 * UIRenderer
 *
 * Handles all DOM manipulation for the controller UI.
 * Pure rendering logic separated from state management.
 */
export class UIRenderer {
  constructor() {
    this.fxKnobs = new Set([
      'knob-2-ch4', 'knob-4-ch4', 'knob-6-ch4',
      'knob-2-ch5', 'knob-4-ch5', 'knob-6-ch5'
    ]);

    // Limited-range knobs (BEATS, AUTO LOOP, center browser) - scale for more visual movement
    this.limitedRangeKnobs = new Set([
      'knob-0-ch4', 'knob-0-ch5',   // BEATS
      'knob-23-ch0', 'knob-23-ch1',  // AUTO LOOP
      'knob-64-ch6'                   // Center browser knob
    ]);
  }

  /**
   * Create a control element from definition
   */
  createControl(definition) {
    const control = document.createElement('div');
    control.className = 'control';
    control.id = definition.id;

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = definition.label;

    if (definition.type === 'button') {
      this.createButton(control, definition);
    } else if (definition.type === 'slider') {
      this.createSlider(control);
    } else {
      this.createKnob(control);
    }

    // Add shift stencil label below button (like HOT CUE)
    if (definition.id === 'button-101-ch6') {
      const shiftLabel = document.createElement('div');
      shiftLabel.className = 'shift-stencil-label';
      shiftLabel.textContent = 'VIEW';
      control.appendChild(shiftLabel);
    }

    if (definition.id === 'button-103-ch6') {
      const shiftLabel = document.createElement('div');
      shiftLabel.className = 'shift-stencil-label';
      shiftLabel.textContent = 'AREA';
      control.appendChild(shiftLabel);
    }

    if (definition.id === 'button-114-ch2') {
      const shiftLabel = document.createElement('div');
      shiftLabel.className = 'shift-stencil-label panel-select-stencil';
      shiftLabel.textContent = '← PANEL SELECT →';
      control.appendChild(shiftLabel);
    }

    control.appendChild(label);
    return control;
  }

  /**
   * Create a button element
   */
  createButton(control, definition) {
    const button = document.createElement('div');
    button.className = 'button';

    // Add stencil text for SYNC buttons
    if (definition.id === 'button-88-ch0' || definition.id === 'button-88-ch1') {
      const syncText = document.createElement('span');
      syncText.className = 'stencil-text stencil-text-top';
      syncText.textContent = 'SYNC';
      button.appendChild(syncText);

      const offText = document.createElement('span');
      offText.className = 'stencil-text stencil-text-bottom';
      offText.textContent = 'OFF';
      button.appendChild(offText);
    }

    // Add ON and FX SELECT for FX buttons (FX 1, 2, 3)
    if (definition.id === 'button-71-ch4' || definition.id === 'button-72-ch4' || definition.id === 'button-73-ch4' ||
        definition.id === 'button-71-ch5' || definition.id === 'button-72-ch5' || definition.id === 'button-73-ch5') {
      const onText = document.createElement('span');
      onText.className = 'fx-on-text';
      onText.textContent = 'ON';
      button.appendChild(onText);

      const fxSelectStencil = document.createElement('span');
      fxSelectStencil.className = 'fx-select-stencil';
      button.appendChild(fxSelectStencil);
    }

    // Add TAP and FX MODE for FX ASSIGN buttons
    if (definition.id === 'button-74-ch4' || definition.id === 'button-74-ch5') {
      const tapText = document.createElement('span');
      tapText.className = 'fx-on-text';
      tapText.textContent = 'TAP';
      button.appendChild(tapText);

      const fxModeStencil = document.createElement('span');
      fxModeStencil.className = 'fx-select-stencil fx-mode-stencil';
      button.appendChild(fxModeStencil);
    }

    control.appendChild(button);
  }

  /**
   * Create a slider element
   */
  createSlider(control) {
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';

    const sliderTrack = document.createElement('div');
    sliderTrack.className = 'slider-track';

    const sliderFill = document.createElement('div');
    sliderFill.className = 'slider-fill';

    const sliderThumb = document.createElement('div');
    sliderThumb.className = 'slider-thumb';

    sliderTrack.appendChild(sliderFill);
    sliderTrack.appendChild(sliderThumb);
    sliderContainer.appendChild(sliderTrack);
    control.appendChild(sliderContainer);
  }

  /**
   * Create a knob element
   */
  createKnob(control) {
    const knobContainer = document.createElement('div');
    knobContainer.className = 'knob-container';

    const knobProgress = document.createElement('div');
    knobProgress.className = 'knob-progress';

    const knob = document.createElement('div');
    knob.className = 'knob';

    const value = document.createElement('div');
    value.className = 'knob-value';
    value.textContent = '—';

    knob.appendChild(value);
    knobContainer.appendChild(knobProgress);
    knobContainer.appendChild(knob);
    control.appendChild(knobContainer);
  }

  /**
   * Update button visual state
   * @param {HTMLElement} element - The control container element
   * @param {boolean} pressed - Whether the button is pressed/active
   * @param {boolean} isLocked - Whether the button is locked
   * @param {boolean} mainDeckAssigned - For FX ASSIGN: true if assigned to Deck 1/2
   * @param {boolean} altDeckAssigned - For FX ASSIGN: true if assigned to Deck 3/4
   */
  updateButton(element, pressed, isLocked = false, mainDeckAssigned = false, altDeckAssigned = false) {
    const button = element.querySelector('.button');
    if (!button) return;

    const isFXAssignButton = element.id.includes('button-76-ch6') ||
                            element.id.includes('button-77-ch6') ||
                            element.id.includes('button-80-ch6') ||
                            element.id.includes('button-81-ch6');

    const isDeckButton = element.id.includes('button-114-ch2') ||
                        element.id.includes('button-114-ch3');

    if (isFXAssignButton) {
      // For FX ASSIGN buttons, show both indicators independently
      // Button shows main deck (1/2), container shows alt deck (3/4)
      if (mainDeckAssigned) {
        button.classList.add('active');
      } else if (!isLocked) {
        button.classList.remove('active');
      }

      if (altDeckAssigned) {
        element.classList.add('active');
      } else if (!isLocked) {
        element.classList.remove('active');
      }
    } else if (isDeckButton) {
      // DECK buttons: light up both button and container
      if (pressed) {
        button.classList.add('active');
        element.classList.add('active');
      } else if (!isLocked) {
        button.classList.remove('active');
        element.classList.remove('active');
      }
    } else {
      // Regular buttons: just light up the button
      if (pressed) {
        button.classList.add('active');
      } else if (!isLocked) {
        button.classList.remove('active');
      }
    }
  }

  /**
   * Update knob visual state
   * @param {HTMLElement} element - The knob element
   * @param {string} id - The knob ID
   * @param {number} value - The MIDI value
   * @param {Object} state - The controller state (optional, for BEATS knobs)
   */
  updateKnob(element, id, value, state = null) {
    const valueElement = element.querySelector('.knob-value');
    const progress = element.querySelector('.knob-progress');
    const knob = element.querySelector('.knob');

    if (!valueElement || !progress || !knob) return;

    // BEATS knobs show tempo (84, 94, or 102) instead of MIDI value
    const isBeatsKnob = id === 'knob-0-ch4' || id === 'knob-0-ch5';
    if (isBeatsKnob && state) {
      valueElement.textContent = state.getTempo();
    } else {
      valueElement.textContent = value;
    }

    // FX knobs use 7:00 to 5:00 range (-150° to +150°, 300° total)
    // Limited-range knobs use 9x multiplier for more visible movement
    let degrees;
    if (this.fxKnobs.has(id)) {
      degrees = -150 + (value / 127) * 300;
    } else if (this.limitedRangeKnobs.has(id)) {
      degrees = (value / 127) * 360 * 9;
    } else {
      degrees = (value / 127) * 360;
    }

    progress.style.setProperty('--progress', `${degrees}deg`);
    knob.style.transform = `rotate(${degrees}deg)`;
    valueElement.style.transform = `translate(-50%, -50%) rotate(${-degrees}deg)`;
  }

  /**
   * Update slider visual state
   */
  updateSlider(element, value) {
    const sliderFill = element.querySelector('.slider-fill');
    const sliderThumb = element.querySelector('.slider-thumb');

    if (!sliderFill || !sliderThumb) return;

    const percent = (value / 127) * 100;
    sliderFill.style.height = `${percent}%`;
    sliderThumb.style.bottom = `${percent}%`;
  }

  /**
   * Show knob click effect (red ring)
   */
  showKnobClickEffect(element, show) {
    const knobContainer = element.querySelector('.knob-container');
    if (!knobContainer) return;

    if (show) {
      knobContainer.classList.add('clicked');
    } else {
      knobContainer.classList.remove('clicked');
    }
  }

  /**
   * Update mode button to show active state
   */
  updateModeButton(element, isActive) {
    const button = element.querySelector('.button');
    if (!button) return;

    if (isActive) {
      button.classList.add('mode-active');
    } else {
      button.classList.remove('mode-active');
    }
  }

  /**
   * Update lock indicator for button
   */
  updateLockState(element, locked) {
    const button = element.querySelector('.button');
    if (!button) return;

    // For FX ASSIGN buttons (76, 77, 80, 81) and DECK buttons (114),
    // add active class to container for light indicators
    const isFXAssignButton = element.id.includes('button-76-ch6') ||
                            element.id.includes('button-77-ch6') ||
                            element.id.includes('button-80-ch6') ||
                            element.id.includes('button-81-ch6');

    const isDeckButton = element.id.includes('button-114-ch2') ||
                        element.id.includes('button-114-ch3');

    if (locked) {
      button.classList.add('active');
      if (isFXAssignButton || isDeckButton) {
        element.classList.add('active');
      }
    } else {
      button.classList.remove('active');
      if (isFXAssignButton || isDeckButton) {
        element.classList.remove('active');
      }
    }
  }

  /**
   * Append control to container
   */
  appendTo(control, containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.appendChild(control);
    } else {
      console.warn(`Container not found: ${containerId}`);
    }
  }
}
