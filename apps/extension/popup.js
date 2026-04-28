// ============================================================================
// SocialDrop Analyzer — popup
// All UI lives here. Content script (content.js) only manipulates the page in
// response to messages we send.
// ============================================================================

const API_URL = 'https://app.socialdrop.online'

const detectedEl     = document.getElementById('detected')
const notIgEl        = document.getElementById('not-instagram')
const toolsEl        = document.getElementById('tools')
const statusEl       = document.getElementById('status')
const limitEl        = document.getElementById('limitSelect')
const saveBtn        = document.getElementById('saveBtn')
const saveMetricsBtn = document.getElementById('saveMetricsBtn')
const exportCsvBtn   = document.getElementById('exportCsvBtn')
const reloadBtn      = document.getElementById('reloadBtn')

// Range elements
const minViewsEl       = document.getElementById('viewsRange')
const minLikesEl       = document.getElementById('likesRange')
const minCommentsEl    = document.getElementById('commentsRange')
const minViewsValEl    = document.getElementById('viewsVal')
const minLikesValEl    = document.getElementById('likesVal')
const minCommentsValEl = document.getElementById('commentsVal')
const resetFiltersLink = document.getElementById('resetFiltersLink')

let activeSort    = null
let activeLimit   = 25
let activeTabId   = null

// ---------- Helpers ----------

function setStatus(msg, type = '') {
  statusEl.textContent = msg
  statusEl.className   = type
}

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function disableActions(disabled) {
  saveBtn.disabled        = disabled
  saveMetricsBtn.disabled = disabled
  exportCsvBtn.disabled   = disabled
}

// ---------- Content script bridge ----------

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'detect' })
    return
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    })
    await new Promise((r) => setTimeout(r, 300))
  }
}

async function sendToTab(message) {
  if (activeTabId == null) throw new Error('No active tab')
  await ensureContentScript(activeTabId)
  return chrome.tabs.sendMessage(activeTabId, message)
}

// ---------- Init ----------

;(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  activeTabId = tab?.id ?? null

  const url = tab?.url ?? ''
  if (!url.includes('instagram.com')) {
    detectedEl.textContent = 'No estás en Instagram'
    notIgEl.style.display  = 'block'
    return
  }

  await ensureContentScript(activeTabId)
  let info = null
  try {
    info = await chrome.tabs.sendMessage(activeTabId, { action: 'detect' })
  } catch {
    // ignore
  }

  if (info?.username && info.isProfile) {
    detectedEl.innerHTML = `📍 Perfil detectado: <b>@${info.username}</b>`
    toolsEl.style.display = 'block'
  } else if (info?.username) {
    detectedEl.innerHTML = `Estás en <b>@${info.username}</b> — abre su perfil para ordenar`
    toolsEl.style.display = 'block'
  } else {
    detectedEl.textContent = 'Abre un perfil de Instagram'
    notIgEl.style.display  = 'block'
  }
})()

// ---------- Limit ----------

limitEl.addEventListener('change', (e) => {
  const v   = parseInt(e.target.value, 10)
  activeLimit = isNaN(v) ? 0 : v
})

// ---------- Range sliders ----------

function applyFilters() {
  const minViews    = parseInt(minViewsEl.value,    10) || 0
  const minLikes    = parseInt(minLikesEl.value,    10) || 0
  const minComments = parseInt(minCommentsEl.value, 10) || 0

  if (minViews === 0 && minLikes === 0 && minComments === 0) {
    // Reset all tiles
    sendToTab({ action: 'filter', minViews: 0, minLikes: 0, minComments: 0 }).catch(() => {})
    setStatus('', '')
    return
  }

  setStatus('Filtrando...', '')
  sendToTab({ action: 'filter', minViews, minLikes, minComments })
    .then(res => {
      if (res?.ok) {
        setStatus(`✓ ${res.shown ?? '?'} visibles, ${res.hidden ?? '?'} ocultos`, 'success')
      }
    })
    .catch(() => setStatus('Error al filtrar', 'error'))
}

minViewsEl.addEventListener('input', () => {
  minViewsValEl.textContent = formatNum(parseInt(minViewsEl.value, 10))
  applyFilters()
})

minLikesEl.addEventListener('input', () => {
  minLikesValEl.textContent = formatNum(parseInt(minLikesEl.value, 10))
  applyFilters()
})

minCommentsEl.addEventListener('input', () => {
  minCommentsValEl.textContent = formatNum(parseInt(minCommentsEl.value, 10))
  applyFilters()
})

resetFiltersLink.addEventListener('click', () => {
  minViewsEl.value    = 0
  minLikesEl.value    = 0
  minCommentsEl.value = 0
  minViewsValEl.textContent    = '0'
  minLikesValEl.textContent    = '0'
  minCommentsValEl.textContent = '0'
  applyFilters()
})

// ---------- Sort buttons ----------

