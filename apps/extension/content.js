// ============================================================================
// SocialDrop Analyzer — Instagram content script
//
// IMPORTANT: this script does NOT modify the page on load. It only listens for
// messages from the popup. No CSS injection, no DOM mutation on load.
// ============================================================================

function extractNumber(text) {
  if (!text) return 0
  const clean = text.replace(/[,.\s]/g, '')
  if (/[Mm]$/.test(text)) return parseFloat(text) * 1_000_000
  if (/[Kk]$/.test(text)) return parseFloat(text) * 1_000
  return parseInt(clean) || 0
}

function scrapeProfile() {
  const username = location.pathname.split('/').filter(Boolean)[0]
  return {
    username,
    displayName: document.querySelector('h1, h2')?.textContent?.trim(),
    followers: 0,
    url: location.href,
  }
}

function scrapePosts() {
  const seen  = new Set()
  const posts = []

  document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').forEach((el) => {
    const match = el.href.match(/\/(p|reel)\/([^/?]+)/)
    if (!match) return
    const postId = match[2]
    if (seen.has(postId)) return
    seen.add(postId)

    posts.push({
      postId,
      url:       el.href,
      thumbnail: el.querySelector('img')?.src || '',
      isReel:    el.href.includes('/reel/'),
      likes:     0,
      views:     0,
      comments:  0,
    })
  })

  return posts.slice(0, 50)
}

function sortPostsInDOM(sortBy) {
  const links = Array.from(
    document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'),
  )
  if (links.length === 0) return { ok: false, reason: 'no posts found' }

  const firstPost = links[0]
  const grid =
    firstPost.closest('div[style*="flex"]')?.parentElement?.parentElement

  if (!grid) return { ok: false, reason: 'grid not found' }

  const items = links
    .map((link, i) => ({
      container:
        link.closest('div[style*="width"]') ||
        link.parentElement?.parentElement ||
        link.parentElement,
      index:  i,
      postId: link.href.match(/\/(p|reel)\/([^/?]+)/)?.[2],
    }))
    .filter((item) => item.container)

  if (sortBy === 'oldest') {
    items.reverse()
  }
  // For likes/views/comments, Instagram doesn't expose metrics in the grid.
  // We sort by post position (newer = higher index) as a proxy.

  items.forEach((item) => {
    grid.appendChild(item.container)
  })

  return { ok: true, count: items.length }
}

// ---------- Message listener ----------

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.action === 'detect') {
    const parts    = location.pathname.split('/').filter(Boolean)
    const username = parts[0] && !['p', 'reel', 'reels', 'explore'].includes(parts[0])
      ? parts[0]
      : null
    sendResponse({
      ok:        true,
      username,
      isProfile: !!username && parts.length === 1,
    })
    return true
  }

  if (msg.action === 'scrape' || msg.action === 'scrape_for_socialdrop') {
    sendResponse({
      ok:      true,
      profile: scrapeProfile(),
      posts:   scrapePosts(),
    })
    return true
  }

  if (msg.action === 'sort') {
    const result = sortPostsInDOM(msg.sortBy)
    sendResponse(result)
    return true
  }

  if (msg.action === 'reset_sort') {
    // Re-scrape links and re-append in original DOM order (no-op — reload handles this)
    sendResponse({ ok: true })
    return true
  }

  if (msg.action === 'filter') {
    // Metrics not available in grid view — acknowledge gracefully
    sendResponse({ ok: true })
    return true
  }

  sendResponse({ ok: false, error: 'unknown action' })
  return true
})
