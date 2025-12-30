/**
 * SongList Component
 *
 * Displays filtered song list from Kwyjibo library
 * E-reader style with zebra striping
 */

export class SongList {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.songs = [];
    this.currentTempo = 94;
    this.selectedIndex = 0;
    this.scrollPosition = 0;
    this.lastScrollTime = 0;
    this.scrollDebounceMs = 400; // Only allow one scroll per 400ms
    this.loadSongs();
  }

  /**
   * Load songs from songdata
   */
  async loadSongs() {
    try {
      const module = await import('../songdata.js');
      this.songs = module.songdata || [];
      this.render();
    } catch (error) {
      console.error('Failed to load songs:', error);
    }
  }

  /**
   * Update tempo filter
   */
  setTempo(tempo) {
    this.currentTempo = tempo;
    this.selectedIndex = 0;
    this.render();
  }

  /**
   * Get filtered songs for current tempo
   */
  getFilteredSongs() {
    return this.songs.filter(song => song.bpm === this.currentTempo);
  }

  /**
   * Scroll the list (called by center knob)
   */
  scroll(value) {
    const filteredSongs = this.getFilteredSongs();
    if (filteredSongs.length === 0) return;

    // Debounce: ignore rapid scroll events
    const now = Date.now();
    if (now - this.lastScrollTime < this.scrollDebounceMs) {
      return;
    }
    this.lastScrollTime = now;

    // Infinite encoder: 1-63 = down, 65-127 = up
    if (value < 64) {
      // Scroll down
      this.selectedIndex = Math.min(this.selectedIndex + 1, filteredSongs.length - 1);
    } else if (value > 64) {
      // Scroll up
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    }

    this.render();
    this.scrollToSelected();
  }

  /**
   * Scroll the selected item into view
   */
  scrollToSelected() {
    const wrapper = this.container.querySelector('.song-list-wrapper');
    const selectedItem = this.container.querySelector('.song-item.selected');
    if (wrapper && selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }

  /**
   * Get currently selected song
   */
  getSelectedSong() {
    const filteredSongs = this.getFilteredSongs();
    return filteredSongs[this.selectedIndex] || null;
  }

  /**
   * Render the song list
   */
  render() {
    if (!this.container) return;

    const filteredSongs = this.getFilteredSongs();

    this.container.innerHTML = `
      <div class="song-list-container">
        <div class="song-list-header">
          <span class="tempo-display">${this.currentTempo} BPM</span>
          <span class="song-count">${filteredSongs.length} songs</span>
        </div>
        <div class="song-list-wrapper">
          <ul class="song-list">
            ${filteredSongs.map((song, index) => `
              <li class="song-item ${index === this.selectedIndex ? 'selected' : ''}" data-id="${song.id}">
                <span class="song-id">#${song.id}</span>
                <span class="song-artist">${this.escapeHtml(song.artist)}</span>
                <span class="song-title">${this.escapeHtml(song.title)}</span>
                <span class="song-key">Key ${song.key}</span>
                <span class="song-bpm">${song.bpm}</span>
              </li>
            `).join('')}
          </ul>
        </div>
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
