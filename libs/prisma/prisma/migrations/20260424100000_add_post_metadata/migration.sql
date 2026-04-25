-- AlterTable: add optional metadata JSON column to Post
ALTER TABLE "Post" ADD COLUMN "metadata" JSONB;
