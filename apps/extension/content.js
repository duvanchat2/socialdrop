// ============================================================================
// SocialDrop — content script
// Approach: auto-scroll to load posts → read metrics Instagram already
// renders on thumbnails → sort/filter DOM tiles.
// No CSS injected on load. Everything is lazy / user-triggered.
// ============================================================================

const metricsCache = new Map()   // postId → { views, likes, comments, takenAt }
const IG_APP_ID    = '936619743392459'

// ---------- Number parsing (handles Spanish: "14,2 mil", "18,9 mil") ----------

function extractNumber(text) {
  if (!text) return 0
  const s = String(text).trim().toLowerCase().replace(/\s+/g, '')

  // "14,2mil" | "1,2mil"  (Spanish/PT: comma = decimal separator)
  const milM = s.match(/^([\d]+[,.]?[\d]*)\s*mil/)
  if (milM) return Math.round(parseFloat(milM[1].replace(',', '.')) * 1_000)

  // "1,2m" | "1.2m"
  if (/^\d[\d,.]*m$/.test(s)) return Math.round(parseFloat(s.replace(',', '.')) * 1_000_000)

  // "14,2k" | "14.2k"
  if (/^\d[\d,.]*k$/.test(s)) return Math.round(parseFloat(s.replace(',', '.')) * 1_000)

  // Plain number "6039" | "6.039" | "6,039"
  return parseInt(s.replace(/\D/g, ''), 10) || 0
}

// ---------- DOM helpers ----------

function getUsername() {
  const parts = location.pathname.split('/').filter(Boolean)
  return parts[0] && !['p', 'reel', 'reels', 'explore', 'stories'].includes(parts[0])
    ? parts[0]
    : null
}

function allPostLinks() {
  return Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
}

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

// ---------- Read metrics that Instagram already renders on thumbnails ----------
// Instagram shows view counts (e.g. "6 039", "14,2 mil") as text overlays
// on Reel tiles, and like counts on photo tiles.

function readTileMetric(tile) {
  const nums = []
  const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT, null)
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent?.trim()
    if (!t) continue
    // Accept strings that look like metric values
    if (/^[\d][\d\s,.]*(mil|[km])?$/i.test(t)) {
      const n = extractNumber(t)
      if (n >= 100) nums.push(n)
    }
  }
  return nums.length ? Math.max(...nums) : 0
}

function scrapeMetricsFromDOM() {
  const seen = new Set()
  for (const link of allPostLinks()) {
    const m = link.href.match(/\/(p|reel)\/([^/?]+)/)
    if (!m) continue
    const postId = m[2]
    if (seen.has(postId)) continue
    seen.add(postId)
    if (metricsCache.has(postId)) continue  // already cached

    const isReel = link.href.includes('/reel/')
    const tile   = findTile(link)
    const n      = tile ? readTileMetric(tile) : 0

    metricsCache.set(postId, {
      views:    isReel ? n : 0,
      likes:    isReel ? 0 : n,
      comments: 0,
      takenAt:  0,
      fromDOM:  true,
    })
  }
}

// ---------- web_profile_info fallback (richer data: likes, comments, date) ----------

let apiMetricsFetched  = false
let apiMetricsPromise  = null

