/** Single source of truth for the Meta Graph API version — see docs/prs/PR-20.md. */
export const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v19.0';
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
export const GRAPH_VIDEO_API_BASE = `https://graph-video.facebook.com/${GRAPH_API_VERSION}`;

/** Meta's rate-limit error codes — https://developers.facebook.com/docs/graph-api/guides/error-handling */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

/** True if a Graph API JSON response body carries one of Meta's rate-limit error codes. */
export function isMetaRateLimitBody(text: string): boolean {
  if (!text) return false;
  try {
    const parsed = JSON.parse(text) as { error?: { code?: number } };
    return parsed.error?.code != null && RATE_LIMIT_CODES.has(parsed.error.code);
  } catch {
    return false;
  }
}

/**
 * fetch() wrapper for Meta Graph API calls: retries with exponential backoff on
 * HTTP 429/5xx and on Meta's rate-limit error codes (4/17/32/613), which Graph
 * often returns with HTTP 200/400 instead of 429. Any other response (success
 * or non-rate-limit error) is returned as-is for the caller to parse — this
 * never throws on non-rate-limit errors, unlike SocialAbstract.throttledFetch.
 */
export async function graphFetch(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  let last: Response | undefined;
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, options);
    last = response;
    let rateLimited = response.status === 429;

    if (!rateLimited && (response.status === 200 || response.status === 400)) {
      const body = await response.clone().text().catch(() => '');
      rateLimited = isMetaRateLimitBody(body);
    }

    if ((rateLimited || response.status >= 500) && attempt < retries - 1) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    return response;
  }
  return last as Response;
}
