(function () {
  'use strict';

  const state = {
    apiKey: null,
    imageBaseUrl: 'https://image.tmdb.org/t/p/w500',
    abortController: null,
  };

  // IDs required by the prompt
  const ids = {
    header: 'appHeader',
    brand: 'brandTitle',
    searchForm: 'searchForm',
    searchInput: 'searchInput',
    searchButton: 'searchButton',
    moviesGrid: 'moviesGrid',
    settingsButton: 'settingsButton',
    settingsModal: 'settingsModal',
    closeSettingsButton: 'closeSettingsButton',
    apiKeyInput: 'apiKeyInput',
    saveApiKeyButton: 'saveApiKeyButton',
  };

  const el = {};

  function qs(id) {
    return document.getElementById(id);
  }

  function initElements() {
    el.header = qs(ids.header);
    el.brand = qs(ids.brand);
    el.searchForm = qs(ids.searchForm);
    el.searchInput = qs(ids.searchInput);
    el.searchButton = qs(ids.searchButton);
    el.moviesGrid = qs(ids.moviesGrid);
    el.settingsButton = qs(ids.settingsButton);
    el.settingsModal = qs(ids.settingsModal);
    el.closeSettingsButton = qs(ids.closeSettingsButton);
    el.apiKeyInput = qs(ids.apiKeyInput);
    el.saveApiKeyButton = qs(ids.saveApiKeyButton);
  }

  function loadApiKey() {
    try {
      const key = localStorage.getItem('tmdb_api_key');
      state.apiKey = key && key.length > 5 ? key : null;
      if (state.apiKey) {
        el.apiKeyInput.value = state.apiKey;
      }
    } catch (_) {
      // ignore
    }
  }

  function saveApiKey(key) {
    try {
      localStorage.setItem('tmdb_api_key', key);
      state.apiKey = key;
    } catch (_) {
      // ignore
    }
  }

  function showSettings(open) {
    if (open) {
      el.settingsModal.removeAttribute('hidden');
      el.apiKeyInput.focus();
    } else {
      el.settingsModal.setAttribute('hidden', '');
    }
  }

  function setBusy(isBusy) {
    const section = document.querySelector('.movies');
    if (!section) return;
    section.setAttribute('aria-busy', String(isBusy));
  }

  function makeCard(movie) {
    const posterPath = movie.poster_path ? `${state.imageBaseUrl}${movie.poster_path}` : '';
    const title = movie.title || movie.name || 'Untitled';
    const rating = typeof movie.vote_average === 'number' ? movie.vote_average.toFixed(1) : 'N/A';

    const card = document.createElement('article');
    card.className = 'card glow';
    card.tabIndex = 0;
    // Ensure each interactive card has a unique ID
    const uniqueIdBase = movie.id ? String(movie.id) : `${title}-${Math.random().toString(36).slice(2)}`;
    card.id = `movieCard-${uniqueIdBase}`;

    card.innerHTML = `
      <div class="poster-wrap">
        ${posterPath ? `<img class="poster" src="${posterPath}" alt="${title} poster">` : `<div class="poster" role="img" aria-label="No poster available"></div>`}
      </div>
      <div class="card-body">
        <h3 class="title" title="${title}">${title}</h3>
        <div class="meta">
          <div class="rating" aria-label="Rating ${rating}">
            <span class="star">★</span>
            <span>${rating}</span>
          </div>
          <span class="badge">${(movie.release_date || movie.first_air_date || '').slice(0, 4)}</span>
        </div>
      </div>
    `;

    // Interactive glow effect with mouse position
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mx', `${x}%`);
      card.style.setProperty('--my', `${y}%`);
    });

    return card;
  }

  async function fetchJson(url) {
    if (!state.apiKey) throw new Error('Missing TMDb API key. Click the gear icon to set it.');
    if (state.abortController) state.abortController.abort();
    state.abortController = new AbortController();
    const res = await fetch(url, { signal: state.abortController.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
  }

  function buildSearchUrl(query, page = 1) {
    const q = encodeURIComponent(query.trim());
    return `https://api.themoviedb.org/3/search/movie?api_key=${state.apiKey}&query=${q}&include_adult=false&language=en-US&page=${page}`;
  }

  function buildTrendingUrl() {
    return `https://api.themoviedb.org/3/trending/movie/week?api_key=${state.apiKey}`;
  }

  async function renderMovies(results) {
    el.moviesGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    results.forEach((m) => frag.appendChild(makeCard(m)));
    el.moviesGrid.appendChild(frag);
  }

  async function searchMovies(query) {
    try {
      setBusy(true);
      const data = await fetchJson(buildSearchUrl(query));
      await renderMovies(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  async function loadTrending() {
    try {
      setBusy(true);
      const data = await fetchJson(buildTrendingUrl());
      await renderMovies(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  function notifyError(err) {
    console.error(err);
    el.moviesGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; color:#b9c8e8; padding: 16px;">
        ${err && err.message ? err.message : 'Something went wrong'}
      </div>
    `;
  }

  function wireEvents() {
    el.settingsButton.addEventListener('click', () => showSettings(true));
    el.closeSettingsButton.addEventListener('click', () => showSettings(false));
    el.settingsModal.addEventListener('click', (e) => {
      if (e.target === el.settingsModal) showSettings(false);
    });

    el.saveApiKeyButton.addEventListener('click', () => {
      const key = el.apiKeyInput.value.trim();
      if (key.length < 10) {
        alert('Please paste a valid TMDb API key.');
        return;
      }
      saveApiKey(key);
      showSettings(false);
      // Load trending when key is saved initially
      loadTrending();
    });

    el.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = el.searchInput.value.trim();
      if (q.length === 0) return;
      searchMovies(q);
    });

    // Simple input debounce
    let debounceTimer = null;
    el.searchInput.addEventListener('input', () => {
      const q = el.searchInput.value.trim();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (q.length >= 3) searchMovies(q);
        if (q.length === 0) loadTrending();
      }, 300);
    });
  }

  function init() {
    initElements();
    loadApiKey();
    wireEvents();
    if (state.apiKey) {
      loadTrending();
    } else {
      showSettings(true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


