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
  } else if (message.type === 'padRelease') {
    handlePadRelease(message.data);
  } else if (message.type === 'spindown') {
    handleSpindown(message.data);
  } else if (message.type === 'syncChange') {
    handleSyncChange(message.data);
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

  // Handle CENSOR buttons - reverse playback
  if (control.id === 'button-21-ch0' || control.id === 'button-21-ch1') {
    if (event.pressed) {
      handleCensorPress(control.id);
    } else {
      handleCensorRelease(control.id);
    }
  }

  // Handle SYNC buttons - sync deck playback positions (only on button press)
  if (event.pressed && (control.id === 'button-88-ch0' || control.id === 'button-88-ch1')) {
    handleSyncButton(control.id);
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
 * Handle CENSOR button press - start reverse playback
 */
function handleCensorPress(buttonId) {
  let targetDeck;

  if (buttonId === 'button-21-ch0') {
    // CENSOR A (left): deck 1 or 3 based on DECK 1/3 button
    const deck3Active = state.isDeckButtonActive(2);
    targetDeck = deck3Active ? 3 : 1;
  } else if (buttonId === 'button-21-ch1') {
    // CENSOR B (right): deck 2 or 4 based on DECK 2/4 button
    const deck4Active = state.isDeckButtonActive(3);
    targetDeck = deck4Active ? 4 : 2;
  }

  if (targetDeck) {
    const audioDeck = targetDeck - 1; // Convert deck 1-4 to audio deck 0-3
    audioPlayer.startReverse(audioDeck);
    console.log(`⏪ CENSOR pressed: Starting reverse on Deck ${targetDeck}`);
  }
}

/**
 * Handle CENSOR button release - stop reverse and resume normal playback
 */
function handleCensorRelease(buttonId) {
  let targetDeck;

  if (buttonId === 'button-21-ch0') {
    // CENSOR A (left): deck 1 or 3 based on DECK 1/3 button
    const deck3Active = state.isDeckButtonActive(2);
    targetDeck = deck3Active ? 3 : 1;
  } else if (buttonId === 'button-21-ch1') {
    // CENSOR B (right): deck 2 or 4 based on DECK 2/4 button
    const deck4Active = state.isDeckButtonActive(3);
    targetDeck = deck4Active ? 4 : 2;
  }

  if (targetDeck) {
    const audioDeck = targetDeck - 1; // Convert deck 1-4 to audio deck 0-3
    audioPlayer.stopReverse(audioDeck);
    console.log(`⏪ CENSOR released: Resuming normal playback on Deck ${targetDeck}`);
  }
}

/**
 * Handle SYNC button press - sync one deck's playback to the other
 */
function handleSyncButton(buttonId) {
  console.log(`🔗 SYNC button pressed: ${buttonId}`);

  if (buttonId === 'button-88-ch0') {
    // SYNC A (left): sync right deck to left deck's position
    const deck3Active = state.isDeckButtonActive(2);
    const deck4Active = state.isDeckButtonActive(3);
    const leftDeck = deck3Active ? 3 : 1;
    const rightDeck = deck4Active ? 4 : 2;

    console.log(`🔗 SYNC LEFT: leftDeck=${leftDeck}, rightDeck=${rightDeck}`);

    // Get the loaded song for the right deck
    const rightSong = activeTracks.getTrack(rightDeck);
    if (!rightSong) {
      console.log(`⚠️  No song loaded on Deck ${rightDeck}`);
      return;
    }

    const leftAudioDeck = leftDeck - 1;
    const rightAudioDeck = rightDeck - 1;

    // Get current state of left deck
    const leftState = audioPlayer.getCurrentPlaybackState(leftAudioDeck);
    if (!leftState) {
      console.log(`⚠️  Deck ${leftDeck} is not playing`);
      return;
    }

    // Check tempo match
    if (leftState.song.bpm !== rightSong.bpm) {
      console.log(`⚠️  Tempo mismatch: Deck ${leftDeck} (${leftState.song.bpm} BPM) vs Deck ${rightDeck} (${rightSong.bpm} BPM)`);
      return;
    }

    // Sync right deck to left deck's position
    const beatsPerSecond = rightSong.bpm / 60;
    const positionInBeats = leftState.position * beatsPerSecond;
    console.log(`🔗 Syncing Deck ${rightDeck} to Deck ${leftDeck}: ${leftState.section} at ${positionInBeats.toFixed(2)} beats`);
    audioPlayer.play(rightSong, rightAudioDeck, leftState.section, positionInBeats);

  } else if (buttonId === 'button-88-ch1') {
    // SYNC B (right): sync left deck to right deck's position
    const deck3Active = state.isDeckButtonActive(2);
    const deck4Active = state.isDeckButtonActive(3);
    const leftDeck = deck3Active ? 3 : 1;
    const rightDeck = deck4Active ? 4 : 2;

    console.log(`🔗 SYNC RIGHT: leftDeck=${leftDeck}, rightDeck=${rightDeck}`);

    // Get the loaded song for the left deck
    const leftSong = activeTracks.getTrack(leftDeck);
    if (!leftSong) {
      console.log(`⚠️  No song loaded on Deck ${leftDeck}`);
      return;
    }

    const leftAudioDeck = leftDeck - 1;
    const rightAudioDeck = rightDeck - 1;

    // Get current state of right deck
    const rightState = audioPlayer.getCurrentPlaybackState(rightAudioDeck);
    if (!rightState) {
      console.log(`⚠️  Deck ${rightDeck} is not playing`);
      return;
    }

    // Check tempo match
    if (rightState.song.bpm !== leftSong.bpm) {
      console.log(`⚠️  Tempo mismatch: Deck ${rightDeck} (${rightState.song.bpm} BPM) vs Deck ${leftDeck} (${leftSong.bpm} BPM)`);
      return;
    }

    // Sync left deck to right deck's position
    const beatsPerSecond = leftSong.bpm / 60;
    const positionInBeats = rightState.position * beatsPerSecond;
    console.log(`🔗 Syncing Deck ${leftDeck} to Deck ${rightDeck}: ${rightState.section} at ${positionInBeats.toFixed(2)} beats`);
    audioPlayer.play(leftSong, leftAudioDeck, rightState.section, positionInBeats);
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
 * Handle sync state change - sync deck playback when SYNC is pressed
 */
function handleSyncChange(syncData) {
  const { deck, synced } = syncData;
  console.log(`🔗 SYNC pressed: Deck ${deck}, synced=${synced}`);

  // Sync immediately on every SYNC button press (ignore toggle state)
  // if (!synced) {
  //   return;
  // }

  // Determine left and right decks based on deck button states
  const deck3Active = state.isDeckButtonActive(2);
  const deck4Active = state.isDeckButtonActive(3);
  const leftDeck = deck3Active ? 3 : 1;
  const rightDeck = deck4Active ? 4 : 2;

  let sourceDeck, targetDeck;

  // If left deck (1 or 3) pressed SYNC, sync right deck to left
  if (deck === leftDeck) {
    sourceDeck = leftDeck;
    targetDeck = rightDeck;
    console.log(`🔗 SYNC LEFT: Syncing Deck ${targetDeck} to Deck ${sourceDeck}`);
  }
  // If right deck (2 or 4) pressed SYNC, sync left deck to right
  else if (deck === rightDeck) {
    sourceDeck = rightDeck;
    targetDeck = leftDeck;
    console.log(`🔗 SYNC RIGHT: Syncing Deck ${targetDeck} to Deck ${sourceDeck}`);
  } else {
    return;
  }

  // Get the loaded songs for both decks
  const targetSong = activeTracks.getTrack(targetDeck);
  if (!targetSong) {
    console.log(`⚠️  No song loaded on Deck ${targetDeck}`);
    return;
  }

  const sourceAudioDeck = sourceDeck - 1;
  const targetAudioDeck = targetDeck - 1;

  // Get current state of source deck
  const sourceState = audioPlayer.getCurrentPlaybackState(sourceAudioDeck);
  if (!sourceState) {
    console.log(`⚠️  Deck ${sourceDeck} is not playing`);
    return;
  }

  // Check tempo match
  if (sourceState.song.bpm !== targetSong.bpm) {
    console.log(`⚠️  Tempo mismatch: Deck ${sourceDeck} (${sourceState.song.bpm} BPM) vs Deck ${targetDeck} (${targetSong.bpm} BPM)`);
    return;
  }

  // Sync target deck to source deck's position
  const beatsPerSecond = targetSong.bpm / 60;
  const positionInBeats = sourceState.position * beatsPerSecond;
  console.log(`🔗 Syncing: ${sourceState.section} at ${positionInBeats.toFixed(2)} beats`);
  audioPlayer.play(targetSong, targetAudioDeck, sourceState.section, positionInBeats);
}

/**
 * Handle performance pad press for audio playback
 * Left pads control Deck 1/3, Right pads control Deck 2/4
 * Based on DECK button state
 */
function handlePadPress(padData) {
  const { channel, note, deck } = padData;

  // Update UI to turn on the pad LED
  const padButtonId = `button-${note}-ch${channel}`;
  if (state.hasControl(padButtonId)) {
    const control = state.getControl(padButtonId);
    state.updateButton(padButtonId, true);
    ui.updateButton(control.element, true, false, false, false);
  }

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

  // Check active mode for this deck
  const activeMode = state.getActiveModeForChannel(channel === 7 ? 0 : 1);
  console.log(`🎮 Active mode for channel ${channel === 7 ? 0 : 1}: ${activeMode} (${getModeName(activeMode)})`);

  // ROLL MODE (30): Loop small sections based on pad
  if (activeMode === 30) {
    const rollBeats = [2, 1, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625][note];
    if (rollBeats !== undefined) {
      const audioDeck = targetDeck - 1;
      console.log(`🔁 Starting roll: Deck ${targetDeck}, Pad ${note + 1}, ${rollBeats} beats`);
      audioPlayer.startRoll(audioDeck, rollBeats, loadedSong);
      console.log(`🔁 Pad ${note + 1} (Deck ${targetDeck}): Roll ${rollBeats} beats`);
    }
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

  // HOT CUE MODE (27): Play specific sections
  // Play on the target deck (map deck 1-4 to audio deck 0-3)
  const audioDeck = targetDeck - 1;
  audioPlayer.play(loadedSong, audioDeck, section, position);
  console.log(`▶️  Deck ${targetDeck}: "${loadedSong.title}"`);
}

/**
 * Handle performance pad release
 * Stops roll effect when pad is released in ROLL mode
 */
function handlePadRelease(padData) {
  const { channel, note, deck } = padData;

  // Update UI to turn off the pad LED
  const padButtonId = `button-${note}-ch${channel}`;
  if (state.hasControl(padButtonId)) {
    const control = state.getControl(padButtonId);
    state.updateButton(padButtonId, false);
    ui.updateButton(control.element, false, false, false, false);
  }

  // Determine which deck to control
  let targetDeck;
  if (channel === 7) {
    const deck3Active = state.isDeckButtonActive(2);
    targetDeck = deck3Active ? 3 : 1;
  } else if (channel === 8) {
    const deck4Active = state.isDeckButtonActive(3);
    targetDeck = deck4Active ? 4 : 2;
  } else {
    return;
  }

  // Check active mode for this deck
  const activeMode = state.getActiveModeForChannel(channel === 7 ? 0 : 1);

  // ROLL MODE (30): Stop roll on release
  if (activeMode === 30) {
    const audioDeck = targetDeck - 1;
    audioPlayer.stopRoll(audioDeck);
    console.log(`🔁 Pad ${note + 1} (Deck ${targetDeck}): Roll stopped`);
  }
}
