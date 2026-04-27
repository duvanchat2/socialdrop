// ============================================================================
// SocialDrop Analyzer — Instagram content script
// Injects a floating panel on profile pages with sync/scroll/export actions.
// ============================================================================

const PANEL_ID = 'sd-panel'
const STYLE_ID = 'sd-panel-style'

// ---------- Scrapers ----------

function parseCount(text) {
  if (!text) return 0
  text = String(text).replace(/,/g, '').trim()
  if (text.includes('M')) return parseFloat(text) * 1_000_000
  if (text.includes('K')) return parseFloat(text) * 1_000
  return parseInt(text, 10) || 0
}

function scrapeProfile() {
  const username = location.pathname.replace(/\//g, '').split('?')[0]
  const metaDesc = document.querySelector('meta[name="description"]')
  const allLinks = document.querySelectorAll('a[href*="followers"]')
  return {
    username,
    displayName: document.querySelector('h1, h2')?.textContent?.trim(),
    bio: metaDesc?.content,
    followers: parseCount(allLinks[0]?.textContent),
    following: parseCount(allLinks[1]?.textContent),
    url: location.href,
  }
}

function scrapePosts() {
  const posts = []
  const seen = new Set()
  document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').forEach((el) => {
    const m = el.href.match(/\/(p|reel)\/([^/?]+)/)
    if (!m) return
    const postId = m[2]
    if (seen.has(postId)) return
    seen.add(postId)
    posts.push({
      postId,
      url: el.href,
      thumbnail: el.querySelector('img')?.src,
      isReel: el.href.includes('/reel/'),
    })
  })
  return posts
}

// ---------- Page detection ----------

/**
 * Profile pages have URLs like /username/ — single segment, not /p/, /reel/,
 * /explore/, /direct/, /accounts/, /stories/.
 */
function isProfilePage() {
  const path = location.pathname.replace(/\/+$/, '')
  const parts = path.split('/').filter(Boolean)
  if (parts.length !== 1) return false
  const reserved = new Set([
    'p', 'reel', 'reels', 'explore', 'direct', 'accounts',
    'stories', 'about', 'developer', 'legal', 'press',
    'web', 'sessions', 'challenge', 'emails',
  ])
  return !reserved.has(parts[0])
}

