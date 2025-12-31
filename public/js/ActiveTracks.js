/**
 * ActiveTracks Component
 *
 * Displays currently loaded songs for decks 1-4
 * 4-column grid showing active track info
 */

export class ActiveTracks {
  constructor(containerId, ws) {
    this.container = document.getElementById(containerId);
    this.ws = ws; // WebSocket client for sending deck load notifications
    this.tracks = {
      1: null,
      2: null,
      3: null,
      4: null
    };
    this.render();
  }

  /**
   * Load a song into a deck
   */
  loadTrack(deck, song) {
    console.log(`📥 ActiveTracks.loadTrack: deck=${deck}, song=${song?.title}`);
    console.log(`   Before:`, this.tracks);
    const wasLoaded = this.tracks[deck] !== null;
    const isLoaded = song !== null;

    this.tracks[deck] = song;
    console.log(`   After:`, this.tracks);
    this.render();
    console.log(`   ✓ Rendered`);

    // Notify backend of deck load state change
    if (wasLoaded !== isLoaded) {
      this.ws.send({
        type: 'deckLoad',
        data: { deck, loaded: isLoaded }
      });
      console.log(`📡 Sent deckLoad notification: deck=${deck}, loaded=${isLoaded}`);
    }
  }

  /**
   * Get loaded track for a deck
   */
  getTrack(deck) {
    return this.tracks[deck];
  }

  /**
   * Render the active tracks display
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="active-tracks-container">
        ${[1, 2, 3, 4].map(deck => `
          <div class="active-track deck-${deck}">
            ${this.tracks[deck] ? `
              <span class="track-header">D${deck}</span>
              <span class="track-key key-${this.tracks[deck].key}">${this.tracks[deck].key}</span>
              <span class="track-content">${this.escapeHtml(this.tracks[deck].artist)} - ${this.escapeHtml(this.tracks[deck].title)}</span>
            ` : `
              <span class="track-header">D${deck}</span>
              <span class="track-empty">—</span>
            `}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