document.querySelectorAll('.sort-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const sortBy = btn.dataset.sort

    if (sortBy === 'reset') {
      document.querySelectorAll('.sort-btn').forEach((b) => b.classList.remove('active'))
      activeSort = null
      try {
        await sendToTab({ action: 'reset_sort' })
        setStatus('✓ Orden restablecido', 'success')
      } catch (err) {
        setStatus(`Error: ${err.message}`, 'error')
      }
      return
    }

    document.querySelectorAll('.sort-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    activeSort = sortBy

    setStatus('⏳ Cargando posts...', '')
    try {
      const res = await sendToTab({ action: 'sort', sortBy, limit: activeLimit })
      if (res?.ok) {
        setStatus(`✓ ${res.ordered ?? 0} posts ordenados`, 'success')
      } else {
        setStatus(`Error: ${res?.error ?? 'sin respuesta'}`, 'error')
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`, 'error')
    }
  })
})

// ---------- Reload ----------

reloadBtn.addEventListener('click', () => {
  if (activeTabId != null) chrome.tabs.reload(activeTabId)
})

// ---------- Shared scrape helper ----------

async function scrapeData() {
  const data = await sendToTab({ action: 'scrape_for_socialdrop' })
  if (!data?.ok) throw new Error(data?.error ?? 'no data')
  if (!data.posts?.length) throw new Error('no_posts')
  return data
}

async function postToApi(endpoint, body) {
  let res
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
  } catch (netErr) {
    throw new Error(`Sin conexión con el servidor (${API_URL}). Verifica que la app esté activa.`)
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${errText.slice(0, 120)}`)
  }
  return res.json()
}

// ---------- Guardar en SocialDrop (no metrics) ----------

saveBtn.addEventListener('click', async () => {
  disableActions(true)
  setStatus('Capturando posts...', '')
  try {
    const data = await scrapeData()

    setStatus(`Enviando ${data.posts.length} posts a SocialDrop...`, '')
    const result = await postToApi('/api/competitors/ingest', {
      userId:   'demo-user',
      platform: 'INSTAGRAM',
      profile:  data.profile,
      posts:    data.posts.map(({ postId, url, thumbnail, isReel, caption }) => ({
        postId, url, thumbnail, isReel, caption,
      })),
    })

    setStatus(
      `✓ Guardado (${result.imported ?? data.posts.length} posts) — abriendo análisis...`,
      'success',
    )
    setTimeout(() => {
      chrome.tabs.create({
        url: `${API_URL}/competitors?username=${encodeURIComponent(data.profile.username || '')}`,
      })
    }, 1500)
  } catch (err) {
    if (err.message === 'no_posts') {
      setStatus('No se detectaron posts en este perfil', 'warn')
    } else {
      setStatus(`Error: ${err.message}`, 'error')
    }
  } finally {
    disableActions(false)
  }
})

// ---------- Guardar con métricas ----------

saveMetricsBtn.addEventListener('click', async () => {
  disableActions(true)
  setStatus('Capturando posts con métricas...', '')
  try {
    const data = await scrapeData()

    setStatus(`Enviando ${data.posts.length} posts con métricas...`, '')
    const result = await postToApi('/api/competitors/ingest', {
      userId:   'demo-user',
      platform: 'INSTAGRAM',
      profile:  data.profile,
      posts:    data.posts, // full payload: likes, views, comments, etc.
    })

    setStatus(
      `✓ Sincronizado con métricas (${result.imported ?? data.posts.length} posts) — abriendo...`,
      'success',
    )
    setTimeout(() => {
      chrome.tabs.create({
        url: `${API_URL}/competitors?username=${encodeURIComponent(data.profile.username || '')}`,
      })
    }, 1500)
  } catch (err) {
    if (err.message === 'no_posts') {
      setStatus('No se detectaron posts en este perfil', 'warn')
    } else {
      setStatus(`Error: ${err.message}`, 'error')
    }
  } finally {
    disableActions(false)
  }
})

// ---------- Exportar CSV ----------

exportCsvBtn.addEventListener('click', async () => {
  disableActions(true)
  setStatus('Generando CSV...', '')
  try {
    const data = await scrapeData()

    const username = data.profile?.username ?? 'perfil'
    const date     = new Date().toISOString().slice(0, 10)
    const filename = `@${username}_${date}.csv`

    const headers = ['postId', 'url', 'thumbnail', 'likes', 'views', 'comments', 'isReel']
    const rows    = data.posts.map((p) => [
      p.postId,
      p.url,
      p.thumbnail ?? '',
      p.likes    ?? 0,
      p.views    ?? 0,
      p.comments ?? 0,
      p.isReel   ? 'true' : 'false',
    ])

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    await chrome.downloads.download({ url, filename, saveAs: false })
    URL.revokeObjectURL(url)

    setStatus(`✓ CSV exportado: ${filename}`, 'success')
  } catch (err) {
    if (err.message === 'no_posts') {
      setStatus('No se detectaron posts en este perfil', 'warn')
    } else {
      setStatus(`Error: ${err.message}`, 'error')
    }
  } finally {
    disableActions(false)
  }
})
