const statusEl = document.getElementById('status')
const btn = document.getElementById('analyzeBtn')
const apiInput = document.getElementById('apiUrl')

function setStatus(msg, type = '') {
  statusEl.textContent = msg
  statusEl.className = type
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
    const [tab] = await chrome.tabs.query({
      active: true, currentWindow: true
    })

    if (!tab?.url?.includes('instagram.com')) {
      setStatus('Navega a Instagram primero', 'error')
      btn.disabled = false
      return
    }

    // Get scraped data from content script
    const data = await chrome.tabs.sendMessage(tab.id, {
      action: 'scrape'
    })

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
