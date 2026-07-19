import { Instagram, Facebook, Youtube, Linkedin, Twitter, Music2 } from 'lucide-react';

export type Platform = 'INSTAGRAM' | 'TWITTER' | 'FACEBOOK' | 'TIKTOK' | 'LINKEDIN' | 'YOUTUBE';

const BRAND: Record<Platform, string> = {
  INSTAGRAM: '#E1306C',
  TIKTOK: '#66666E',
  FACEBOOK: '#1877F2',
  YOUTUBE: '#FF0000',
  LINKEDIN: '#0A66C2',
  TWITTER: '#71767B',
};

const ICON_TONE: Record<Platform, string> = {
  INSTAGRAM: '#F26B9C',
  TIKTOK: '#E8E8EF',
  FACEBOOK: '#5AA7FF',
  YOUTUBE: '#FF6B6B',
  LINKEDIN: '#4F9BE8',
  TWITTER: '#E8E8EF',
};

const LABELS: Record<Platform, string> = {
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  FACEBOOK: 'Facebook',
  YOUTUBE: 'YouTube',
  LINKEDIN: 'LinkedIn',
  TWITTER: 'Twitter / X',
};

const ICONS: Record<Platform, typeof Instagram> = {
  INSTAGRAM: Instagram,
  TIKTOK: Music2,
  FACEBOOK: Facebook,
  YOUTUBE: Youtube,
  LINKEDIN: Linkedin,
  TWITTER: Twitter,
};

const SIZES = { sm: 20, md: 28, lg: 36 } as const;

export interface PlatformChipProps {
  platform: Platform;
  size?: keyof typeof SIZES;
  /** Disconnected / needsReauth account — dims the tile to a neutral surface. */
  muted?: boolean;
  /** Account handle or name, used for the accessible label alongside the platform. */
  title?: string;
  /** Optional badge count (e.g. number of accounts on this platform). */
  count?: number;
}

export function PlatformChip({ platform, size = 'md', muted = false, title, count }: PlatformChipProps) {
  const px = SIZES[size];
  const Icon = ICONS[platform];
  const label = title ? `${LABELS[platform]} — ${title}` : LABELS[platform];

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="relative inline-flex items-center justify-center shrink-0"
      style={{
        width: px,
        height: px,
        borderRadius: 'var(--radius-chip)',
        background: muted ? 'var(--color-surface-2)' : `color-mix(in oklab, ${BRAND[platform]} 22%, var(--color-surface))`,
      }}
    >
      <Icon size={px * 0.55} color={muted ? 'var(--color-ink-muted)' : ICON_TONE[platform]} strokeWidth={2} />
      {count != null && count > 1 && (
        <span
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-[var(--color-base)] text-[9px] font-mono leading-none text-[var(--color-ink-muted)]"
          style={{ width: 14, height: 14, border: '1px solid var(--color-surface-2)' }}
        >
          {count}
        </span>
      )}
    </span>
  );
}

/** Renders up to `max` PlatformChips, collapsing the rest into a "+N" overflow chip. */
export function PlatformChipGroup({
  platforms,
  size = 'sm',
  max = 4,
}: {
  platforms: Platform[];
  size?: keyof typeof SIZES;
  max?: number;
}) {
  const visible = platforms.slice(0, max);
  const overflow = platforms.length - visible.length;
  const px = SIZES[size];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((p, i) => (
        <PlatformChip key={`${p}-${i}`} platform={p} size={size} />
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center justify-center shrink-0 font-mono text-[11px] text-[var(--color-ink-muted)]"
          style={{ width: px, height: px, borderRadius: 'var(--radius-chip)', background: 'var(--color-surface-2)' }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
