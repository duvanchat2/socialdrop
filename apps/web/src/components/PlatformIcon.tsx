export type Platform = 'FACEBOOK' | 'INSTAGRAM' | 'TWITTER' | 'TIKTOK' | 'YOUTUBE';

const COLORS: Record<Platform, string> = {
  FACEBOOK: '#1877F2', INSTAGRAM: '#E1306C', TWITTER: '#1DA1F2',
  TIKTOK: '#000000', YOUTUBE: '#FF0000',
};

const LABELS: Record<Platform, string> = {
  FACEBOOK: 'F', INSTAGRAM: 'IG', TWITTER: 'X', TIKTOK: 'TT', YOUTUBE: 'YT',
};

export function PlatformIcon({ platform, size = 24 }: { platform: Platform; size?: number }) {
  return (
    <span
      title={platform}
      className="inline-flex items-center justify-center rounded-full text-white font-bold text-xs"
      style={{ width: size, height: size, background: COLORS[platform], fontSize: size * 0.35 }}
    >
      {LABELS[platform]}
    </span>
  );
}
