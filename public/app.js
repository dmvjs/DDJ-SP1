const controls = new Map();
const ws = new WebSocket(`ws://${window.location.host}`);

ws.onopen = () => {
  console.log('Connected to DDJ-SP1');
};

ws.onclose = () => {
  console.log('Disconnected from DDJ-SP1');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'layout') {
    initializeLayout(message.data);
  } else if (message.type === 'event') {
    handleEvent(message.data);
  }
};

function initializeLayout(layout) {
  layout.forEach(control => {
    createControlFromDefinition(control);
  });
}

// Knob click buttons that should show as red rings
const knobClickButtons = {
  'button-67-ch4': 'knob-0-ch4',  // Left Parameter
  'button-67-ch5': 'knob-0-ch5',  // Right Parameter
  'button-13-ch0': 'knob-23-ch0', // Left AUTO LOOP
  'button-13-ch1': 'knob-23-ch1', // Right AUTO LOOP
  'button-65-ch6': 'knob-64-ch6'  // Center Browser SELECT
};

function createControlFromDefinition(definition) {
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

    // Add TAP and FX MODE for FX ASSIGN buttons (fourth button)
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

  const container = document.getElementById(definition.section);
  container.appendChild(control);
}

function handleEvent(event) {
  const key = `${event.type}-${event.type === 'button' ? event.button : event.knob}-ch${event.channel}`;
  if (controls.has(key)) {
    updateControl(event, key);
  }
}


// FX knobs that use 7:00 to 5:00 range (300 degrees)
const fxKnobs = new Set([
  'knob-2-ch4', 'knob-4-ch4', 'knob-6-ch4',  // Deck A FX knobs
  'knob-2-ch5', 'knob-4-ch5', 'knob-6-ch5'   // Deck B FX knobs
]);

function updateControl(event, key) {
  const controlData = controls.get(key);
  if (!controlData) return;

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
    const sliderFill = control.querySelector('.slider-fill');
    const sliderThumb = control.querySelector('.slider-thumb');

    if (sliderFill && sliderThumb) {
      const percent = (event.value / 127) * 100;
      sliderFill.style.height = `${percent}%`;
      sliderThumb.style.bottom = `${percent}%`;
    } else {
      const value = control.querySelector('.knob-value');
      const progress = control.querySelector('.knob-progress');
      const knob = control.querySelector('.knob');

      value.textContent = event.value;

      // FX knobs use 7:00 to 5:00 range (-150° to +150°, 300° total)
      let degrees;
      if (fxKnobs.has(key)) {
        degrees = -150 + (event.value / 127) * 300;
      } else {
        degrees = (event.value / 127) * 360;
      }

      progress.style.setProperty('--progress', `${degrees}deg`);
      knob.style.transform = `rotate(${degrees}deg)`;
      value.style.transform = `translate(-50%, -50%) rotate(${-degrees}deg)`;
    }
  }
}
