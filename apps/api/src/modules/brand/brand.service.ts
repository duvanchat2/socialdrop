import { Injectable } from '@nestjs/common';
import { PrismaService } from '@socialdrop/prisma';

export interface BrandProfileDto {
  brandName: string;
  niche: string;
  tone: 'CASUAL' | 'FORMAL' | 'FUNNY' | 'INSPIRATIONAL';
  alwaysUseWords: string[];
  neverUseWords: string[];
  fixedHashtags: string[];
  optimalTimes: Record<string, string[]>;
}

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const profile = await this.prisma.brandProfile.findUnique({ where: { userId } });
    if (!profile) {
      // Return empty defaults — no DB write until user saves
      return {
        userId,
        brandName: '',
        niche: '',
        tone: 'CASUAL' as const,
        alwaysUseWords: [],
        neverUseWords: [],
        fixedHashtags: [],
        optimalTimes: {
          instagram: ['09:00', '12:00', '18:00'],
          tiktok: ['07:00', '15:00', '21:00'],
          facebook: ['10:00', '14:00'],
          youtube: ['15:00', '20:00'],
          twitter: ['08:00', '19:00'],
        },
      };
    }
    return profile;
  }

  async save(userId: string, dto: BrandProfileDto) {
    return this.prisma.brandProfile.upsert({
      where: { userId },
      update: {
        brandName: dto.brandName,
        niche: dto.niche,
        tone: dto.tone,
        alwaysUseWords: dto.alwaysUseWords,
        neverUseWords: dto.neverUseWords,
        fixedHashtags: dto.fixedHashtags,
        optimalTimes: dto.optimalTimes,
      },
      create: {
        userId,
        brandName: dto.brandName,
        niche: dto.niche,
        tone: dto.tone,
        alwaysUseWords: dto.alwaysUseWords,
        neverUseWords: dto.neverUseWords,
        fixedHashtags: dto.fixedHashtags,
        optimalTimes: dto.optimalTimes,
      },
    });
  }
}
