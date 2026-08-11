const axios = require('axios');

class DeezerAPI {
  constructor() {
    this.baseURL = 'https://api.deezer.com';
  }

  async search(musique, artiste = '', album = '') {
    try {
      let query = musique;
      if (artiste) query += ` artist:"${artiste}"`;
      if (album) query += ` album:"${album}"`;

      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          q: query,
          limit: 20,
        },
      });

      return response.data.data.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        link: track.link,
        preview: track.preview,
        duration: track.duration,
      }));
    } catch (err) {
      console.error('Deezer search error:', err.message);
      return [];
    }
  }

  async getRandomPlaylist() {
    try {
      const genres = ['pop', 'hip-hop', 'edm', 'rock', 'indie'];
      const randomGenre = genres[Math.floor(Math.random() * genres.length)];

      const response = await axios.get(`${this.baseURL}/genre/${this.getGenreId(randomGenre)}/artists`, {
        params: {
          limit: 50,
        },
      });

      const artists = response.data.data;
      const tracks = [];

      for (const artist of artists.slice(0, 10)) {
        try {
          const artistTracks = await axios.get(`${this.baseURL}/artist/${artist.id}/top`, {
            params: {
              limit: 5,
            },
          });
          tracks.push(...artistTracks.data.data);
        } catch (e) {
          console.warn(`Erreur pour l'artiste ${artist.id}`);
        }
      }

      return tracks.slice(0, 50).map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        link: track.link,
        preview: track.preview,
        duration: track.duration,
      }));
    } catch (err) {
      console.error('Deezer playlist error:', err.message);
      return [];
    }
  }

  getGenreId(genre) {
    const genreMap = {
      'pop': 84,
      'hip-hop': 116,
      'edm': 113,
      'rock': 98,
      'indie': 465,
    };
    return genreMap[genre] || 84;
  }
}

module.exports = { DeezerAPI };
