/**
 * ============================================================================
 * TYPETOSEE - APPLICATION CONTROLLER (app.js)
 * Requires js/collections.js to be loaded first (defines CURATED_COLLECTIONS).
 * ============================================================================
 */
const DEFAULT_THEME = 'nature';
const MIN_TILES = 12;
const MAX_TILES = 18;
const DEBOUNCE_DELAY_MS = 500;
const STAGGER_DELAY_MS = 40;

// Persistent API Configuration State
// Storage helpers: localStorage can throw (private mode, blocked site data), so never trust it blindly.
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) { /* ignore */ }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
}

let apiProvider = storageGet('tts_provider') || 'unsplash';
let apiKey = storageGet('tts_key') || '';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// DOM Elements
const mosaicGrid = document.getElementById('mosaicGrid');
const searchPill = document.getElementById('searchPill');
const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');
const chipsRow = document.getElementById('chipsRow');
const tileCounter = document.getElementById('tileCounter');
const statusPill = document.getElementById('statusPill');

const openApiModalBtn = document.getElementById('openApiModalBtn');
const apiModal = document.getElementById('apiModal');
const closeApiModalBtn = document.getElementById('closeApiModalBtn');
const providerSelect = document.getElementById('providerSelect');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiBtn = document.getElementById('saveApiBtn');
const clearApiBtn = document.getElementById('clearApiBtn');
const apiDot = document.getElementById('apiDot');
const apiBtnLabel = document.getElementById('apiBtnLabel');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxAuthor = document.getElementById('lightboxAuthor');
const lightboxLink = document.getElementById('lightboxLink');
const lightboxClose = document.getElementById('lightboxClose');

let debounceTimer = null;
let activeSearchController = null;
let currentQuery = '';
let statusTimeout = null;

function updateApiStatusIndicator() {
  if (apiKey && apiKey.trim() !== '') {
    apiDot.classList.add('is-active');
    apiBtnLabel.textContent = `API Connected (${providerSelect.options[providerSelect.selectedIndex].text.split(' ')[0]})`;
  } else {
    apiDot.classList.remove('is-active');
    apiBtnLabel.textContent = 'Connect API';
  }
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function showStatusMessage(message, type = 'error', duration = 4200) {
  if (statusTimeout) clearTimeout(statusTimeout);
  statusPill.textContent = message;
  statusPill.className = 'status-pill is-visible ' + (type === 'info' ? 'is-info' : '');
  if (duration > 0) {
    statusTimeout = setTimeout(() => { statusPill.classList.remove('is-visible'); }, duration);
  }
}

function syncActiveChip(query) {
  const normalized = query.trim().toLowerCase();
  chipsRow.querySelectorAll('.chip').forEach(chip => {
    if (chip.dataset.query.toLowerCase() === normalized) {
      chip.classList.add('is-active');
    } else {
      chip.classList.remove('is-active');
    }
  });
}

/**
 * Image Fetching orchestrator supporting Unsplash, Pexels, and Built-in Fallbacks
 */
async function fetchImagesForQuery(query, count, signal) {
  const cleanQuery = query.trim().toLowerCase();
  if (cleanQuery === 'noresults' || cleanQuery.length > 35) return [];

  // 1. Live Unsplash API
  if (apiKey && apiProvider === 'unsplash') {
    const endpoint = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cleanQuery)}&per_page=${count}&orientation=landscape`;
    const res = await fetch(endpoint, { signal, headers: { Authorization: `Client-ID ${apiKey}` } });
    if (!res.ok) throw new Error(`Unsplash status ${res.status}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) return [];
    return data.results.slice(0, count).map(item => ({
      smallUrl: item.urls.regular || item.urls.small,
      fullUrl: item.urls.full || item.urls.regular,
      alt: item.alt_description || `${cleanQuery} photography`,
      author: item.user?.name || 'Unsplash Photographer',
      link: item.links?.html || 'https://unsplash.com'
    }));
  }

  // 2. Live Pexels API
  if (apiKey && apiProvider === 'pexels') {
    const endpoint = `https://api.pexels.com/v1/search?query=${encodeURIComponent(cleanQuery)}&per_page=${count}`;
    const res = await fetch(endpoint, { signal, headers: { Authorization: apiKey } });
    if (!res.ok) throw new Error(`Pexels status ${res.status}`);
    const data = await res.json();
    if (!data.photos || data.photos.length === 0) return [];
    return data.photos.slice(0, count).map(item => ({
      smallUrl: item.src.large || item.src.medium,
      fullUrl: item.src.original || item.src.large2x,
      alt: item.alt || `${cleanQuery} photography`,
      author: item.photographer || 'Pexels Creator',
      link: item.url || 'https://pexels.com'
    }));
  }

  // 3. Built-in Fallback (works instantly without API keys)
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, 240);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); });
  });

  const matchedKey = Object.keys(CURATED_COLLECTIONS).find(k => cleanQuery.includes(k) || k.includes(cleanQuery));
  if (matchedKey) {
    const shuffled = shuffleArray(CURATED_COLLECTIONS[matchedKey]).slice(0, count);
    return shuffled.map(item => ({
      smallUrl: `https://images.unsplash.com/${item.id}?auto=format&fit=crop&w=700&q=80`,
      fullUrl: `https://images.unsplash.com/${item.id}?auto=format&fit=crop&w=1600&q=85`,
      alt: item.title,
      author: item.author,
      link: `https://unsplash.com/photos/${item.id.replace('photo-', '')}`
    }));
  }

  const combinedPool = Object.values(CURATED_COLLECTIONS).flat();
  const results = [];
  for (let i = 0; i < count; i++) {
    const seed = encodeURIComponent(`${cleanQuery}-${i + 1}`);
    const fallbackItem = combinedPool[(cleanQuery.charCodeAt(0) + i * 7) % combinedPool.length];
    results.push({
      smallUrl: `https://picsum.photos/seed/${seed}/720/540`,
      fullUrl: `https://picsum.photos/seed/${seed}/1600/1200`,
      fallbackUrl: `https://images.unsplash.com/${fallbackItem.id}?auto=format&fit=crop&w=700&q=80`,
      alt: `${query} — Mosaic Tile #${i + 1}`,
      author: `TypeToSee Curated (${query})`,
      link: 'https://unsplash.com'
    });
  }
  return results;
}

