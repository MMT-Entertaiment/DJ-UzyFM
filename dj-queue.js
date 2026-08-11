class MusicQueue {
  constructor() {
    this.tracks = [];
    this.currentIndex = 0;
  }

  addTrack(track) {
    this.tracks.push(track);
  }

  addTracks(tracks) {
    this.tracks.push(...tracks);
  }

  skipNext() {
    this.currentIndex++;
    if (this.currentIndex >= this.tracks.length) {
      this.currentIndex = 0;
    }
    return this.current();
  }

  skipPrevious() {
    this.currentIndex--;
    if (this.currentIndex < 0) {
      this.currentIndex = this.tracks.length - 1;
    }
    return this.current();
  }

  current() {
    return this.tracks[this.currentIndex] || null;
  }

  clear() {
    this.tracks = [];
    this.currentIndex = 0;
  }

  remove(index) {
    this.tracks.splice(index, 1);
    if (this.currentIndex >= this.tracks.length) {
      this.currentIndex = Math.max(0, this.tracks.length - 1);
    }
  }

  size() {
    return this.tracks.length;
  }
}

module.exports = { MusicQueue };
