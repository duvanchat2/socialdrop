/**
 * PostStatus enum — defined as a plain const object so webpack can bundle it
 * without relying on @prisma/client initialization order.
 * Values must stay in sync with the Prisma schema.
 */
export const PostStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  SCHEDULED: 'SCHEDULED',
  PUBLISHING: 'PUBLISHING',
  PUBLISHED: 'PUBLISHED',
  ERROR: 'ERROR',
} as const;

export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];