function assignBentoSpans(totalTiles) {
  const spans = new Array(totalTiles).fill('');
  if (totalTiles <= 13) { spans[0] = 'span-featured'; spans[3] = 'span-wide'; spans[6] = 'span-tall'; spans[8] = 'span-wide'; }
  else if (totalTiles <= 15) { spans[0] = 'span-wide'; spans[2] = 'span-tall'; spans[5] = 'span-wide'; spans[9] = 'span-wide'; }
  else { spans[0] = 'span-wide'; spans[4] = 'span-tall'; spans[7] = 'span-wide'; }
  return spans;
}

function animateOldTilesOut() {
  return new Promise(resolve => {
    const existing = Array.from(mosaicGrid.querySelectorAll('.tile'));
    if (existing.length === 0) { resolve(); return; }
    existing.forEach((tile, idx) => {
      setTimeout(() => { tile.classList.remove('is-visible'); tile.classList.add('is-exiting'); }, idx * 20);
    });
    setTimeout(resolve, existing.length * 20 + 280);
  });
}

function renderMosaicTiles(images) {
  mosaicGrid.innerHTML = '';
  const spans = assignBentoSpans(images.length);
  tileCounter.textContent = `• ${images.length} tiles`;

  images.forEach((imgData, index) => {
    const tile = document.createElement('div');
    tile.className = `tile is-loading ${spans[index] || ''}`.trim();
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = imgData.alt;
    img.src = imgData.smallUrl;

    img.addEventListener('load', () => { tile.classList.remove('is-loading'); tile.classList.add('is-loaded'); });
    img.addEventListener('error', () => {
      if (imgData.fallbackUrl && img.src !== imgData.fallbackUrl) img.src = imgData.fallbackUrl;
      else { tile.classList.remove('is-loading'); tile.classList.add('is-loaded'); }
    });

    const caption = document.createElement('div');
    caption.className = 'tile-caption';
    // textContent (not innerHTML) so alt text coming from an API can never inject HTML.
    const captionText = document.createElement('span');
    captionText.textContent = imgData.alt;
    const captionIcon = document.createElement('span');
    captionIcon.textContent = '⤢';
    caption.append(captionText, captionIcon);

    tile.appendChild(img);
    tile.appendChild(caption);

    tile.addEventListener('click', () => openLightbox(imgData));
    tile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(imgData); } });

    mosaicGrid.appendChild(tile);
    setTimeout(() => { requestAnimationFrame(() => tile.classList.add('is-visible')); }, index * STAGGER_DELAY_MS);
  });
}

