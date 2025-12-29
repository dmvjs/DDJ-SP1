// State management
const controls = new Map();
const ws = new WebSocket(`ws://${window.location.host}`);

// DOM elements
const statusEl = document.getElementById('status');
const lastEventEl = document.getElementById('last-event');
const deckA = document.getElementById('deck-a');
const deckB = document.getElementById('deck-b');
const center = document.getElementById('center');

// WebSocket connection
ws.onopen = () => {
  console.log('Connected to DDJ-SP1');
  statusEl.classList.add('connected');
  statusEl.querySelector('span:last-child').textContent = 'Connected';
};

ws.onclose = () => {
  console.log('Disconnected from DDJ-SP1');
  statusEl.classList.remove('connected');
  statusEl.querySelector('span:last-child').textContent = 'Disconnected';
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'layout') {
    initializeLayout(message.data);
  } else if (message.type === 'event') {
    handleEvent(message.data);
  }
};

// Initialize layout with all controls
function initializeLayout(layout) {
  layout.forEach(control => {
    createControlFromDefinition(control);
  });
  lastEventEl.textContent = 'All controls loaded. Interact with hardware to see values.';
}

// Knob click buttons that should show as red rings
const knobClickButtons = {
  'button-67-ch4': 'knob-0-ch4',  // Left Parameter
  'button-67-ch5': 'knob-0-ch5',  // Right Parameter
  'button-13-ch0': 'knob-23-ch0', // Left AUTO LOOP
  'button-13-ch1': 'knob-23-ch1', // Right AUTO LOOP
  'button-65-ch6': 'knob-64-ch6'  // Center Browser SELECT
};

// Create control from predefined layout
function createControlFromDefinition(definition) {
  // Skip rendering knob click buttons - they're handled as overlays
  if (knobClickButtons[definition.id]) {
    controls.set(definition.id, { isKnobClick: true, targetKnob: knobClickButtons[definition.id] });
    return;
  }

  const control = document.createElement('div');
  control.className = 'control';
  control.id = definition.id;

  const label = document.createElement('div');
  label.className = 'control-label';
  label.textContent = definition.label;

  if (definition.type === 'button') {
    const button = document.createElement('div');
    button.className = 'button';
    control.appendChild(button);
  } else if (definition.type === 'slider') {
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
  } else {
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

  control.appendChild(label);
  controls.set(definition.id, control);

  // Add to appropriate section
  const container = document.getElementById(definition.section);
  container.appendChild(control);
}

// Update control from hardware event
function handleEvent(event) {
  const key = `${event.type}-${event.type === 'button' ? event.button : event.knob}-ch${event.channel}`;

  if (controls.has(key)) {
    updateControl(event, key);
    updateLastEvent(event);
  }
}


function updateControl(event, key) {
  const controlData = controls.get(key);
  if (!controlData) return;

  // Handle knob click buttons (show red ring on target knob)
  if (controlData.isKnobClick) {
    const targetControl = controls.get(controlData.targetKnob);
    if (targetControl) {
      const knobContainer = targetControl.querySelector('.knob-container');
      if (knobContainer) {
        if (event.pressed) {
          knobContainer.classList.add('clicked');
        } else {
          knobContainer.classList.remove('clicked');
        }
      }
    }
    return;
  }

  const control = controlData;

  if (event.type === 'button') {
    const button = control.querySelector('.button');
    if (event.pressed) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  } else {
    // Check if it's a slider or knob
    const sliderFill = control.querySelector('.slider-fill');
    const sliderThumb = control.querySelector('.slider-thumb');

    if (sliderFill && sliderThumb) {
      // Update slider (0-127 maps to 0-100%)
      const percent = (event.value / 127) * 100;
      sliderFill.style.height = `${percent}%`;
      sliderThumb.style.bottom = `${percent}%`;
    } else {
      // Update knob
      const value = control.querySelector('.knob-value');
      const progress = control.querySelector('.knob-progress');
      const knob = control.querySelector('.knob');

      value.textContent = event.value;

      // Calculate rotation (0-127 maps to 0-360 degrees)
      const degrees = (event.value / 127) * 360;
      progress.style.setProperty('--progress', `${degrees}deg`);
      knob.style.transform = `rotate(${degrees}deg)`;
      // Counter-rotate the value to keep it upright, maintaining center position
      value.style.transform = `translate(-50%, -50%) rotate(${-degrees}deg)`;
    }
  }
}


function updateLastEvent(event) {
  if (event.type === 'button') {
    lastEventEl.textContent = `Button ${event.button} ${event.pressed ? 'pressed' : 'released'} (Channel ${event.channel})`;
  } else {
    lastEventEl.textContent = `Knob ${event.knob} = ${event.value} (Channel ${event.channel})`;
  }
}
