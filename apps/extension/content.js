// ============================================================================
// SocialDrop Analyzer — Instagram content script
//
// IMPORTANT: this script does NOT modify the page on load. It only listens for
// messages from the popup. DOM mutations happen ONLY in response to a user
// action (sort or scrape). This avoids breaking Instagram's renderer.
// ============================================================================

const IG_APP_ID = '936619743392459'

// Cache of metrics keyed by shortcode (postId).
// Populated lazily on first sort/scrape call.
const metricsCache = new Map()
let metricsFetched = false
let metricsFetchPromise = null

// ---------- Helpers ----------

function extractNumber(text) {
  if (!text) return 0
  text = String(text).replace(/[,.]/g, '').trim()
  const m = text.match(/([\d.]+)\s*([kKmM]?)/)
  if (!m) return parseInt(text, 10) || 0
  const num = parseFloat(m[1])
  const suf = m[2].toLowerCase()
  if (suf === 'm') return num * 1_000_000
  if (suf === 'k') return num * 1_000
  return Math.round(num)
}

function getUsername() {
  const parts = location.pathname.split('/').filter(Boolean)
  return parts[0] && !['p', 'reel', 'reels', 'explore'].includes(parts[0])
    ? parts[0]
    : null
}

// ---------- Metrics (web_profile_info) ----------

async function fetchProfileMetrics() {
  const username = getUsername()
  if (!username) return
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
  if (!user) throw new Error('No user in response')

  const edges = user.edge_owner_to_timeline_media?.edges ?? []
  for (const e of edges) {
    const n = e.node ?? {}
    if (!n.shortcode) continue
    metricsCache.set(n.shortcode, {
      likes: n.edge_liked_by?.count ?? n.edge_media_preview_like?.count ?? 0,
      comments: n.edge_media_to_comment?.count ?? 0,
      views: n.video_view_count ?? n.video_play_count ?? 0,
      caption: n.edge_media_to_caption?.edges?.[0]?.node?.text ?? '',
      takenAt: n.taken_at_timestamp ?? 0,
      isVideo: !!n.is_video,
      thumbnail: n.thumbnail_src ?? n.display_url ?? null,
    })
  }
  metricsFetched = true
}

function ensureMetrics() {
  if (metricsFetched) return Promise.resolve()
  if (metricsFetchPromise) return metricsFetchPromise
  metricsFetchPromise = fetchProfileMetrics().catch((err) => {
    console.warn('[SocialDrop] metrics fetch failed:', err.message)
  })
  return metricsFetchPromise
}

// ---------- Scrapers ----------

function scrapeProfile() {
  const username = getUsername()
  const metaDesc = document.querySelector('meta[name="description"]')
  const allLinks = document.querySelectorAll('a[href*="followers"]')
  return {
    username,
    displayName: document.querySelector('h1, h2')?.textContent?.trim(),
    bio: metaDesc?.content,
    followers: extractNumber(allLinks[0]?.textContent),
    following: extractNumber(allLinks[1]?.textContent),
    url: location.href,
  }
}

function scrapePosts() {
  const posts = []
  const seen = new Set()
  document
    .querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')
    .forEach((el) => {
      const m = el.href.match(/\/(p|reel)\/([^/?]+)/)
      if (!m) return
      const postId = m[2]
      if (seen.has(postId)) return
      seen.add(postId)
      const merged = metricsCache.get(postId) ?? {}
      posts.push({
        postId,
        url: el.href,
        thumbnail: el.querySelector('img')?.src ?? merged.thumbnail ?? null,
        isReel: el.href.includes('/reel/'),
        likes: merged.likes ?? null,
        comments: merged.comments ?? null,
        views: merged.views ?? null,
        caption: merged.caption ?? '',
        takenAt: merged.takenAt
          ? new Date(merged.takenAt * 1000).toISOString()
          : null,
        isVideo: merged.isVideo ?? false,
      })
    })
  return posts
}

// ---------- Sort ----------

/**
 * Find the post tile element (the grid cell that contains the link).
 * Walks up the DOM until it finds an ancestor that is a direct child of a
 * row-like flex container with siblings.
 */
function findTile(link) {
  let el = link
  while (el && el !== document.body) {
    const parent = el.parentElement
    if (!parent) break
    if (parent.children.length >= 2) {
      const cs = getComputedStyle(parent)
      if (cs.display === 'flex' || cs.display === 'grid') {
        return el
      }
    }
    el = parent
  }
  return link.parentElement
}

async function sortPosts(sortBy, limit) {
  // Try to ensure we have metrics before sorting (best effort).
  await ensureMetrics()

  const links = Array.from(
    document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'),
  )

  const seen = new Set()
  const items = []
  for (const link of links) {
    const m = link.href.match(/\/(p|reel)\/([^/?]+)/)
    if (!m) continue
    const postId = m[2]
    if (seen.has(postId)) continue
    seen.add(postId)
    const tile = findTile(link)
    if (!tile) continue
    const metric = metricsCache.get(postId) ?? {}
    items.push({
      postId,
      tile,
      likes: metric.likes ?? 0,
      comments: metric.comments ?? 0,
      views: metric.views ?? 0,
      takenAt: metric.takenAt ?? 0,
    })
  }

  if (!items.length) return { ordered: 0 }

  let sorted = [...items]
  if (sortBy === 'likes') sorted.sort((a, b) => b.likes - a.likes)
  else if (sortBy === 'views') sorted.sort((a, b) => b.views - a.views)
  else if (sortBy === 'comments') sorted.sort((a, b) => b.comments - a.comments)
  else if (sortBy === 'oldest') sorted.sort((a, b) => a.takenAt - b.takenAt)
  else if (sortBy === 'newest') sorted.sort((a, b) => b.takenAt - a.takenAt)

  if (limit && limit > 0) sorted = sorted.slice(0, limit)

  // Reorder DOM by appending in sorted order. Hide the rest if limit applied.
  const grid = sorted[0]?.tile?.parentElement
  if (!grid) return { ordered: 0 }

  const sortedSet = new Set(sorted.map((s) => s.tile))
  for (const it of items) {
    if (!sortedSet.has(it.tile)) it.tile.style.display = 'none'
  }
  for (const s of sorted) {
    s.tile.style.display = ''
    grid.appendChild(s.tile)
  }

  return { ordered: sorted.length }
}

function resetSort() {
  document
    .querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')
    .forEach((link) => {
      const tile = findTile(link)
      if (tile) tile.style.display = ''
    })
}

// ---------- Message bridge ----------

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  ;(async () => {
    try {
      if (msg.action === 'sort') {
        const result = await sortPosts(msg.sortBy, msg.limit)
        sendResponse({ ok: true, ...result })
      } else if (msg.action === 'reset_sort') {
        resetSort()
        sendResponse({ ok: true })
      } else if (msg.action === 'scrape_for_socialdrop') {
        await ensureMetrics().catch(() => {})
        sendResponse({
          ok: true,
          profile: scrapeProfile(),
          posts: scrapePosts(),
        })
      } else if (msg.action === 'detect') {
        sendResponse({
          ok: true,
          username: getUsername(),
          isProfile: !!getUsername() && location.pathname.split('/').filter(Boolean).length === 1,
        })
      } else {
        sendResponse({ ok: false, error: 'unknown action' })
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message })
    }
  })()
  return true // keep channel open for async sendResponse
})
