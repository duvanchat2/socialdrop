function parseCount(text) {
  if (!text) return 0
  text = text.replace(/,/g, '').trim()
  if (text.includes('M')) return parseFloat(text) * 1000000
  if (text.includes('K')) return parseFloat(text) * 1000
  return parseInt(text) || 0
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
    url: location.href
  }
}

function scrapePosts() {
  const posts = []
  document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')
    .forEach(el => {
      const postId = el.href.match(/\/(p|reel)\/([^/]+)/)?.[2]
      if (postId && !posts.find(p => p.postId === postId)) {
        posts.push({
          postId,
          url: el.href,
          thumbnail: el.querySelector('img')?.src,
          isReel: el.href.includes('/reel/')
        })
      }
    })
  return posts.slice(0, 30)
}

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.action === 'scrape') {
    sendResponse({
      profile: scrapeProfile(),
      posts: scrapePosts(),
      url: location.href
    })
  }
  return true
})
