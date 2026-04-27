const statusEl = document.getElementById('status')
const btn = document.getElementById('analyzeBtn')
const apiInput = document.getElementById('apiUrl')

function setStatus(msg, type = '') {
  statusEl.textContent = msg
  statusEl.className = type
}

async function scrapeCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.url?.includes('instagram.com')) {
    setStatus('Debes estar en Instagram', 'error')
    return null
  }

  try {
    // Try sending message first (content.js may already be loaded)
    return await chrome.tabs.sendMessage(tab.id, { action: 'scrape' })
  } catch (err) {
    // content.js not loaded — inject it programmatically and retry
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    })
    await new Promise(r => setTimeout(r, 500))
    return await chrome.tabs.sendMessage(tab.id, { action: 'scrape' })
  }
}

// Load saved API URL
chrome.storage.local.get(['apiUrl']).then(data => {
  if (data.apiUrl) apiInput.value = data.apiUrl
})

// Check if on Instagram
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  const isInstagram = tab?.url?.includes('instagram.com')

  document.getElementById('not-instagram').style.display =
    isInstagram ? 'none' : 'block'
  document.getElementById('instagram-detected').style.display =
    isInstagram ? 'block' : 'none'

  if (isInstagram) {
    const username = tab.url.match(/instagram\.com\/([^/?]+)/)?.[1]
    document.getElementById('detected-user').textContent =
      `📍 @${username}`
  }
})

btn.addEventListener('click', async () => {
  const apiUrl = apiInput.value.trim().replace(/\/$/, '')

  if (!apiUrl) {
    setStatus('Ingresa la URL de SocialDrop', 'error')
    return
  }

  // Save API URL
  await chrome.storage.local.set({ apiUrl })

  btn.disabled = true
  setStatus('Capturando datos...', '')

  try {
    // Get scraped data from content script (with injection fallback)
    const data = await scrapeCurrentTab()
    if (!data) {
      btn.disabled = false
      return
    }

    setStatus(`Enviando ${data.posts.length} posts...`, '')

    // Send to SocialDrop API
    const res = await fetch(`${apiUrl}/api/competitors/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'demo-user',
        platform: 'INSTAGRAM',
        profile: data.profile,
        posts: data.posts
      })
    })

    if (!res.ok) throw new Error(`API error: ${res.status}`)

    const result = await res.json()

    setStatus(
      `✓ ${result.imported || data.posts.length} posts enviados`,
      'success'
    )

    // Open competitors page
    setTimeout(() => {
      chrome.tabs.create({
        url: `${apiUrl}/competitors?username=${data.profile.username}`
      })
    }, 1500)

  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error')
  } finally {
    btn.disabled = false
  }
})