// ---------- Panel ----------

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 280px;
      background: #0f172a;
      color: #f1f5f9;
      border: 1px solid #334155;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      font-size: 13px;
      z-index: 999999;
      overflow: hidden;
      transition: transform 0.2s ease;
    }
    #${PANEL_ID}.sd-collapsed {
      transform: translateX(calc(100% - 44px));
    }
    #${PANEL_ID} .sd-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: linear-gradient(135deg, #a855f7, #6366f1);
      cursor: pointer;
      user-select: none;
    }
    #${PANEL_ID} .sd-title {
      font-weight: 700;
      font-size: 13px;
      color: white;
    }
    #${PANEL_ID} .sd-toggle {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 22px;
      height: 22px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
    }
    #${PANEL_ID} .sd-body {
      padding: 12px;
    }
    #${PANEL_ID} .sd-info {
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 10px;
      line-height: 1.4;
    }
    #${PANEL_ID} .sd-info b { color: #f1f5f9; }
    #${PANEL_ID} .sd-counter {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 6px 8px;
      margin-bottom: 10px;
      font-size: 11px;
      color: #cbd5e1;
      display: flex;
      justify-content: space-between;
    }
    #${PANEL_ID} .sd-counter b { color: #4ade80; }
    #${PANEL_ID} button.sd-btn {
      display: block;
      width: 100%;
      padding: 8px 10px;
      margin-bottom: 6px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
    }
    #${PANEL_ID} button.sd-btn-primary {
      background: #a855f7;
      color: white;
    }
    #${PANEL_ID} button.sd-btn-primary:hover { background: #9333ea; }
    #${PANEL_ID} button.sd-btn-secondary {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
    }
    #${PANEL_ID} button.sd-btn-secondary:hover { background: #334155; }
    #${PANEL_ID} button.sd-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    #${PANEL_ID} .sd-status {
      margin-top: 8px;
      font-size: 11px;
      text-align: center;
      min-height: 16px;
      color: #94a3b8;
    }
    #${PANEL_ID} .sd-status.success { color: #4ade80; }
    #${PANEL_ID} .sd-status.error { color: #f87171; }
    #${PANEL_ID} .sd-status.warn { color: #fbbf24; }
  `
  document.head.appendChild(style)
}

function buildPanel() {
  const profile = scrapeProfile()
  const posts = scrapePosts()

  const wrapper = document.createElement('div')
  wrapper.id = PANEL_ID
  wrapper.innerHTML = `
    <div class="sd-header" data-sd-toggle>
      <span class="sd-title">🔮 SocialDrop</span>
      <button class="sd-toggle" data-sd-toggle>−</button>
    </div>
    <div class="sd-body">
      <div class="sd-info">
        Perfil: <b>@${profile.username || '—'}</b><br>
        Seguidores: <b>${(profile.followers || 0).toLocaleString()}</b>
      </div>
      <div class="sd-counter">
        <span>Posts cargados</span>
        <b data-sd-counter>${posts.length}</b>
      </div>
      <button class="sd-btn sd-btn-secondary" data-sd-action="scroll">
        ⬇ Auto-scroll
      </button>
      <button class="sd-btn sd-btn-secondary" data-sd-action="csv">
        📊 Exportar CSV
      </button>
      <button class="sd-btn sd-btn-primary" data-sd-action="sync">
        ✨ Sincronizar con SocialDrop
      </button>
      <div class="sd-status" data-sd-status></div>
    </div>
  `

  // Toggle collapse
  wrapper.querySelectorAll('[data-sd-toggle]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      wrapper.classList.toggle('sd-collapsed')
      const btn = wrapper.querySelector('.sd-toggle')
      if (btn) btn.textContent = wrapper.classList.contains('sd-collapsed') ? '+' : '−'
    })
  })

  // CSV export action
  wrapper.querySelector('[data-sd-action="csv"]').addEventListener('click', () => {
    const statusEl = wrapper.querySelector('[data-sd-status]')
    const setStatus = (msg, cls = '') => {
      statusEl.textContent = msg
      statusEl.className = `sd-status ${cls}`
    }
    try {
      const profile = scrapeProfile()
      const posts = scrapePosts()
      if (!posts.length) {
        setStatus('No hay posts para exportar', 'warn')
        return
      }
      downloadCSV(profile, posts)
      setStatus(`✓ CSV descargado (${posts.length} posts)`, 'success')
    } catch (err) {
      setStatus(`Error: ${err.message}`, 'error')
    }
  })

  // Auto-scroll action
  wrapper.querySelector('[data-sd-action="scroll"]').addEventListener('click', async (e) => {
    const btn = e.currentTarget
    const statusEl = wrapper.querySelector('[data-sd-status]')
    const counterEl = wrapper.querySelector('[data-sd-counter]')

    const setStatus = (msg, cls = '') => {
      statusEl.textContent = msg
      statusEl.className = `sd-status ${cls}`
    }

    // Toggle stop if already running
    if (btn.dataset.running === '1') {
      scrollAbort = true
      btn.dataset.running = '0'
      btn.textContent = '⬇ Auto-scroll'
      setStatus('Detenido', 'warn')
      return
    }

    btn.dataset.running = '1'
    btn.textContent = '⏹ Detener'
    setStatus('Cargando posts...', '')

    try {
      const total = await autoScroll((n) => {
        if (counterEl) counterEl.textContent = String(n)
        setStatus(`Cargando... ${n} posts`, '')
      })
      setStatus(`✓ ${total} posts cargados`, 'success')
    } catch (err) {
      setStatus(`Error: ${err.message}`, 'error')
    } finally {
      btn.dataset.running = '0'
      btn.textContent = '⬇ Auto-scroll'
    }
  })

  // Sync action
  wrapper.querySelector('[data-sd-action="sync"]').addEventListener('click', async () => {
    const statusEl = wrapper.querySelector('[data-sd-status]')
    const btn = wrapper.querySelector('[data-sd-action="sync"]')

    const setStatus = (msg, cls = '') => {
      statusEl.textContent = msg
      statusEl.className = `sd-status ${cls}`
    }

    // Pull saved API URL
    const { apiUrl } = await chrome.storage.local.get(['apiUrl'])
    if (!apiUrl) {
      setStatus('Configura la URL del API en el popup ⚙', 'warn')
      return
    }

    btn.disabled = true
    setStatus('Capturando datos...', '')

    try {
      const profile = scrapeProfile()
      const posts = scrapePosts()
      setStatus(`Enviando ${posts.length} posts...`, '')

      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/competitors/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo-user',
          platform: 'INSTAGRAM',
          profile,
          posts,
        }),
      })

      if (!res.ok) throw new Error(`API ${res.status}`)
      const result = await res.json()
      setStatus(`✓ ${result.imported ?? posts.length} posts enviados`, 'success')
    } catch (err) {
      setStatus(`Error: ${err.message}`, 'error')
    } finally {
      btn.disabled = false
    }
  })

  return wrapper
}

function refreshCounter() {
  const counter = document.querySelector(`#${PANEL_ID} [data-sd-counter]`)
  if (counter) counter.textContent = String(scrapePosts().length)
}