async function fetchApiMetrics() {
  const username = getUsername()
  if (!username) return
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
  const res = await fetch(url, {
    headers: { 'x-ig-app-id': IG_APP_ID, 'x-requested-with': 'XMLHttpRequest' },
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`web_profile_info ${res.status}`)
  const edges = (await res.json())?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
  for (const { node: n } of edges) {
    if (!n?.shortcode) continue
    metricsCache.set(n.shortcode, {
      views:    n.video_view_count ?? n.video_play_count ?? 0,
      likes:    n.edge_liked_by?.count ?? n.edge_media_preview_like?.count ?? 0,
      comments: n.edge_media_to_comment?.count ?? 0,
      takenAt:  n.taken_at_timestamp ?? 0,
      caption:  n.edge_media_to_caption?.edges?.[0]?.node?.text ?? '',
      thumbnail: n.thumbnail_src ?? n.display_url ?? null,
    })
  }
  apiMetricsFetched = true
}

function ensureApiMetrics() {
  if (apiMetricsFetched) return Promise.resolve()
  if (apiMetricsPromise)  return apiMetricsPromise
  apiMetricsPromise = fetchApiMetrics().catch(err =>
    console.warn('[SocialDrop] api metrics failed:', err.message),
  )
  return apiMetricsPromise
}

// ---------- Auto-scroll (loads more posts, like SortFeed) ----------

async function autoScroll(targetCount) {
  let stalls = 0
  let prev   = 0

  while (stalls < 3) {
    const count = new Set(
      allPostLinks()
        .map(l => l.href.match(/\/(p|reel)\/([^/?]+)/)?.[2])
        .filter(Boolean),
    ).size

    if (count >= targetCount) break
    if (count === prev) stalls++
    else stalls = 0
    prev = count

    window.scrollBy(0, window.innerHeight * 2)
    await new Promise(r => setTimeout(r, 1400))
  }

  // Scroll back to top so user can see the sorted grid
  window.scrollTo({ top: 0, behavior: 'smooth' })
  await new Promise(r => setTimeout(r, 600))

  // Scrape metrics NOW that all tiles are in the DOM
  scrapeMetricsFromDOM()
}

// ---------- Visual badges (the "yellow" numbers SortFeed shows) ----------

function removeBadges() {
  document.querySelectorAll('.__sd_badge').forEach(b => b.remove())
}

function addBadge(tile, text, color = '#f59e0b') {
  const badge = document.createElement('div')
  badge.className = '__sd_badge'
  badge.textContent = text
  Object.assign(badge.style, {
    position:       'absolute',
    top:            '6px',
    left:           '6px',
    background:     color,
    color:          '#fff',
    fontSize:       '11px',
    fontWeight:     '700',
    padding:        '2px 6px',
    borderRadius:   '4px',
    zIndex:         '9999',
    pointerEvents:  'none',
    lineHeight:     '1.4',
    boxShadow:      '0 1px 3px rgba(0,0,0,.4)',
  })
  // Tile needs relative positioning
  if (getComputedStyle(tile).position === 'static') {
    tile.style.position = 'relative'
  }
  tile.appendChild(badge)
}

function formatMetric(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace('.0', '') + 'K'
  return String(n)
}

// ---------- Sort ----------

async function sortPosts(sortBy, limit) {
  const targetCount = limit && limit > 0 ? limit : 50
  await autoScroll(targetCount)
  await ensureApiMetrics().catch(() => {})

  const seen  = new Set()
  const items = []

  for (const link of allPostLinks()) {
    const m = link.href.match(/\/(p|reel)\/([^/?]+)/)
    if (!m) continue
    const postId = m[2]
    if (seen.has(postId)) continue
    seen.add(postId)
    const tile   = findTile(link)
    if (!tile) continue
    const metric = metricsCache.get(postId) ?? {}
    items.push({
      postId, tile,
      views:    metric.views    ?? 0,
      likes:    metric.likes    ?? 0,
      comments: metric.comments ?? 0,
      takenAt:  metric.takenAt  ?? 0,
    })
  }

  if (!items.length) return { ok: false, error: 'no posts found' }

  let sorted = [...items]
  if      (sortBy === 'likes')    sorted.sort((a, b) => b.likes    - a.likes)
  else if (sortBy === 'views')    sorted.sort((a, b) => b.views    - a.views)
  else if (sortBy === 'comments') sorted.sort((a, b) => b.comments - a.comments)
  else if (sortBy === 'oldest')   sorted.sort((a, b) => a.takenAt  - b.takenAt)
  else if (sortBy === 'newest')   sorted.sort((a, b) => b.takenAt  - a.takenAt)

  if (limit && limit > 0) sorted = sorted.slice(0, limit)

  const grid     = sorted[0]?.tile?.parentElement
  if (!grid) return { ok: false, error: 'grid not found' }

  // Reorder DOM + add badges
  removeBadges()
  const shownSet = new Set(sorted.map(s => s.tile))
  for (const it of items) {
    it.tile.style.display = shownSet.has(it.tile) ? '' : 'none'
  }

  const metricKey = sortBy === 'likes' ? 'likes'
                  : sortBy === 'comments' ? 'comments'
                  : sortBy === 'oldest' || sortBy === 'newest' ? null
                  : 'views'

  sorted.forEach((s, i) => {
    s.tile.style.display = ''
    grid.appendChild(s.tile)
    const val = metricKey ? s[metricKey] : null
    const label = val !== null && val > 0
      ? `#${i + 1}  ${formatMetric(val)}`
      : `#${i + 1}`
    addBadge(s.tile, label)
  })

  return { ok: true, ordered: sorted.length }
}

function resetSort() {
  removeBadges()
  for (const link of allPostLinks()) {
    const tile = findTile(link)
    if (tile) tile.style.display = ''
  }
}

// ---------- Filter ----------

async function filterPosts(minViews, minLikes, minComments) {
  // Ensure we've scraped DOM metrics
  scrapeMetricsFromDOM()
  if (minViews > 0 || minLikes > 0 || minComments > 0) {
    await ensureApiMetrics().catch(() => {})
  }

  const seen   = new Set()
  let shown    = 0
  let hidden   = 0

  removeBadges()

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

    const passes =
      views    >= minViews &&
      likes    >= minLikes &&
      comments >= minComments

    tile.style.display = passes ? '' : 'none'

    if (passes) {
      shown++
      // Show metric badge on matching tiles
      const primary = views || likes
      if (primary > 0) {
        addBadge(tile, formatMetric(primary), '#a855f7')
      }
    } else {
      hidden++
    }
  }

  return { ok: true, shown, hidden }
}

// ---------- Scrape for SocialDrop ----------

function scrapeProfile() {
  return {
    username:    getUsername(),
    displayName: document.querySelector('h1, h2')?.textContent?.trim(),
    followers:   0,
    url:         location.href,
  }
}

function scrapePosts() {
  scrapeMetricsFromDOM()
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
      takenAt:   metric.takenAt
        ? new Date(metric.takenAt * 1000).toISOString()
        : null,
    })
  }
  return posts.slice(0, 50)
}

// ---------- Message listener ----------

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  ;(async () => {
    try {
      if (msg.action === 'detect') {
        const parts    = location.pathname.split('/').filter(Boolean)
        const username = getUsername()
        sendResponse({ ok: true, username, isProfile: !!username && parts.length === 1 })

      } else if (msg.action === 'sort') {
        sendResponse(await sortPosts(msg.sortBy, msg.limit ?? 25))

      } else if (msg.action === 'reset_sort') {
        resetSort()
        sendResponse({ ok: true })

      } else if (msg.action === 'filter') {
        sendResponse(await filterPosts(msg.minViews ?? 0, msg.minLikes ?? 0, msg.minComments ?? 0))

      } else if (msg.action === 'scrape' || msg.action === 'scrape_for_socialdrop') {
        await ensureApiMetrics().catch(() => {})
        sendResponse({ ok: true, profile: scrapeProfile(), posts: scrapePosts() })

      } else {
        sendResponse({ ok: false, error: 'unknown action' })
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message })
    }
  })()
  return true
})
