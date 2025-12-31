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
const activeTracks = new ActiveTracks('active-tracks');
const songList = new SongList('song-list', activeTracks);
const audioPlayer = new AudioPlayer();

// Track volume levels for each deck (0-127 MIDI range)
const deckVolumes = new Map([
  [0, 127], // Deck 1 - full volume by default
  [1, 127], // Deck 2 - full volume by default
  [2, 127], // Deck 3 - full volume by default
  [3, 127]  // Deck 4 - full volume by default
]);

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

  // Debug logging for LOAD buttons (notes 70, 71, 72, 73)
  if (event.type === 'button' && (event.button === 70 || event.button === 71 || event.button === 72 || event.button === 73) && event.channel === 6) {
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
  const isLoadButton = control.id === 'button-70-ch6' || control.id === 'button-71-ch6' ||
                        control.id === 'button-72-ch6' || control.id === 'button-73-ch6';
  if (isLoadButton) {
    console.log(`🔘 LOAD button event: ${control.id}, pressed=${event.pressed}, channel=${event.channel}, button=${event.button}`);
  }

  state.updateButton(control.id, event.pressed);
  ui.updateButton(control.element, event.pressed, isLocked, event.mainDeckAssigned, event.altDeckAssigned);

  // Handle DECK button state changes - update mode buttons to show new deck's mode
  if (control.id === 'button-114-ch2' || control.id === 'button-114-ch3') {
    console.log(`🎚️ DECK button event: ${control.id}, pressed=${event.pressed}`);
    console.log(`   State after update:`, state.deckButtonStates);
    updateModeButtons();
  }

  // Handle LOAD buttons (only on button press, not release)
  if (event.pressed && isLoadButton) {
    console.log(`✅ Calling handleLoadButton for ${control.id}`);
    handleLoadButton(control.id);
  }

  // Handle SLIP buttons - fade out that deck (only on button press)
  // Support all 4 deck channels (0, 1, 2, 3)
  if (event.pressed && (control.id === 'button-64-ch0' || control.id === 'button-64-ch1' ||
                         control.id === 'button-64-ch2' || control.id === 'button-64-ch3')) {
    handleSlipButton(control.id);
  }

  // Handle CENSOR buttons - reverse playback
  // Support all 4 deck channels (0, 1, 2, 3)
  if (control.id === 'button-21-ch0' || control.id === 'button-21-ch1' ||
      control.id === 'button-21-ch2' || control.id === 'button-21-ch3') {
    if (event.pressed) {
      handleCensorPress(control.id);
    } else {
      handleCensorRelease(control.id);
    }
  }

  // Handle SYNC buttons - sync deck playback positions (only on button press)
  // Support all 4 deck channels (0, 1, 2, 3)
  if (event.pressed && (control.id === 'button-88-ch0' || control.id === 'button-88-ch1' ||
                         control.id === 'button-88-ch2' || control.id === 'button-88-ch3')) {
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

  console.log(`🔍 handleLoadButton: buttonId=${buttonId}`);
  console.log(`   DECK button states:`, state.deckButtonStates);
  console.log(`   DECK 1/3 (ch2, note 114):`, state.isDeckButtonActive(2));
  console.log(`   DECK 2/4 (ch3, note 114):`, state.isDeckButtonActive(3));

  // Based on actual hardware testing:
  // Note 72: LEFT LOAD button - loads to Deck 1 or 3 based on DECK 1/3 button
  // Note 71: RIGHT LOAD button - loads to Deck 2 or 4 based on DECK 2/4 button
  // Note 70, 73: Additional buttons (unknown function, using same logic)

  if (buttonId === 'button-72-ch6') {
    // Button 72: LEFT LOAD button (Deck 1 or 3 based on DECK 1/3 button state)
    const deck3Active = state.isDeckButtonActive(2);
    targetDeck = deck3Active ? 3 : 1;
    console.log(`   → Button 72 (LOAD LEFT): DECK 1/3=${deck3Active}, targetDeck=${targetDeck}`);
  } else if (buttonId === 'button-71-ch6') {
    // Button 71: RIGHT LOAD button (Deck 2 or 4 based on DECK 2/4 button state)
    const deck4Active = state.isDeckButtonActive(3);
    targetDeck = deck4Active ? 4 : 2;
    console.log(`   → Button 71 (LOAD RIGHT): DECK 2/4=${deck4Active}, targetDeck=${targetDeck}`);
  } else if (buttonId === 'button-70-ch6') {
    // Button 70: Try LEFT side logic
    const deck3Active = state.isDeckButtonActive(2);
    targetDeck = deck3Active ? 3 : 1;
    console.log(`   → Button 70 (ALT LEFT): DECK 1/3=${deck3Active}, targetDeck=${targetDeck}`);
  } else if (buttonId === 'button-73-ch6') {
    // Button 73: Try RIGHT side logic
    const deck4Active = state.isDeckButtonActive(3);
    targetDeck = deck4Active ? 4 : 2;
    console.log(`   → Button 73 (ALT RIGHT): DECK 2/4=${deck4Active}, targetDeck=${targetDeck}`);
  }

  if (targetDeck) {
    console.log(`📥 Loading "${selectedSong.title}" to Deck ${targetDeck}...`);
    activeTracks.loadTrack(targetDeck, selectedSong);
    console.log(`✓ Loaded to Deck ${targetDeck}`);

    // If loading to Deck 1, update song list reference key for harmonic mixing
    if (targetDeck === 1) {
      songList.setReferenceKey(selectedSong.key);
      console.log(`🎵 Song list sorted by key ${selectedSong.key} (harmonic mixing)`);
    }

    // Preload audio files for instant playback
    audioPlayer.preloadSong(selectedSong);
  } else {
    console.log('⚠️ No target deck determined!');
  }
}

/**
 * Handle SLIP button press to fade out that deck
 * Supports all 4 deck channels (0-3)
 */
function handleSlipButton(buttonId) {
  let targetDeck;

  // Extract channel from button ID (button-64-ch0 -> channel 0)
  const match = buttonId.match(/ch(\d+)/);
  if (!match) return;

  const channel = parseInt(match[1]);

  // Map channel directly to deck (channel 0=deck 1, 1=deck 2, 2=deck 3, 3=deck 4)
  targetDeck = channel + 1;

  if (targetDeck) {
    const audioDeck = targetDeck - 1; // Convert deck 1-4 to audio deck 0-3
    audioPlayer.fadeOut(audioDeck, 0.2); // 200ms fadeout
    console.log(`💫 SLIP pressed: Fading out Deck ${targetDeck}`);
  }
}

/**
 * Handle CENSOR button press - start reverse playback
 * Supports all 4 deck channels (0-3)
 */
function handleCensorPress(buttonId) {
  // Extract channel from button ID (button-21-ch0 -> channel 0)
  const match = buttonId.match(/ch(\d+)/);
  if (!match) return;

  const channel = parseInt(match[1]);

  // Map channel directly to deck (channel 0=deck 1, 1=deck 2, 2=deck 3, 3=deck 4)
  const targetDeck = channel + 1;

  const audioDeck = targetDeck - 1; // Convert deck 1-4 to audio deck 0-3
  audioPlayer.startReverse(audioDeck);
  console.log(`⏪ CENSOR pressed: Starting reverse on Deck ${targetDeck}`);
}

/**
 * Handle CENSOR button release - stop reverse and resume normal playback
 * Supports all 4 deck channels (0-3)
 */
function handleCensorRelease(buttonId) {
  // Extract channel from button ID (button-21-ch0 -> channel 0)
  const match = buttonId.match(/ch(\d+)/);
  if (!match) return;

  const channel = parseInt(match[1]);

  // Map channel directly to deck (channel 0=deck 1, 1=deck 2, 2=deck 3, 3=deck 4)
  const targetDeck = channel + 1;

  const audioDeck = targetDeck - 1; // Convert deck 1-4 to audio deck 0-3
  audioPlayer.stopReverse(audioDeck);
  console.log(`⏪ CENSOR released: Resuming normal playback on Deck ${targetDeck}`);
}

/**
 * Handle SYNC button press - sync ALL other decks to the pressed deck
 * Supports all 4 deck channels (0-3)
 */
function handleSyncButton(buttonId) {
  console.log(`🔗 SYNC button pressed: ${buttonId}`);

  // Extract channel from button ID (button-88-ch0 -> channel 0)
  const match = buttonId.match(/ch(\d+)/);
  if (!match) return;

  const channel = parseInt(match[1]);

  // Map channel directly to deck (channel 0=deck 1, 1=deck 2, 2=deck 3, 3=deck 4)
  const sourceDeck = channel + 1;

  console.log(`🔗 Syncing ALL other decks to Deck ${sourceDeck}`);

  const sourceAudioDeck = sourceDeck - 1;

  // Get current state of source deck
  const sourceState = audioPlayer.getCurrentPlaybackState(sourceAudioDeck);
  if (!sourceState) {
    console.log(`⚠️  Deck ${sourceDeck} is not playing`);
    return;
  }

  console.log(`🔗 Source: Deck ${sourceDeck} at ${sourceState.section} ${sourceState.position.toFixed(2)}s`);

  // Sync all other decks (1-4) to this source deck
  for (let targetDeck = 1; targetDeck <= 4; targetDeck++) {
    if (targetDeck === sourceDeck) {
      continue; // Skip the source deck itself
    }

    // Get the loaded song for the target deck
    const targetSong = activeTracks.getTrack(targetDeck);
    if (!targetSong) {
      console.log(`   ⏭️  Deck ${targetDeck}: No song loaded, skipping`);
      continue;
    }

    // Check tempo match
    if (sourceState.song.bpm !== targetSong.bpm) {
      console.log(`   ⚠️  Deck ${targetDeck}: Tempo mismatch (${targetSong.bpm} BPM vs ${sourceState.song.bpm} BPM), skipping`);
      continue;
    }

    // Sync target deck to source deck's position
    const targetAudioDeck = targetDeck - 1;
    const beatsPerSecond = targetSong.bpm / 60;
    const positionInBeats = sourceState.position * beatsPerSecond;

    console.log(`   ✅ Deck ${targetDeck}: Syncing to ${sourceState.section} at ${positionInBeats.toFixed(2)} beats`);
    audioPlayer.play(targetSong, targetAudioDeck, sourceState.section, positionInBeats);
  }
}

/**
 * Handle knob events
 */
function handleKnobEvent(control, event, key) {
  // Check if this is the center browser knob (controls song list scrolling)
  if (control.id === 'knob-64-ch6') {
    songList.scroll(event.value, 1); // Normal speed
  }

  // Check if this is SHIFT + browser knob (10x fast scroll)
  if (control.id === 'knob-100-ch6') {
    songList.scroll(event.value, 10); // 10x speed
  }

  // Check if this is the sampler volume slider (controls master volume)
  if (control.id === 'knob-3-ch6') {
    audioPlayer.setMasterVolume(event.value);
  }

  // Check if this is a volume knob (infinite encoder, fast scrolling)
  // Support all 4 deck channels: ch0, ch1, ch2, ch3
  if (control.id === 'knob-23-ch0' || control.id === 'knob-23-ch1' ||
      control.id === 'knob-23-ch2' || control.id === 'knob-23-ch3') {
    // Extract channel from control ID to determine deck
    const match = control.id.match(/ch(\d+)/);
    if (!match) return;

    const targetDeck = parseInt(match[1]); // channel 0=deck 0, 1=deck 1, 2=deck 2, 3=deck 3 (audio deck index)

    // Get current volume for this deck
    let currentVolume = deckVolumes.get(targetDeck);

    // Calculate delta from center (64)
    // Negate for correct direction, use 0.3x multiplier for fine control
    const delta = Math.round(-(event.value - 64) * 0.3);

    // Update volume with clamping (0-127)
    currentVolume = Math.max(0, Math.min(127, currentVolume + delta));
    deckVolumes.set(targetDeck, currentVolume);

    // Set volume for the target deck
    audioPlayer.setVolume(targetDeck, currentVolume);
    console.log(`🔊 Volume: Deck ${targetDeck + 1} = ${currentVolume}`);

    // Update the UI with raw value for correct rotation, but display as percentage
    state.updateKnob(control.id, currentVolume);
    ui.updateKnob(control.element, key, currentVolume, state);

    // Update the displayed text to show percentage
    const percentage = Math.round((currentVolume / 127) * 100);
    const valueDisplay = control.element.querySelector('.knob-value');
    if (valueDisplay) {
      valueDisplay.textContent = percentage;
    }

    return; // Skip default knob handling
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
 * Handle tempo changes (now controlled by SHIFT + volume knob)
 */
function handleTempoChange(tempoData) {
  state.setTempo(tempoData.tempo);

  // Update song list with filtered songs for new tempo
  songList.setTempo(tempoData.tempo);

  console.log(`🎵 Tempo changed to ${tempoData.tempo} BPM via SHIFT + Volume`);
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
  updateDeckModeButtons(0);
  // Update right mode buttons (Deck 2 or 4 based on DECK 2/4 button)
  updateDeckModeButtons(1);
}

/**
 * Update mode buttons for a specific channel
 * Shows the mode for the currently active deck (1-4)
 */
function updateDeckModeButtons(channel) {
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
 * Handle sync state change - sync ALL other decks to the pressed deck
 */
function handleSyncChange(syncData) {
  const { deck } = syncData;
  console.log(`🔗 SYNC pressed: Deck ${deck} - syncing ALL other decks to this deck`);

  const sourceDeck = deck;
  const sourceAudioDeck = sourceDeck - 1;

  // Get current state of source deck
  const sourceState = audioPlayer.getCurrentPlaybackState(sourceAudioDeck);
  if (!sourceState) {
    console.log(`⚠️  Deck ${sourceDeck} is not playing`);
    return;
  }

  console.log(`🔗 Source: Deck ${sourceDeck} at ${sourceState.section} ${sourceState.position.toFixed(2)}s`);

  // Sync all other decks (1-4) to this source deck
  for (let targetDeck = 1; targetDeck <= 4; targetDeck++) {
    if (targetDeck === sourceDeck) {
      continue; // Skip the source deck itself
    }

    // Get the loaded song for the target deck
    const targetSong = activeTracks.getTrack(targetDeck);
    if (!targetSong) {
      console.log(`   ⏭️  Deck ${targetDeck}: No song loaded, skipping`);
      continue;
    }

    // Check tempo match
    if (sourceState.song.bpm !== targetSong.bpm) {
      console.log(`   ⚠️  Deck ${targetDeck}: Tempo mismatch (${targetSong.bpm} BPM vs ${sourceState.song.bpm} BPM), skipping`);
      continue;
    }

    // Sync target deck to source deck's position
    const targetAudioDeck = targetDeck - 1;
    const beatsPerSecond = targetSong.bpm / 60;
    const positionInBeats = sourceState.position * beatsPerSecond;

    console.log(`   ✅ Deck ${targetDeck}: Syncing to ${sourceState.section} at ${positionInBeats.toFixed(2)} beats`);
    audioPlayer.play(targetSong, targetAudioDeck, sourceState.section, positionInBeats);
  }
}

/**
 * Handle performance pad press for audio playback
 * Left pads control Deck 1/3, Right pads control Deck 2/4
 * Based on DECK button state
 */
function handlePadPress(padData) {
  const { channel, note, deck } = padData;

  console.log(`🎹 handlePadPress: channel=${channel}, note=${note}, deck=${deck}`);

  // Update UI to turn on the pad LED
  const padButtonId = `button-${note}-ch${channel}`;
  if (state.hasControl(padButtonId)) {
    const control = state.getControl(padButtonId);
    state.updateButton(padButtonId, true);
    ui.updateButton(control.element, true, false, false, false);
  }

  // Use the deck value sent from backend (already calculated based on DECK button state)
  // Backend correctly determines: channel 7 → Deck 1 or 3, channel 8 → Deck 2 or 4
  const targetDeck = deck;
  console.log(`🎯 Target deck: ${targetDeck} (from backend)`);

  // Get the loaded track for this deck
  const loadedSong = activeTracks.getTrack(targetDeck);
  if (!loadedSong) {
    console.log(`⚠️ No track loaded on Deck ${targetDeck}`);
    return;
  }

  // Check active mode for this deck
  // Use getActiveMode directly with the deck number (1-4)
  const activeMode = state.getActiveMode(targetDeck);
  console.log(`🎮 Active mode for Deck ${targetDeck}: ${activeMode} (${getModeName(activeMode)})`);

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
  const { channel, note } = padData;

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
