export interface UploadedMedia {
  url: string;
  fileName: string;
  mimeType: string;
  mediaType: 'IMAGE' | 'VIDEO';
}

export interface PostDraft {
  /** sequential index for display */
  index: number;
  mediaUrl: string;
  mediaFileName: string;
  mediaType: 'IMAGE' | 'VIDEO';
  platform: string;
  scheduledAt: string; // ISO datetime string
  caption: string;
  youtubeTitle?: string;
  youtubeDescription?: string;
  youtubeTags?: string[];
  contentType?: 'VALUE' | 'LEADS' | 'SALES' | 'ANY';
}

export interface DistributeAutoParams {
  media: UploadedMedia[];
  startDate: string;
  endDate: string;
  platforms: string[];
  postsPerDay: Record<string, number>;
  times: Record<string, string[]>;
}

export interface DistributeStrategyParams {
  media: UploadedMedia[];
  startDate: string;
  userId: string;
}

export interface ScheduleParams {
  drafts: PostDraft[];
  userId: string;
}
