/**
 * SocialDrop Competitor Analyzer — Content Script
 * Runs on instagram.com pages, scrapes profile + posts data on request.
 */

/** Parse "1,234", "45.6K", "1.2M" → integer */
function parseCount(text) {
  if (!text) return null;
  const s = text.replace(/,/g, '').trim();
  if (/k$/i.test(s)) return Math.round(parseFloat(s) * 1_000);
  if (/m$/i.test(s)) return Math.round(parseFloat(s) * 1_000_000);
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/** Extract username from pathname: /cocacola/ → "cocacola" */
function getUsername() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] ?? null;
}

/** Scrape profile header data */
function scrapeProfile() {
  const username = getUsername();

  // Try multiple selectors for display name
  const displayName =
    document.querySelector('h2')?.textContent?.trim() ||
    document.querySelector('h1')?.textContent?.trim() ||
    null;

  // Followers / following / posts — Instagram renders them as links
  let followers = null, following = null, postsCount = null;

  // Try the structured list approach (desktop)
  const statsList = document.querySelectorAll('ul li');
  if (statsList.length >= 3) {
    postsCount = parseCount(statsList[0]?.querySelector('span span')?.textContent);
    followers  = parseCount(statsList[1]?.querySelector('span span')?.textContent);
    following  = parseCount(statsList[2]?.querySelector('span span')?.textContent);
  }

  // Fallback: find by aria / href patterns
  if (!followers) {
    document.querySelectorAll('a[href*="followers"]').forEach(el => {
      const n = parseCount(el.querySelector('span')?.textContent || el.textContent);
      if (n) followers = n;
    });
  }

  // Bio
  const bio =
    document.querySelector('.-vDIg span')?.textContent?.trim() ||
    document.querySelector('div[data-testid="user-bio"]')?.textContent?.trim() ||
    null;

  // Avatar
  const avatar =
    document.querySelector('img[alt*="profile picture"]')?.src ||
    document.querySelector('header img')?.src ||
    null;

  return { username, displayName, followers, following, postsCount, bio, avatar };
}

/** Scrape visible posts in the grid */
function scrapePosts() {
  const posts = [];
  const seen  = new Set();

  // Article links in grid
  document.querySelectorAll('a[href*="/p/"]').forEach(el => {
    const href   = el.href;
    const match  = href.match(/\/p\/([^/?#]+)/);
    const postId = match?.[1];
    if (!postId || seen.has(postId)) return;
    seen.add(postId);

    const img       = el.querySelector('img');
    const thumbnail = img?.src || null;

    // Try to read accessibility text for likes/comments (not always available)
    const altText = img?.alt || '';

    // Detect media type from SVG icons (video has a play icon)
    const svgs = el.querySelectorAll('svg');
    let mediaType = 'IMAGE';
    svgs.forEach(svg => {
      const title = svg.querySelector('title')?.textContent?.toLowerCase() || '';
      if (title.includes('video') || title.includes('reel')) mediaType = 'VIDEO';
      if (title.includes('carousel') || title.includes('multiple')) mediaType = 'CAROUSEL';
    });

    posts.push({
      postId,
      url: href,
      thumbnail,
      mediaType,
      caption: altText || null,
      likes: null,
      comments: null,
      hashtags: extractHashtags(altText),
      publishedAt: null,
    });
  });

  return posts;
}

/** Extract hashtags from a string */
function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#(\w+)/g) || [];
  return matches.map(h => h.slice(1).toLowerCase());
}

/** Listen for messages from the popup */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'scrape') {
    try {
      const profile = scrapeProfile();
      const posts   = scrapePosts();
      sendResponse({ ok: true, profile, posts });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return true; // keep channel open for async
  }
});
