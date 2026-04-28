// ============================================================================
// SocialDrop Analyzer — Instagram content script
//
// SAFE: No CSS injection, no DOM mutation on load.
// Metrics are fetched LAZILY only when the user triggers an action.
// ============================================================================

// ---------- Metrics cache (populated on demand) ----------

const metricsCache = new Map()   // postId → { likes, views, comments, takenAt, ... }
let metricsFetched  = false
let metricsFetchPromise = null

const IG_APP_ID = '936619743392459'

function extractNumber(text) {
  if (!text) return 0
  const s = String(text).trim()
  if (/[Mm]/.test(s)) return Math.round(parseFloat(s) * 1_000_000)
  if (/[Kk]/.test(s)) return Math.round(parseFloat(s) * 1_000)
  return parseInt(s.replace(/[^\d]/g, ''), 10) || 0
}

function getUsername() {
  const parts = location.pathname.split('/').filter(Boolean)
  return parts[0] && !['p', 'reel', 'reels', 'explore', 'stories'].includes(parts[0])
    ? parts[0]
    : null
}

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
  const edges = json?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
  for (const { node: n } of edges) {
    if (!n?.shortcode) continue
    metricsCache.set(n.shortcode, {
      likes:    n.edge_liked_by?.count ?? n.edge_media_preview_like?.count ?? 0,
      comments: n.edge_media_to_comment?.count ?? 0,
      views:    n.video_view_count ?? n.video_play_count ?? 0,
      caption:  n.edge_media_to_caption?.edges?.[0]?.node?.text ?? '',
      takenAt:  n.taken_at_timestamp ?? 0,
      isVideo:  !!n.is_video,
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

// ---------- DOM helpers ----------

function findTile(link) {
  let el = link
  while (el && el !== document.body) {
    const parent = el.parentElement
    if (!parent) break
    if (parent.children.length >= 2) {
      const cs = getComputedStyle(parent)
      if (cs.display === 'flex' || cs.display === 'grid') return el
    }
    el = parent
  }
  return link.parentElement
}

function allPostLinks() {
  return Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
}

// ---------- Scrape ----------

function scrapeProfile() {
  const username = getUsername()
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
  for (const el of allPostLinks()) {
    const m = el.href.match(/\/(p|reel)\/([^/?]+)/)
    if (!m) continue
    const postId = m[2]
    if (seen.has(postId)) continue
    seen.add(postId)
    const metric = metricsCache.get(postId) ?? {}
    posts.push({
      postId,
      url:       el.href,
      thumbnail: el.querySelector('img')?.src || metric.thumbnail || '',
      isReel:    el.href.includes('/reel/'),
      likes:     metric.likes    ?? 0,
      views:     metric.views    ?? 0,
      comments:  metric.comments ?? 0,
      caption:   metric.caption  ?? '',
      takenAt:   metric.takenAt  ? new Date(metric.takenAt * 1000).toISOString() : null,
    })
  }
  return posts.slice(0, 50)
}

// ---------- Sort ----------

async function sortPosts(sortBy, limit) {
  await ensureMetrics()

  const seen  = new Set()
  const items = []
  for (const link of allPostLinks()) {
    const m = link.href.match(/\/(p|reel)\/([^/?]+)/)
    if (!m) continue
    const postId = m[2]
    if (seen.has(postId)) continue
    seen.add(postId)
    const tile = findTile(link)
    if (!tile) continue
    const metric = metricsCache.get(postId) ?? {}
    items.push({
      postId, tile,
      likes:    metric.likes    ?? 0,
      comments: metric.comments ?? 0,
      views:    metric.views    ?? 0,
      takenAt:  metric.takenAt  ?? 0,
    })
  }
  if (!items.length) return { ok: false, reason: 'no posts found' }

  let sorted = [...items]
  if      (sortBy === 'likes')    sorted.sort((a, b) => b.likes    - a.likes)
  else if (sortBy === 'views')    sorted.sort((a, b) => b.views    - a.views)
  else if (sortBy === 'comments') sorted.sort((a, b) => b.comments - a.comments)
  else if (sortBy === 'oldest')   sorted.sort((a, b) => a.takenAt  - b.takenAt)
  else if (sortBy === 'newest')   sorted.sort((a, b) => b.takenAt  - a.takenAt)

  if (limit && limit > 0) sorted = sorted.slice(0, limit)

  const grid     = sorted[0]?.tile?.parentElement
  if (!grid) return { ok: false, reason: 'grid not found' }

  const shownSet = new Set(sorted.map((s) => s.tile))
  for (const it of items) {
    it.tile.style.display = shownSet.has(it.tile) ? '' : 'none'
  }
  for (const s of sorted) {
    s.tile.style.display = ''
    grid.appendChild(s.tile)
  }
  return { ok: true, count: sorted.length }
}

function resetSort() {
  for (const link of allPostLinks()) {
    const tile = findTile(link)
    if (tile) tile.style.display = ''
  }
}

// ---------- Filter ----------

async function filterPosts(minViews, minLikes, minComments) {
  // If any threshold > 0, try to get metrics first
  if (minViews > 0 || minLikes > 0 || minComments > 0) {
    await ensureMetrics()
  }

  const seen   = new Set()
  let shown    = 0
  let hidden   = 0

  for (const link of allPostLinks()) {
    const m = link.href.match(/\/(p|reel)\/([^/?]+)/)
    if (!m) continue
    const postId = m[2]
    if (seen.has(postId)) continue
    seen.add(postId)

    const tile   = findTile(link)
    if (!tile) continue

    const metric   = metricsCache.get(postId) ?? {}
    const views    = metric.views    ?? 0
    const likes    = metric.likes    ?? 0
    const comments = metric.comments ?? 0

    // If all thresholds are 0, show everything
    const passes = views >= minViews && likes >= minLikes && comments >= minComments

    tile.style.display = passes ? '' : 'none'
    passes ? shown++ : hidden++
  }

  return { ok: true, shown, hidden }
}

// ---------- Message listener ----------

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  ;(async () => {
    try {
      if (msg.action === 'detect') {
        const parts    = location.pathname.split('/').filter(Boolean)
        const username = getUsername()
        sendResponse({
          ok:        true,
          username,
          isProfile: !!username && parts.length === 1,
        })

      } else if (msg.action === 'sort') {
        const result = await sortPosts(msg.sortBy, msg.limit ?? 0)
        sendResponse(result)

      } else if (msg.action === 'reset_sort') {
        resetSort()
        sendResponse({ ok: true })

      } else if (msg.action === 'filter') {
        const result = await filterPosts(
          msg.minViews    ?? 0,
          msg.minLikes    ?? 0,
          msg.minComments ?? 0,
        )
        sendResponse(result)

      } else if (msg.action === 'scrape' || msg.action === 'scrape_for_socialdrop') {
        await ensureMetrics().catch(() => {})
        sendResponse({
          ok:      true,
          profile: scrapeProfile(),
          posts:   scrapePosts(),
        })

      } else {
        sendResponse({ ok: false, error: 'unknown action' })
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message })
    }
  })()
  return true  // keep channel open for async sendResponse
})
