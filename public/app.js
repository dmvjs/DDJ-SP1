import { WebSocketClient } from './js/WebSocketClient.js';
import { ControllerState } from './js/ControllerState.js';
import { UIRenderer } from './js/UIRenderer.js';
import { SongList } from './js/SongList.js';
import { ActiveTracks } from './js/ActiveTracks.js';
import { AudioPlayer } from './js/AudioPlayer.js';

// Initialize components
const ws = new WebSocketClient();
const state = new ControllerState();
const ui = new UIRenderer();
const songList = new SongList('song-list');
const activeTracks = new ActiveTracks('active-tracks');
const audioPlayer = new AudioPlayer();

// Connect to server
ws.connect(`ws://${window.location.host}`);

// Handle WebSocket messages
ws.on('message', async (message) => {
  // Try to resume audio context on any controller interaction
  if (audioPlayer.audioContext.state === 'suspended') {
    try {
      await audioPlayer.audioContext.resume();
      console.log('🔊 Audio resumed from controller input');
    } catch (e) {
      // Ignore errors
    }
  }

  if (message.type === 'layout') {
    initializeLayout(message.data);
  } else if (message.type === 'event') {
    handleEvent(message.data);
  } else if (message.type === 'lock') {
    handleLockChange(message.data);
  } else if (message.type === 'tempoChange') {
    handleTempoChange(message.data);
  } else if (message.type === 'deckButtonStates') {
    handleDeckButtonStates(message.data);
  } else if (message.type === 'padModeStates') {
    handlePadModeStates(message.data);
  } else if (message.type === 'modeChange') {
    handleModeChange(message.data);
  } else if (message.type === 'padPress') {
    handlePadPress(message.data);
  } else if (message.type === 'spindown') {
    handleSpindown(message.data);
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

  // After layout is initialized, update mode buttons to show current state
  // This ensures the UI matches the server state on load
  setTimeout(() => updateModeButtons(), 100);
}

/**
 * Handle controller events
 */
function handleEvent(event) {
  const key = `${event.type}-${event.type === 'button' ? event.button : event.knob}-ch${event.channel}`;

  // Debug logging for LOAD buttons
  if (event.type === 'button' && (event.button === 70 || event.button === 71) && event.channel === 6) {
    console.log(`🎯 LOAD button event received: button=${event.button}, channel=${event.channel}, pressed=${event.pressed}, key=${key}`);
    console.log(`   hasControl('${key}'):`, state.hasControl(key));
  }

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

  // Debug logging for LOAD buttons
  if (control.id === 'button-70-ch6' || control.id === 'button-71-ch6') {
    console.log(`🔘 LOAD button event: ${control.id}, pressed=${event.pressed}, channel=${event.channel}, button=${event.button}`);
  }

  state.updateButton(control.id, event.pressed);
  ui.updateButton(control.element, event.pressed, isLocked, event.mainDeckAssigned, event.altDeckAssigned);

  // Handle DECK button state changes - update mode buttons to show new deck's mode
  if (control.id === 'button-114-ch2' || control.id === 'button-114-ch3') {
    updateModeButtons();
  }

  // Handle LOAD buttons (only on button press, not release)
  if (event.pressed && (control.id === 'button-70-ch6' || control.id === 'button-71-ch6')) {
    console.log(`✅ Calling handleLoadButton for ${control.id}`);
    handleLoadButton(control.id);
  }

  // Handle SLIP buttons - fade out that deck (only on button press)
  if (event.pressed && (control.id === 'button-64-ch0' || control.id === 'button-64-ch1')) {
    handleSlipButton(control.id);
  }
}

/**
 * Handle LOAD button press to load selected song to deck
 */
function handleLoadButton(buttonId) {
  const selectedSong = songList.getSelectedSong();

  if (!selectedSong) {
    console.log('No song selected to load');
    return;
  }

  let targetDeck;

  if (buttonId === 'button-70-ch6') {
    // LOAD A: deck 1 or 3 (if DECK 1/3 button active)
    const deck3Active = state.isDeckButtonActive(2);
    targetDeck = deck3Active ? 3 : 1;
    console.log(`🔍 LOAD A: DECK 1/3 button state=${deck3Active}, targetDeck=${targetDeck}`);
    console.log(`   All deck states:`, state.deckButtonStates);
  } else if (buttonId === 'button-71-ch6') {
    // LOAD B: deck 2 or 4 (if DECK 2/4 button active)
    const deck4Active = state.isDeckButtonActive(3);
    targetDeck = deck4Active ? 4 : 2;
    console.log(`🔍 LOAD B: DECK 2/4 button state=${deck4Active}, targetDeck=${targetDeck}`);
    console.log(`   All deck states:`, state.deckButtonStates);
  }

  if (targetDeck) {
    console.log(`📥 Loading "${selectedSong.title}" to Deck ${targetDeck}...`);
    activeTracks.loadTrack(targetDeck, selectedSong);
    console.log(`✓ Loaded to Deck ${targetDeck}`);

    // Preload audio files for instant playback
    audioPlayer.preloadSong(selectedSong);
  } else {
    console.log('⚠️ No target deck determined!');
  }
}

/**
 * Handle SLIP button press to fade out that deck
 */
function handleSlipButton(buttonId) {
  let targetDeck;

  if (buttonId === 'button-64-ch0') {
    // SLIP A (left): deck 1 or 3 based on DECK 1/3 button
    const deck3Active = state.isDeckButtonActive(2);
    targetDeck = deck3Active ? 3 : 1;
  } else if (buttonId === 'button-64-ch1') {
    // SLIP B (right): deck 2 or 4 based on DECK 2/4 button
    const deck4Active = state.isDeckButtonActive(3);
    targetDeck = deck4Active ? 4 : 2;
  }

  if (targetDeck) {
    const audioDeck = targetDeck - 1; // Convert deck 1-4 to audio deck 0-3
    audioPlayer.fadeOut(audioDeck, 0.2); // 200ms fadeout
    console.log(`💫 SLIP pressed: Fading out Deck ${targetDeck}`);
  }
}

/**
 * Handle knob events
 */
function handleKnobEvent(control, event, key) {
  // Check if this is the center browser knob (controls song list scrolling)
  if (control.id === 'knob-64-ch6') {
    songList.scroll(event.value);
  }

  // Check if this is the sampler volume slider (controls master volume)
  if (control.id === 'knob-3-ch6') {
    audioPlayer.setMasterVolume(event.value);
  }

  // Check if this is a slider
  const sliderFill = control.element.querySelector('.slider-fill');

  if (sliderFill) {
    state.updateSlider(control.id, event.value);
    ui.updateSlider(control.element, event.value);
  } else {
    state.updateKnob(control.id, event.value);
    ui.updateKnob(control.element, key, event.value, state);
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

/**
 * Handle tempo changes
 */
function handleTempoChange(tempoData) {
  state.setTempo(tempoData.tempo);

  // Update both BEATS knobs to show new tempo
  const beatsKnobs = ['knob-0-ch4', 'knob-0-ch5'];
  beatsKnobs.forEach(knobId => {
    if (state.hasControl(knobId)) {
      const control = state.getControl(knobId);
      ui.updateKnob(control.element, knobId, control.value || 64, state);
    }
  });

  // Update song list with filtered songs for new tempo
  songList.setTempo(tempoData.tempo);
}

/**
 * Handle DECK button states from server
 */
function handleDeckButtonStates(deckStates) {
  state.setDeckButtonState(2, deckStates.deck1_3);
  state.setDeckButtonState(3, deckStates.deck2_4);
  console.log(`📡 Synced DECK states: 1/3=${deckStates.deck1_3}, 2/4=${deckStates.deck2_4}`);
}

/**
 * Handle initial pad mode states from server
 */
function handlePadModeStates(padModes) {
  state.setActiveMode(1, padModes.deck1);
  state.setActiveMode(2, padModes.deck2);
  state.setActiveMode(3, padModes.deck3);
  state.setActiveMode(4, padModes.deck4);
  updateModeButtons();
  console.log(`📡 Synced pad modes: D1=${getModeName(padModes.deck1)}, D2=${getModeName(padModes.deck2)}, D3=${getModeName(padModes.deck3)}, D4=${getModeName(padModes.deck4)}`);
}

/**
 * Handle pad mode change from server
 */
function handleModeChange(modeData) {
  state.setActiveMode(modeData.deck, modeData.activeMode);
  updateModeButtons();
  console.log(`🎮 Mode changed: Deck ${modeData.deck} → ${getModeName(modeData.activeMode)}`);
}

/**
 * Update mode button UI to reflect active modes
 * Mode buttons show the currently active deck's mode (based on DECK button state)
 */
function updateModeButtons() {
  // Update left mode buttons (Deck 1 or 3 based on DECK 1/3 button)
  updateDeckModeButtons(0, 'deck-a-buttons');
  // Update right mode buttons (Deck 2 or 4 based on DECK 2/4 button)
  updateDeckModeButtons(1, 'deck-b-buttons');
}

/**
 * Update mode buttons for a specific channel
 * Shows the mode for the currently active deck (1-4)
 */
function updateDeckModeButtons(channel, sectionId) {
  const activeMode = state.getActiveModeForChannel(channel);
  const modeButtons = [27, 30, 32, 34]; // HOT CUE, ROLL, SLICER, SAMPLER

  modeButtons.forEach(note => {
    const buttonId = `button-${note}-ch${channel}`;
    if (state.hasControl(buttonId)) {
      const control = state.getControl(buttonId);
      const isActive = note === activeMode;
      ui.updateModeButton(control.element, isActive);
    }
  });
}

/**
 * Get mode name from note number
 */
function getModeName(note) {
  const names = {
    27: 'HOT CUE',
    30: 'ROLL',
    32: 'SLICER',
    34: 'SAMPLER'
  };
  return names[note] || 'UNKNOWN';
}

/**
 * Handle spindown effect (SHIFT + SYNC)
 * Vinyl stop / brake effect
 */
function handleSpindown(spindownData) {
  const { deck } = spindownData;
  const audioDeck = deck - 1; // Convert deck 1-4 to audio deck 0-3
  audioPlayer.spindown(audioDeck);
}

/**
 * Handle performance pad press for audio playback
 * Left pads control Deck 1/3, Right pads control Deck 2/4
 * Based on DECK button state
 */
function handlePadPress(padData) {
  const { channel, note, deck } = padData;

  // Determine which deck to control based on pad channel and DECK button state
  // channel 7 = left pads (Deck A) → controls Deck 1 or 3
  // channel 8 = right pads (Deck B) → controls Deck 2 or 4
  let targetDeck;
  if (channel === 7) {
    // Left pads
    const deck3Active = state.isDeckButtonActive(2);
    targetDeck = deck3Active ? 3 : 1;
  } else if (channel === 8) {
    // Right pads
    const deck4Active = state.isDeckButtonActive(3);
    targetDeck = deck4Active ? 4 : 2;
  } else {
    console.log(`⚠️ Unknown pad channel: ${channel}`);
    return;
  }

  // Get the loaded track for this deck
  const loadedSong = activeTracks.getTrack(targetDeck);
  if (!loadedSong) {
    console.log(`⚠️ No track loaded on Deck ${targetDeck}`);
    return;
  }

  // Determine section and position from pad
  let section, position;
  if (note === 0) {
    section = 'lead';
    position = 0;
    console.log(`🎹 Pad 1 (Deck ${targetDeck}): Playing LEAD`);
  } else if (note === 1) {
    section = 'body';
    position = 0.5; // 0.5 beats (eighth note)
    console.log(`🎹 Pad 2 (Deck ${targetDeck}): Playing BODY +0.5 beats (eighth note)`);
  } else if (note === 2) {
    section = 'body';
    position = 0.75; // 0.75 beats (shuffle point)
    console.log(`🎹 Pad 3 (Deck ${targetDeck}): Playing BODY +0.75 beats`);
  } else if (note === 3) {
    section = 'body';
    position = 1.0; // 1 beat (first snare on beat 2)
    console.log(`🎹 Pad 4 (Deck ${targetDeck}): Playing BODY +1 beat (SNARE)`);
  } else if (note === 4) {
    section = 'body';
    position = 0; // 0 beats (body start)
    console.log(`🎹 Pad 5 (Deck ${targetDeck}): Playing BODY 0 beats`);
  } else if (note === 5) {
    section = 'body';
    position = 16; // 16 beats (25%)
    console.log(`🎹 Pad 6 (Deck ${targetDeck}): Playing BODY 16 beats (25%)`);
  } else if (note === 6) {
    section = 'body';
    position = 32; // 32 beats (50%)
    console.log(`🎹 Pad 7 (Deck ${targetDeck}): Playing BODY 32 beats (50%)`);
  } else if (note === 7) {
    section = 'body';
    position = 48; // 48 beats (75%)
    console.log(`🎹 Pad 8 (Deck ${targetDeck}): Playing BODY 48 beats (75%)`);
  } else {
    return;
  }

  // Play on the target deck (map deck 1-4 to audio deck 0-3)
  const audioDeck = targetDeck - 1;
  audioPlayer.play(loadedSong, audioDeck, section, position);
  console.log(`▶️  Deck ${targetDeck}: "${loadedSong.title}"`);
}
