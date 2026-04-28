// ============================================================================
// SocialDrop Analyzer — popup
// All UI lives here. Content script (content.js) only manipulates the page in
// response to messages we send.
// ============================================================================

const API_URL = 'https://app.socialdrop.online'

const detectedEl = document.getElementById('detected')
const notIgEl = document.getElementById('not-instagram')
const toolsEl = document.getElementById('tools')
const statusEl = document.getElementById('status')
const limitEl = document.getElementById('limitSelect')
const syncBtn = document.getElementById('syncBtn')

let activeSort = null
let activeLimit = 25
let activeTabId = null

function setStatus(msg, type = '') {
  statusEl.textContent = msg
  statusEl.className = type
}

async function ensureContentScript(tabId) {
  // Try a quick ping; if it fails, inject content.js.
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
    notIgEl.style.display = 'block'
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
    notIgEl.style.display = 'block'
  }
})()

// ---------- Limit ----------

limitEl.addEventListener('change', (e) => {
  const v = parseInt(e.target.value, 10)
  activeLimit = isNaN(v) ? 0 : v
})

// ---------- Sort buttons ----------

document.querySelectorAll('.sort-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const sortBy = btn.dataset.sort

    if (sortBy === 'reset') {
      document
        .querySelectorAll('.sort-btn')
        .forEach((b) => b.classList.remove('active'))
      activeSort = null
      try {
        await sendToTab({ action: 'reset_sort' })
        setStatus('✓ Orden restablecido', 'success')
      } catch (err) {
        setStatus(`Error: ${err.message}`, 'error')
      }
      return
    }

    document
      .querySelectorAll('.sort-btn')
      .forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    activeSort = sortBy

    setStatus('Ordenando...', '')
    try {
      const res = await sendToTab({
        action: 'sort',
        sortBy,
        limit: activeLimit,
      })
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

// ---------- Sync to SocialDrop ----------

syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true
  setStatus('Capturando datos...', '')
  try {
    const data = await sendToTab({ action: 'scrape_for_socialdrop' })
    if (!data?.ok) throw new Error(data?.error ?? 'no data')

    setStatus(`Enviando ${data.posts.length} posts...`, '')
    const res = await fetch(`${API_URL}/api/competitors/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'demo-user',
        platform: 'INSTAGRAM',
        profile: data.profile,
        posts: data.posts,
      }),
    })

    if (!res.ok) throw new Error(`API ${res.status}`)
    const result = await res.json()
    setStatus(`✓ ${result.imported ?? data.posts.length} posts enviados`, 'success')

    setTimeout(() => {
      chrome.tabs.create({ url: `${API_URL}/competitors` })
    }, 1500)
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error')
  } finally {
    syncBtn.disabled = false
  }
})
