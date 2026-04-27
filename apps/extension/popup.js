const statusEl = document.getElementById('status')
const btn = document.getElementById('analyzeBtn')
const apiInput = document.getElementById('apiUrl')

function setStatus(msg, type = '') {
  statusEl.textContent = msg
  statusEl.className = type
}

function detectPlatform(url) {
  if (!url) return null
  if (url.includes('instagram.com')) return 'INSTAGRAM'
  if (url.includes('tiktok.com')) return 'TIKTOK'
  return null
}

function adapterFiles(platform) {
  return platform === 'INSTAGRAM'
    ? ['panel.js', 'instagram.js']
    : platform === 'TIKTOK'
    ? ['panel.js', 'tiktok.js']
    : null
}

async function scrapeCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const platform = detectPlatform(tab?.url)

  if (!platform) {
    setStatus('Abre Instagram o TikTok', 'error')
    return null
  }

  try {
    const data = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' })
    return { ...data, platform }
  } catch (err) {
    // Content scripts not loaded — inject and retry
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: adapterFiles(platform),
    })
    await new Promise((r) => setTimeout(r, 500))
    const data = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' })
    return { ...data, platform }
  }
}

// Load saved API URL
chrome.storage.local.get(['apiUrl']).then((data) => {
  if (data.apiUrl) apiInput.value = data.apiUrl
})

// Detect current tab
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  const platform = detectPlatform(tab?.url)
  document.getElementById('not-instagram').style.display = platform ? 'none' : 'block'
  document.getElementById('instagram-detected').style.display = platform ? 'block' : 'none'
  if (platform) {
    const username =
      platform === 'INSTAGRAM'
        ? tab.url.match(/instagram\.com\/([^/?]+)/)?.[1]
        : tab.url.match(/tiktok\.com\/@([^/?]+)/)?.[1]
    const label = platform === 'INSTAGRAM' ? 'IG' : 'TT'
    document.getElementById('detected-user').textContent = `📍 [${label}] @${username || '—'}`
  }
})

btn.addEventListener('click', async () => {
  const apiUrl = apiInput.value.trim().replace(/\/$/, '')

  if (!apiUrl) {
    setStatus('Ingresa la URL de SocialDrop', 'error')
    return
  }

  await chrome.storage.local.set({ apiUrl })
  btn.disabled = true
  setStatus('Capturando datos...', '')

  try {
    const data = await scrapeCurrentTab()
    if (!data) {
      btn.disabled = false
      return
    }

    setStatus(`Enviando ${data.posts.length} posts...`, '')

    const res = await fetch(`${apiUrl}/api/competitors/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'demo-user',
        platform: data.platform,
        profile: data.profile,
        posts: data.posts,
      }),
    })

    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const result = await res.json()

    setStatus(`✓ ${result.imported || data.posts.length} posts enviados`, 'success')

    setTimeout(() => {
      chrome.tabs.create({
        url: `${apiUrl}/competitors?username=${data.profile.username}`,
      })
    }, 1500)
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error')
  } finally {
    btn.disabled = false
  }
})
