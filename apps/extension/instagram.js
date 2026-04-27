// ============================================================================
// SocialDrop Analyzer — Instagram adapter
// Depends on panel.js (must be listed first in manifest content_scripts).
// ============================================================================

(function () {
  if (!window.SDPanel) {
    console.warn('[SocialDrop] panel.js not loaded')
    return
  }

  const IG_APP_ID = '936619743392459'
  const metricsCache = new Map() // postId → metrics

  function parseCount(text) {
    if (!text) return 0
    text = String(text).replace(/,/g, '').trim()
    if (text.includes('M')) return parseFloat(text) * 1_000_000
    if (text.includes('K')) return parseFloat(text) * 1_000
    return parseInt(text, 10) || 0
  }

  function pageType() {
    const path = location.pathname.replace(/\/+$/, '')
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 2 && (parts[0] === 'p' || parts[0] === 'reel')) return 'post'
    if (parts.length === 1) {
      const reserved = new Set([
        'p', 'reel', 'reels', 'explore', 'direct', 'accounts',
        'stories', 'about', 'developer', 'legal', 'press',
        'web', 'sessions', 'challenge', 'emails',
      ])
      if (!reserved.has(parts[0])) return 'profile'
    }
    return null
  }

  function getCurrentMediaInfo() {
    const ogVideo =
      document.querySelector('meta[property="og:video"]')?.content ||
      document.querySelector('meta[property="og:video:secure_url"]')?.content ||
      null
    const m = location.pathname.match(/\/(p|reel)\/([^/?]+)/)
    return {
      videoUrl: ogVideo,
      postId: m?.[2] ?? null,
      isReel: m?.[1] === 'reel',
    }
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
      const merged = metricsCache.get(postId)
      posts.push({
        postId,
        url: el.href,
        thumbnail: el.querySelector('img')?.src,
        isReel: el.href.includes('/reel/'),
        ...(merged ?? {}),
      })
    })
    return posts
  }

  async function fetchMetrics(username) {
    const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
    const res = await fetch(url, {
      headers: {
        'x-ig-app-id': IG_APP_ID,
        'x-asbd-id': '198387',
        'x-requested-with': 'XMLHttpRequest',
      },
      credentials: 'include',
    })
    if (!res.ok) throw new Error(`web_profile_info ${res.status}`)
    const json = await res.json()
    const user = json?.data?.user
    if (!user) throw new Error('Respuesta sin user (¿no logueado?)')

    const edges = user.edge_owner_to_timeline_media?.edges ?? []
    const items = edges.map((e) => {
      const n = e.node ?? {}
      return {
        postId: n.shortcode,
        likes: n.edge_liked_by?.count ?? n.edge_media_preview_like?.count ?? null,
        comments: n.edge_media_to_comment?.count ?? null,
        views: n.video_view_count ?? n.video_play_count ?? null,
        caption: n.edge_media_to_caption?.edges?.[0]?.node?.text ?? '',
        takenAt: n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000).toISOString() : null,
        isVideo: !!n.is_video,
        thumbnail: n.thumbnail_src ?? n.display_url ?? null,
      }
    })
    for (const it of items) if (it.postId) metricsCache.set(it.postId, it)
    return { items }
  }

  window.SDPanel.init({
    platform: 'INSTAGRAM',
    pageType,
    scrapeProfile,
    scrapePosts,
    fetchMetrics,
    getCurrentMediaInfo,
  })
})()
