import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface WhisperResult {
  transcript: string;
  language: string;
  duration: number;
  error?: string;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly pythonPath = '/opt/whisper-env/bin/python3';
  private readonly scriptPath = path.join(
    process.cwd(),
    'apps/api/scripts/transcribe.py',
  );

  /**
   * Transcribe a local video file.
   * 1. Extracts audio via ffmpeg → tmp mp3
   * 2. Runs faster-whisper Python script
   * 3. Cleans up the tmp audio file
   */
  async transcribeVideo(videoPath: string): Promise<string> {
    const audioPath = videoPath.replace(/\.[^.]+$/, '_audio.mp3');

    try {
      // Extract audio track
      this.logger.log(`Extracting audio from ${path.basename(videoPath)}`);
      await execAsync(
        `ffmpeg -i "${videoPath}" -q:a 0 -map a "${audioPath}" -y 2>&1`,
        { timeout: 60_000 },
      );

      if (!fs.existsSync(audioPath)) {
        throw new Error('Audio extraction failed — no output file produced');
      }

      // Transcribe with faster-whisper
      this.logger.log(`Transcribing ${path.basename(audioPath)}`);
      const { stdout } = await execAsync(
        `"${this.pythonPath}" "${this.scriptPath}" "${audioPath}"`,
        { timeout: 120_000 }, // 2-min max
      );

      const result: WhisperResult = JSON.parse(stdout.trim());

      if (result.error) throw new Error(result.error);

      this.logger.log(
        `Transcribed ${result.duration?.toFixed(0)}s → ` +
        `${result.transcript.length} chars (lang: ${result.language})`,
      );

      return result.transcript;
    } catch (err: any) {
      this.logger.error(`Transcription failed: ${err.message}`);
      throw err;
    } finally {
      if (fs.existsSync(audioPath)) {
        try { fs.unlinkSync(audioPath); } catch { /* ignore */ }
      }
    }
  }

  /**
   * Download a remote video URL to a temp file, transcribe it, then clean up.
   */
  async transcribeUrl(videoUrl: string): Promise<string> {
    const tmpPath = `/tmp/video_${Date.now()}.mp4`;

    try {
      this.logger.log(`Downloading ${videoUrl}`);
      await execAsync(
        `ffmpeg -i "${videoUrl}" -c copy "${tmpPath}" -y 2>&1`,
        { timeout: 60_000 },
      );
      return await this.transcribeVideo(tmpPath);
    } finally {
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      }
    }
  }
}
