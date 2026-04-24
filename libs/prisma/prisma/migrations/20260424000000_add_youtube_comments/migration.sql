-- CreateTable
CREATE TABLE "YoutubeComment" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL DEFAULT 'demo-user',
    "videoId"         TEXT NOT NULL,
    "videoTitle"      TEXT,
    "commentId"       TEXT NOT NULL,
    "authorName"      TEXT NOT NULL,
    "authorChannelId" TEXT,
    "text"            TEXT NOT NULL,
    "likeCount"       INTEGER NOT NULL DEFAULT 0,
    "replyCount"      INTEGER NOT NULL DEFAULT 0,
    "publishedAt"     TIMESTAMP(3),
    "isShort"         BOOLEAN NOT NULL DEFAULT false,
    "replied"         BOOLEAN NOT NULL DEFAULT false,
    "repliedAt"       TIMESTAMP(3),
    "replyText"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YoutubeComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeAutoReply" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL DEFAULT 'demo-user',
    "keyword"       TEXT NOT NULL,
    "replyTemplate" TEXT NOT NULL,
    "isEnabled"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeAutoReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeComment_commentId_key" ON "YoutubeComment"("commentId");
CREATE INDEX "YoutubeComment_userId_idx" ON "YoutubeComment"("userId");
CREATE INDEX "YoutubeComment_userId_replied_idx" ON "YoutubeComment"("userId", "replied");
CREATE INDEX "YoutubeComment_videoId_idx" ON "YoutubeComment"("videoId");
CREATE INDEX "YoutubeAutoReply_userId_idx" ON "YoutubeAutoReply"("userId");
