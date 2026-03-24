/**
 * Platform enum — defined as a plain const object so webpack can bundle it
 * without relying on @prisma/client initialization order.
 * Values must stay in sync with the Prisma schema.
 */
export const Platform = {
  INSTAGRAM: 'INSTAGRAM',
  TWITTER: 'TWITTER',
  FACEBOOK: 'FACEBOOK',
  TIKTOK: 'TIKTOK',
  LINKEDIN: 'LINKEDIN',
  YOUTUBE: 'YOUTUBE',
} as const;

export type Platform = (typeof Platform)[keyof typeof Platform];
