import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '@socialdrop/prisma';
import { TranscriptionService } from '../brain/transcription.service.js';
import { COMPETITOR_ANALYSIS_QUEUE } from './competitors.service.js';

const execAsync = promisify(exec);

interface AnalysisJobData {
  competitorPostId: string;
  competitorId: string;
  videoUrl: string;
  postId: string;
  likes?: number;
  views?: number;
  comments?: number;
}

interface ClaudeAnalysis {
  hookText: string;
  hookType: string;
  whyItWorks: string;
  emotionTrigger: string;
  analysisScore: number;
  keyTakeaway: string;
}

@Processor(COMPETITOR_ANALYSIS_QUEUE)
export class CompetitorAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(CompetitorAnalysisProcessor.name);
  private readonly anthropic: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly transcription: TranscriptionService,
  ) {
    super();
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.anthropic) {
      this.logger.warn('ANTHROPIC_API_KEY not set — analysis will be transcript-only');
    }
  }

  async process(job: Job<AnalysisJobData>): Promise<unknown> {
    const { competitorPostId, videoUrl, likes, views, comments } = job.data;
    this.logger.log(`Processing competitor video ${competitorPostId}`);

    // Step 1: download video → /tmp
    const tmpPath = path.join('/tmp', `comp_${competitorPostId}.mp4`);
    try {
      await execAsync(`ffmpeg -i "${videoUrl}" -c copy "${tmpPath}" -y 2>&1`, {
        timeout: 60_000,
      });
      if (!fs.existsSync(tmpPath)) {
        throw new Error('ffmpeg did not produce output file');
      }

      // Step 2: transcribe with faster-whisper
      const transcript = await this.transcription.transcribeVideo(tmpPath);

      // Step 3: analyze with Claude (if key available)
      const analysis = this.anthropic
        ? await this.analyzeWithClaude(transcript, likes ?? 0, views ?? 0, comments ?? 0)
        : null;

      // Step 4: persist
      await this.prisma.competitorPost.update({
        where: { id: competitorPostId },
        data: {
          transcript,
          ...(analysis ?? {}),
          analyzedAt: new Date(),
        },
      });

      this.logger.log(
        `[Competitors] ✓ Analyzed ${competitorPostId} — ${transcript.length} chars` +
          (analysis ? `, score ${analysis.analysisScore}/10` : ''),
      );

      return { ok: true, transcriptChars: transcript.length, hadAnalysis: !!analysis };
    } finally {
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private async analyzeWithClaude(
    transcript: string,
    likes: number,
    views: number,
    comments: number,
  ): Promise<ClaudeAnalysis> {
    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    const prompt = `Analiza este video de Instagram Reels sobre IA/automatización.

Transcripción: ${transcript}
Métricas: ${likes} likes, ${views} views, ${comments} comments

Responde SOLO en JSON válido (sin markdown, sin texto extra):
{
  "hookText": "el gancho exacto de los primeros 3 segundos",
  "hookType": "pregunta|shock|historia|tip|promesa|dato",
  "whyItWorks": "explicación de 2-3 oraciones de por qué funcionó",
  "emotionTrigger": "curiosidad|miedo|inspiración|humor|sorpresa",
  "analysisScore": 8,
  "keyTakeaway": "lección principal para replicar en mis videos"
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    const raw = block && block.type === 'text' ? block.text : '{}';
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let parsed: Partial<ClaudeAnalysis> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      this.logger.warn(`Claude returned non-JSON: ${cleaned.slice(0, 200)}`);
    }

    return {
      hookText: parsed.hookText ?? '',
      hookType: parsed.hookType ?? '',
      whyItWorks: parsed.whyItWorks ?? '',
      emotionTrigger: parsed.emotionTrigger ?? '',
      analysisScore: typeof parsed.analysisScore === 'number' ? parsed.analysisScore : 0,
      keyTakeaway: parsed.keyTakeaway ?? '',
    };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AnalysisJobData>, err: Error) {
    this.logger.error(
      `[Competitors] Analysis job ${job.id} for post ${job.data?.competitorPostId} failed: ${err.message}`,
    );
  }
}