async function executeSearch(rawQuery, forceRefresh = false) {
  const query = (rawQuery || DEFAULT_THEME).trim();
  if (!forceRefresh && query.toLowerCase() === currentQuery.toLowerCase()) return;

  if (activeSearchController) activeSearchController.abort();
  activeSearchController = new AbortController();

  const targetTileCount = getRandomInt(MIN_TILES, MAX_TILES);
  searchPill.classList.add('is-fetching');
  syncActiveChip(query);

  try {
    const images = await fetchImagesForQuery(query, targetTileCount, activeSearchController.signal);
    if (!images || images.length === 0) {
      showStatusMessage(`No tiles found for "${query}". Keeping current view!`, 'error');
      searchPill.classList.remove('is-fetching');
      return;
    }
    currentQuery = query;
    await animateOldTilesOut();
    renderMosaicTiles(images);
  } catch (err) {
    if (err.name === 'AbortError') return;
    showStatusMessage('Could not reach image service. Keeping previous mosaic.', 'error');
  } finally {
    searchPill.classList.remove('is-fetching');
  }
}

function openLightbox(imgData) {
  lightboxImg.src = imgData.fullUrl || imgData.smallUrl;
  lightboxImg.alt = imgData.alt;
  lightboxAuthor.textContent = `${imgData.alt} • Photo by ${imgData.author}`;
  lightboxLink.href = imgData.link || 'https://unsplash.com';
  lightbox.classList.add('is-open');
}

function closeLightbox() {
  lightbox.classList.remove('is-open');
  setTimeout(() => { if (!lightbox.classList.contains('is-open')) lightboxImg.src = ''; }, 300);
}

// Parallax
let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
window.addEventListener('mousemove', (e) => {
  if (prefersReducedMotion) return;
  const normX = (e.clientX / window.innerWidth) - 0.5;
  const normY = (e.clientY / window.innerHeight) - 0.5;
  targetX = -normX * 36;
  targetY = -normY * 36;
}, { passive: true });

function updateParallaxLoop() {
  currentX += (targetX - currentX) * 0.08;
  currentY += (targetY - currentY) * 0.08;
  mosaicGrid.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
  requestAnimationFrame(updateParallaxLoop);
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
  const val = e.target.value;
  clearBtn.classList.toggle('is-visible', val.length > 0);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { executeSearch(val.trim() || DEFAULT_THEME); }, DEBOUNCE_DELAY_MS);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (debounceTimer) clearTimeout(debounceTimer);
    executeSearch(searchInput.value.trim() || DEFAULT_THEME, true);
  } else if (e.key === 'Escape') {
    searchInput.blur();
  }
});

clearBtn.addEventListener('click', () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  searchInput.value = '';
  clearBtn.classList.remove('is-visible');
  searchInput.focus();
  executeSearch(DEFAULT_THEME, true);
});

chipsRow.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const topic = chip.dataset.query;
  if (debounceTimer) clearTimeout(debounceTimer);
  searchInput.value = topic;
  clearBtn.classList.add('is-visible');
  executeSearch(topic, true);
});

// API Modal Handlers
openApiModalBtn.addEventListener('click', () => {
  providerSelect.value = apiProvider;
  apiKeyInput.value = apiKey;
  apiModal.classList.add('is-open');
});

closeApiModalBtn.addEventListener('click', () => apiModal.classList.remove('is-open'));
apiModal.addEventListener('click', (e) => { if (e.target === apiModal) apiModal.classList.remove('is-open'); });

saveApiBtn.addEventListener('click', () => {
  apiProvider = providerSelect.value;
  apiKey = apiKeyInput.value.trim();
  storageSet('tts_provider', apiProvider);
  storageSet('tts_key', apiKey);
  updateApiStatusIndicator();
  apiModal.classList.remove('is-open');
  showStatusMessage(apiKey ? 'API Key connected successfully!' : 'API Key removed. Using default fallbacks.', 'info', 3000);
  executeSearch(searchInput.value || DEFAULT_THEME, true);
});

clearApiBtn.addEventListener('click', () => {
  apiKey = '';
  apiKeyInput.value = '';
  storageRemove('tts_key');
  updateApiStatusIndicator();
  apiModal.classList.remove('is-open');
  showStatusMessage('API Key disconnected. Using built-in curated collections.', 'info', 3000);
  executeSearch(searchInput.value || DEFAULT_THEME, true);
});

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (lightbox.classList.contains('is-open')) { closeLightbox(); return; }
    if (apiModal.classList.contains('is-open')) { apiModal.classList.remove('is-open'); return; }
  }
  // Don't hijack "/" while typing in any field (e.g. an API key) or while a dialog is open.
  const typingInField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (e.key === '/' && !typingInField && !lightbox.classList.contains('is-open') && !apiModal.classList.contains('is-open')) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  providerSelect.value = apiProvider; // keep the "API Connected (Pexels)" label correct after a reload
  updateApiStatusIndicator();
  requestAnimationFrame(updateParallaxLoop);
  executeSearch(DEFAULT_THEME, true);
});
