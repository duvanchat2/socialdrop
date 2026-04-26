/**
 * SocialDrop Competitor Analyzer — Popup Script
 */

const DEFAULT_API = 'https://app.socialdrop.online';

const $ = (id) => document.getElementById(id);

function setStatus(msg, type = 'loading') {
  const el = $('status');
  el.textContent = msg;
  el.className = `status ${type}`;
}

function setProgress(pct) {
  $('progress-bar').style.width = `${pct}%`;
}

async function getApiUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get('apiUrl', (result) => {
      resolve(result.apiUrl || DEFAULT_API);
    });
  });
}

async function saveApiUrl(url) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ apiUrl: url }, resolve);
  });
}

async function init() {
  // Load stored API URL
  const saved = await getApiUrl();
  $('api-url').value = saved;

  // Detect current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';

  const isInstagram = url.includes('instagram.com');

  if (!isInstagram) {
    $('not-instagram').style.display = 'block';
    $('main-content').style.display = 'none';
    return;
  }

  // Detect username
  const match = url.match(/instagram\.com\/([^/?#]+)/);
  const username = match?.[1];
  if (username && !['p', 'reel', 'stories', 'explore', 'accounts'].includes(username)) {
    $('profile-badge').innerHTML = `Perfil detectado: <b>@${username}</b>`;
  } else {
    $('profile-badge').textContent = 'Navega a un perfil de Instagram';
  }

  // Analyze button
  $('analyze-btn').addEventListener('click', async () => {
    const apiUrl = $('api-url').value.trim().replace(/\/$/, '');
    if (!apiUrl) { setStatus('Ingresa la URL de tu SocialDrop', 'error'); return; }

    await saveApiUrl(apiUrl);
    $('analyze-btn').disabled = true;
    setProgress(10);
    setStatus('Capturando datos del perfil…', 'loading');

    try {
      // Ask content script to scrape
      setProgress(20);
      let scraped;
      try {
        scraped = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });
      } catch {
        throw new Error('No se pudo comunicar con la página. Recarga Instagram e intenta de nuevo.');
      }

      if (!scraped?.ok) throw new Error(scraped?.error ?? 'Error al capturar datos');

      const { profile, posts } = scraped;

      if (!profile?.username) throw new Error('No se detectó ningún perfil. Navega a un perfil de Instagram.');

      setProgress(50);
      setStatus(`Enviando ${posts.length} posts a SocialDrop…`, 'loading');

      // Send to API
      const res = await fetch(`${apiUrl}/api/competitors/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo-user',
          platform: 'INSTAGRAM',
          profile,
          posts,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API error ${res.status}: ${txt.slice(0, 100)}`);
      }

      const result = await res.json();
      setProgress(100);
      setStatus(`✓ ${result.imported} posts enviados a SocialDrop`, 'success');

      // Open competitors page after 1s
      setTimeout(() => {
        chrome.tabs.create({
          url: `${apiUrl}/competitors?username=${profile.username}`,
        });
      }, 1000);

    } catch (err) {
      setProgress(0);
      setStatus(`✗ ${err.message}`, 'error');
      $('analyze-btn').disabled = false;
    }
  });
}

init();
