// ============================================================================
// SocialDrop Analyzer — shared panel UI
// Loaded BEFORE platform-specific adapters (instagram.js, tiktok.js).
// Adapter must call window.SDPanel.init({ platform, scrapeProfile, scrapePosts,
//   fetchMetrics?, isProfilePage }).
// ============================================================================

(function () {
  if (window.SDPanel) return // already loaded

  const PANEL_ID = 'sd-panel'
  const STYLE_ID = 'sd-panel-style'

  // ---------- CSS ----------
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
      #${PANEL_ID}.sd-collapsed { transform: translateX(calc(100% - 44px)); }
      #${PANEL_ID} .sd-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: linear-gradient(135deg, #a855f7, #6366f1);
        cursor: pointer;
        user-select: none;
      }
      #${PANEL_ID} .sd-title { font-weight: 700; font-size: 13px; color: white; }
      #${PANEL_ID} .sd-toggle {
        background: rgba(255,255,255,0.2); border: none; color: white;
        width: 22px; height: 22px; border-radius: 4px; cursor: pointer;
        font-size: 12px; line-height: 1;
      }
      #${PANEL_ID} .sd-body { padding: 12px; }
      #${PANEL_ID} .sd-info { font-size: 11px; color: #94a3b8; margin-bottom: 10px; line-height: 1.4; }
      #${PANEL_ID} .sd-info b { color: #f1f5f9; }
      #${PANEL_ID} .sd-platform-badge {
        display: inline-block; padding: 2px 6px; border-radius: 4px;
        font-size: 10px; font-weight: 700; margin-left: 4px;
      }
      #${PANEL_ID} .sd-platform-IG { background: linear-gradient(135deg, #f58529, #dd2a7b, #8134af); color: white; }
      #${PANEL_ID} .sd-platform-TT { background: #000; color: #fff; border: 1px solid #25f4ee; }
      #${PANEL_ID} .sd-counter {
        background: #1e293b; border: 1px solid #334155; border-radius: 6px;
        padding: 6px 8px; margin-bottom: 10px; font-size: 11px; color: #cbd5e1;
        display: flex; justify-content: space-between;
      }
      #${PANEL_ID} .sd-counter b { color: #4ade80; }
      #${PANEL_ID} button.sd-btn {
        display: block; width: 100%; padding: 8px 10px; margin-bottom: 6px;
        border: none; border-radius: 6px; cursor: pointer;
        font-size: 12px; font-weight: 600; text-align: left;
      }
      #${PANEL_ID} button.sd-btn-primary { background: #a855f7; color: white; }
      #${PANEL_ID} button.sd-btn-primary:hover { background: #9333ea; }
      #${PANEL_ID} button.sd-btn-secondary {
        background: #1e293b; color: #cbd5e1; border: 1px solid #334155;
      }
      #${PANEL_ID} button.sd-btn-secondary:hover { background: #334155; }
      #${PANEL_ID} button.sd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      #${PANEL_ID} .sd-status {
        margin-top: 8px; font-size: 11px; text-align: center;
        min-height: 16px; color: #94a3b8;
      }
      #${PANEL_ID} .sd-status.success { color: #4ade80; }
      #${PANEL_ID} .sd-status.error   { color: #f87171; }
      #${PANEL_ID} .sd-status.warn    { color: #fbbf24; }
    `
    document.head.appendChild(style)
  }

  // ---------- CSV ----------
  function csvEscape(value) {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }

  function buildCSV(platform, profile, posts) {
    const headers = [
      'platform', 'username', 'postId', 'type', 'url', 'thumbnail',
      'likes', 'comments', 'views', 'taken_at', 'caption', 'scraped_at',
    ]
    const now = new Date().toISOString()
    const rows = posts.map((p) =>
      [
        platform,
        profile.username,
        p.postId,
        p.isReel ? 'reel' : (p.isVideo ? 'video' : 'post'),
        p.url,
        p.thumbnail ?? '',
        p.likes ?? '',
        p.comments ?? '',
        p.views ?? '',
        p.takenAt ?? '',
        p.caption ?? '',
        now,
      ].map(csvEscape).join(','),
    )
    return [headers.join(','), ...rows].join('\r\n')
  }

  function downloadCSV(platform, profile, posts) {
    const csv = buildCSV(platform, profile, posts)
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const a = document.createElement('a')
    a.href = url
    a.download = `socialdrop_${platform.toLowerCase()}_${profile.username || 'export'}_${ts}.csv`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 100)
  }

  // ---------- Auto-scroll ----------
  const SCROLL_MAX_POSTS = 300
  const SCROLL_NO_GROWTH_LIMIT = 4
  const SCROLL_MIN_DELAY = 800
  const SCROLL_MAX_DELAY = 1500

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

  async function autoScroll(adapter, abortRef, onProgress) {
    let lastCount = adapter.scrapePosts().length
    let stagnant = 0
    while (!abortRef.aborted) {
      window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'instant' })
      const delay = SCROLL_MIN_DELAY + Math.random() * (SCROLL_MAX_DELAY - SCROLL_MIN_DELAY)
      await sleep(delay)
      const count = adapter.scrapePosts().length
      onProgress?.(count)
      if (count >= SCROLL_MAX_POSTS) break
      if (count === lastCount) {
        stagnant++
        window.scrollBy({ top: window.innerHeight * 1.5, behavior: 'instant' })
        await sleep(delay)
        const recount = adapter.scrapePosts().length
        if (recount > count) { stagnant = 0; lastCount = recount; onProgress?.(recount); continue }
        if (stagnant >= SCROLL_NO_GROWTH_LIMIT) break
      } else { stagnant = 0; lastCount = count }
    }
    return adapter.scrapePosts().length
  }

  // ---------- Panel ----------
  function buildPanel(adapter) {
    const pageType = adapter.pageType()
    const wrapper = document.createElement('div')
    wrapper.id = PANEL_ID
    const platformLabel = adapter.platform === 'INSTAGRAM' ? 'IG' : 'TT'
    if (pageType === 'post') {
      wrapper.innerHTML = `
        <div class="sd-header" data-sd-toggle>
          <span class="sd-title">🔮 SocialDrop
            <span class="sd-platform-badge sd-platform-${platformLabel}">${platformLabel}</span>
          </span>
          <button class="sd-toggle" data-sd-toggle>−</button>
        </div>
        <div class="sd-body">
          <div class="sd-info">Modo: <b>Post / Reel</b></div>
          ${adapter.getCurrentMediaInfo ? '<button class="sd-btn sd-btn-primary" data-sd-action="transcribe">🎙 Transcribir este video</button>' : '<div class="sd-info">Esta plataforma no soporta transcripción aún.</div>'}
          <div class="sd-status" data-sd-status></div>
          <div class="sd-transcript" data-sd-transcript style="display:none; margin-top:10px; max-height:200px; overflow-y:auto; padding:8px; background:#1e293b; border:1px solid #334155; border-radius:6px; font-size:11px; color:#cbd5e1; white-space:pre-wrap;"></div>
        </div>
      `
    } else {
      const profile = adapter.scrapeProfile()
      const posts = adapter.scrapePosts()
      wrapper.innerHTML = `
        <div class="sd-header" data-sd-toggle>
          <span class="sd-title">🔮 SocialDrop
            <span class="sd-platform-badge sd-platform-${platformLabel}">${platformLabel}</span>
          </span>
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
          <button class="sd-btn sd-btn-secondary" data-sd-action="scroll">⬇ Auto-scroll</button>
          ${adapter.fetchMetrics ? '<button class="sd-btn sd-btn-secondary" data-sd-action="metrics">📈 Cargar métricas</button>' : ''}
          <button class="sd-btn sd-btn-secondary" data-sd-action="csv">📊 Exportar CSV</button>
          <button class="sd-btn sd-btn-primary" data-sd-action="sync">✨ Sincronizar con SocialDrop</button>
          <div class="sd-status" data-sd-status></div>
        </div>
      `
    }

    const statusEl = wrapper.querySelector('[data-sd-status]')
    const counterEl = wrapper.querySelector('[data-sd-counter]')
    const setStatus = (msg, cls = '') => {
      statusEl.textContent = msg
      statusEl.className = `sd-status ${cls}`
    }

    // Toggle
    wrapper.querySelectorAll('[data-sd-toggle]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        wrapper.classList.toggle('sd-collapsed')
        const btn = wrapper.querySelector('.sd-toggle')
        if (btn) btn.textContent = wrapper.classList.contains('sd-collapsed') ? '+' : '−'
      })
    })

    // Transcribe (post page only)
    const transcribeBtn = wrapper.querySelector('[data-sd-action="transcribe"]')
    if (transcribeBtn && adapter.getCurrentMediaInfo) {
      const transcriptEl = wrapper.querySelector('[data-sd-transcript]')
      transcribeBtn.addEventListener('click', async () => {
        transcribeBtn.disabled = true
        transcriptEl.style.display = 'none'
        setStatus('Buscando URL del video...', '')
        try {
          const media = adapter.getCurrentMediaInfo()
          if (!media?.videoUrl) throw new Error('No se encontró URL del video')

          const { apiUrl } = await chrome.storage.local.get(['apiUrl'])
          if (!apiUrl) throw new Error('Configura la URL del API en el popup')

          setStatus('Transcribiendo... (puede tardar 30-90s)', '')
          const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/competitors/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl: media.videoUrl }),
          })
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(`API ${res.status} ${text.slice(0, 120)}`)
          }
          const { transcript } = await res.json()
          transcriptEl.textContent = transcript || '(transcripción vacía)'
          transcriptEl.style.display = 'block'
          setStatus(`✓ Transcrito (${transcript.length} chars)`, 'success')
        } catch (err) {
          setStatus(`Error: ${err.message}`, 'error')
        } finally {
          transcribeBtn.disabled = false
        }
      })
    }

    // Auto-scroll
    const scrollAbort = { aborted: false }
    const scrollBtn = wrapper.querySelector('[data-sd-action="scroll"]')
    if (scrollBtn) scrollBtn.addEventListener('click', async () => {
      if (scrollBtn.dataset.running === '1') {
        scrollAbort.aborted = true
        scrollBtn.dataset.running = '0'
        scrollBtn.textContent = '⬇ Auto-scroll'
        setStatus('Detenido', 'warn')
        return
      }
      scrollAbort.aborted = false
      scrollBtn.dataset.running = '1'
      scrollBtn.textContent = '⏹ Detener'
      setStatus('Cargando posts...', '')
      try {
        const total = await autoScroll(adapter, scrollAbort, (n) => {
          if (counterEl) counterEl.textContent = String(n)
          setStatus(`Cargando... ${n} posts`, '')
        })
        setStatus(`✓ ${total} posts cargados`, 'success')
      } catch (err) {
        setStatus(`Error: ${err.message}`, 'error')
      } finally {
        scrollBtn.dataset.running = '0'
        scrollBtn.textContent = '⬇ Auto-scroll'
      }
    })

    // Metrics (optional)
    const metricsBtn = wrapper.querySelector('[data-sd-action="metrics"]')
    if (metricsBtn && adapter.fetchMetrics) {
      metricsBtn.addEventListener('click', async () => {
        metricsBtn.disabled = true
        setStatus('Pidiendo métricas...', '')
        try {
          const profile = adapter.scrapeProfile()
          if (!profile.username) throw new Error('No se detectó username')
          const { items } = await adapter.fetchMetrics(profile.username)
          const matched = adapter.scrapePosts().filter((p) => p.likes != null || p.views != null).length
          setStatus(`✓ Métricas cargadas: ${items.length} (${matched} en grilla)`, 'success')
        } catch (err) {
          setStatus(`Error: ${err.message}`, 'error')
        } finally {
          metricsBtn.disabled = false
        }
      })
    }

    // CSV
    const csvBtn = wrapper.querySelector('[data-sd-action="csv"]')
    if (csvBtn) csvBtn.addEventListener('click', () => {
      try {
        const profile = adapter.scrapeProfile()
        const posts = adapter.scrapePosts()
        if (!posts.length) { setStatus('No hay posts para exportar', 'warn'); return }
        downloadCSV(adapter.platform, profile, posts)
        setStatus(`✓ CSV descargado (${posts.length} posts)`, 'success')
      } catch (err) {
        setStatus(`Error: ${err.message}`, 'error')
      }
    })

    // Sync
    const syncBtn = wrapper.querySelector('[data-sd-action="sync"]')
    if (syncBtn) syncBtn.addEventListener('click', async (e) => {
      const btn = e.currentTarget
      const { apiUrl } = await chrome.storage.local.get(['apiUrl'])
      if (!apiUrl) { setStatus('Configura la URL en el popup ⚙', 'warn'); return }
      btn.disabled = true
      setStatus('Capturando datos...', '')
      try {
        const profile = adapter.scrapeProfile()
        const posts = adapter.scrapePosts()
        setStatus(`Enviando ${posts.length} posts...`, '')
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/competitors/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'demo-user',
            platform: adapter.platform,
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

  function refreshCounter(adapter) {
    const counter = document.querySelector(`#${PANEL_ID} [data-sd-counter]`)
    if (counter) counter.textContent = String(adapter.scrapePosts().length)
  }

  function ensurePanel(adapter) {
    const type = adapter.pageType()
    if (!type) {
      document.getElementById(PANEL_ID)?.remove()
      return
    }
    const existing = document.getElementById(PANEL_ID)
    if (existing) {
      // Rebuild if page type changed (profile ↔ post)
      if (existing.dataset.sdPageType !== type) {
        existing.remove()
      } else {
        refreshCounter(adapter)
        return
      }
    }
    injectStyles()
    const panel = buildPanel(adapter)
    panel.dataset.sdPageType = type
    document.body?.appendChild(panel)
  }

  // ---------- Public API ----------
  window.SDPanel = {
    init(adapter) {
      ensurePanel(adapter)

      // SPA navigation watcher
      let lastUrl = location.href
      const obs = new MutationObserver(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href
          setTimeout(() => ensurePanel(adapter), 600)
        } else {
          refreshCounter(adapter)
        }
      })
      obs.observe(document.body, { childList: true, subtree: true })

      // Popup-driven scrape support
      chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
        if (msg.action === 'scrape') {
          sendResponse({
            profile: adapter.scrapeProfile(),
            posts: adapter.scrapePosts(),
            url: location.href,
          })
        }
        return true
      })
    },
  }
})()
