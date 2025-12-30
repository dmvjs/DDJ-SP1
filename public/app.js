import { WebSocketClient } from './js/WebSocketClient.js';
import { ControllerState } from './js/ControllerState.js';
import { UIRenderer } from './js/UIRenderer.js';

// Initialize components
const ws = new WebSocketClient();
const state = new ControllerState();
const ui = new UIRenderer();

// Connect to server
ws.connect(`ws://${window.location.host}`);

// Handle WebSocket messages
ws.on('message', (message) => {
  if (message.type === 'layout') {
    initializeLayout(message.data);
  } else if (message.type === 'event') {
    handleEvent(message.data);
  } else if (message.type === 'lock') {
    handleLockChange(message.data);
  }
});

/**
 * Initialize layout from server
 */
function initializeLayout(layout) {
  layout.forEach(controlDef => {
    // Check if this is a knob-click button
    const knobClickTarget = state.getKnobClickTarget(controlDef.id);
    if (knobClickTarget) {
      state.registerKnobClickButton(controlDef.id, knobClickTarget);
      return;
    }

    // Create and register control
    const element = ui.createControl(controlDef);
    ui.appendTo(element, controlDef.section);
    state.registerControl(controlDef.id, element);
  });
}

/**
 * Handle controller events
 */
function handleEvent(event) {
  const key = `${event.type}-${event.type === 'button' ? event.button : event.knob}-ch${event.channel}`;

  if (!state.hasControl(key)) {
    return;
  }

  const control = state.getControl(key);

  // Handle knob-click buttons
  if (control.type === 'knob-click') {
    const targetControl = state.getControl(control.targetKnob);
    if (targetControl) {
      ui.showKnobClickEffect(targetControl.element, event.pressed);
    }
    return;
  }

  // Handle regular controls
  if (event.type === 'button') {
    handleButtonEvent(control, event);
  } else if (event.type === 'knob') {
    handleKnobEvent(control, event, key);
  }
}

/**
 * Handle button events
 */
function handleButtonEvent(control, event) {
  const lockKey = `${event.channel}:${event.button}`;
  const isLocked = state.isButtonLocked(lockKey);

  state.updateButton(control.id, event.pressed);
  ui.updateButton(control.element, event.pressed, isLocked, event.mainDeckAssigned, event.altDeckAssigned);
}

/**
 * Handle knob events
 */
function handleKnobEvent(control, event, key) {
  // Check if this is a slider
  const sliderFill = control.element.querySelector('.slider-fill');

  if (sliderFill) {
    state.updateSlider(control.id, event.value);
    ui.updateSlider(control.element, event.value);
  } else {
    state.updateKnob(control.id, event.value);
    ui.updateKnob(control.element, key, event.value);
  }
}

/**
 * Handle lock state changes
 */
function handleLockChange(lockData) {
  const key = `button-${lockData.button}-ch${lockData.channel}`;
  const lockKey = `${lockData.channel}:${lockData.button}`;

  state.setButtonLocked(lockKey, lockData.locked);

  if (state.hasControl(key)) {
    const control = state.getControl(key);
    ui.updateLockState(control.element, lockData.locked);
  }
}