// ---------- CSV export ----------

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCSV(profile, posts) {
  const headers = [
    'username',
    'postId',
    'type',
    'url',
    'thumbnail',
    'scraped_at',
  ]
  const now = new Date().toISOString()
  const rows = posts.map((p) =>
    [
      profile.username,
      p.postId,
      p.isReel ? 'reel' : 'post',
      p.url,
      p.thumbnail ?? '',
      now,
    ]
      .map(csvEscape)
      .join(','),
  )
  return [headers.join(','), ...rows].join('\r\n')
}

function downloadCSV(profile, posts) {
  const csv = buildCSV(profile, posts)
  // Prepend BOM so Excel detects UTF-8 correctly
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const a = document.createElement('a')
  a.href = url
  a.download = `socialdrop_${profile.username || 'export'}_${ts}.csv`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 100)
}

// ---------- Auto-scroll ----------

const SCROLL_MAX_POSTS = 300
const SCROLL_NO_GROWTH_LIMIT = 4
const SCROLL_MIN_DELAY = 800
const SCROLL_MAX_DELAY = 1500

let scrollAbort = false

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function autoScroll(onProgress) {
  scrollAbort = false
  let lastCount = scrapePosts().length
  let stagnant = 0

  while (!scrollAbort) {
    window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'instant' })
    const delay = SCROLL_MIN_DELAY + Math.random() * (SCROLL_MAX_DELAY - SCROLL_MIN_DELAY)
    await sleep(delay)

    const count = scrapePosts().length
    onProgress?.(count)

    if (count >= SCROLL_MAX_POSTS) break

    if (count === lastCount) {
      stagnant++
      // Try a bigger jump in case lazy loader is sluggish
      window.scrollBy({ top: window.innerHeight * 1.5, behavior: 'instant' })
      await sleep(delay)
      const recount = scrapePosts().length
      if (recount > count) {
        stagnant = 0
        lastCount = recount
        onProgress?.(recount)
        continue
      }
      if (stagnant >= SCROLL_NO_GROWTH_LIMIT) break
    } else {
      stagnant = 0
      lastCount = count
    }
  }

  return scrapePosts().length
}

function ensurePanel() {
  if (!isProfilePage()) {
    document.getElementById(PANEL_ID)?.remove()
    return
  }
  if (document.getElementById(PANEL_ID)) {
    refreshCounter()
    return
  }
  injectStyles()
  document.body?.appendChild(buildPanel())
}

// ---------- SPA navigation watcher ----------
// Instagram is a SPA — re-evaluate on URL changes.

let lastUrl = location.href
const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(ensurePanel, 600)
  } else {
    // Same page, but new posts may have rendered → update counter
    refreshCounter()
  }
})
urlObserver.observe(document.body, { childList: true, subtree: true })

// ---------- Boot ----------

ensurePanel()

// Keep popup-driven scrape working as before
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.action === 'scrape') {
    sendResponse({
      profile: scrapeProfile(),
      posts: scrapePosts(),
      url: location.href,
    })
  }
  return true
})
