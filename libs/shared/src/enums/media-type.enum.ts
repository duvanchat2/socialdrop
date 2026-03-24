/**
 * MediaType enum — defined as a plain const object so webpack can bundle it
 * without relying on @prisma/client initialization order.
 * Values must stay in sync with the Prisma schema.
 */
export const MediaType = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  TEXT: 'TEXT',
} as const;

export type MediaType = (typeof MediaType)[keyof typeof MediaType];
