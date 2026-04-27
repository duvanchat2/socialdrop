// ============================================================================
// SocialDrop Analyzer — TikTok adapter
// Depends on panel.js (must be listed first in manifest content_scripts).
// ============================================================================

(function () {
  if (!window.SDPanel) {
    console.warn('[SocialDrop] panel.js not loaded')
    return
  }

  function parseCount(text) {
    if (!text) return 0
    text = String(text).replace(/,/g, '').replace(/\s/g, '').trim()
    if (/m$/i.test(text)) return parseFloat(text) * 1_000_000
    if (/k$/i.test(text)) return parseFloat(text) * 1_000
    return parseInt(text, 10) || 0
  }

  /**
   * TikTok profile pages: /@username  (single segment starting with @).
   * Skip /video/, /tag/, /music/, /search, /foryou, /following, /live, etc.
   */
  function isProfilePage() {
    const parts = location.pathname.split('/').filter(Boolean)
    if (parts.length < 1) return false
    return parts[0].startsWith('@') && parts.length === 1
  }

  function scrapeProfile() {
    const usernameRaw = location.pathname.split('/').filter(Boolean)[0] ?? ''
    const username = usernameRaw.replace(/^@/, '').split('?')[0]
    return {
      username,
      displayName:
        document.querySelector('[data-e2e="user-title"]')?.textContent?.trim() ??
        document.querySelector('[data-e2e="user-subtitle"]')?.textContent?.trim() ??
        null,
      bio: document.querySelector('[data-e2e="user-bio"]')?.textContent?.trim() ?? null,
      followers: parseCount(
        document.querySelector('[data-e2e="followers-count"]')?.textContent,
      ),
      following: parseCount(
        document.querySelector('[data-e2e="following-count"]')?.textContent,
      ),
      totalLikes: parseCount(
        document.querySelector('[data-e2e="likes-count"]')?.textContent,
      ),
      url: location.href,
    }
  }

  function scrapePosts() {
    const posts = []
    const seen = new Set()
    document.querySelectorAll('a[href*="/video/"]').forEach((el) => {
      const m = el.href.match(/\/video\/(\d+)/)
      if (!m) return
      const postId = m[1]
      if (seen.has(postId)) return
      seen.add(postId)
      // TikTok exposes view count directly under each tile
      const viewsEl = el.querySelector('[data-e2e="video-views"], strong[data-e2e="video-views"]')
      const views = parseCount(viewsEl?.textContent)
      posts.push({
        postId,
        url: el.href.split('?')[0],
        thumbnail: el.querySelector('img')?.src ?? null,
        isVideo: true,
        isReel: false,
        views: views || null,
      })
    })
    return posts
  }

  // TikTok's user-detail endpoint requires signed parameters; skip metrics fetch
  // for now — views from grid DOM are good enough.
  window.SDPanel.init({
    platform: 'TIKTOK',
    isProfilePage,
    scrapeProfile,
    scrapePosts,
    // fetchMetrics: undefined — button hidden
  })
})()
