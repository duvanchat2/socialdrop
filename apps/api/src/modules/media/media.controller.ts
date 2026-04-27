import {
  Controller, Post, Delete, Param, Query, UseInterceptors, UploadedFile,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname, join } from 'path';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { MediaService } from './media.service.js';

const ALLOWED_MIME = /image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|mov|avi|x-msvideo|msvideo|x-matroska|webm)/;
const ALLOWED_EXT = /\.(mp4|mov|avi|webm|mkv|jpg|jpeg|png|gif|webp)$/i;

function isAllowedFile(mimetype: string, originalname: string): boolean {
  // Accept by MIME type or by extension when browser sends octet-stream
  return ALLOWED_MIME.test(mimetype) ||
    (mimetype === 'application/octet-stream' && ALLOWED_EXT.test(originalname));
}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a media file (image or video)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Media file to upload' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, join(process.cwd(), process.env.UPLOAD_DIRECTORY ?? './uploads'));
        },
        filename: (req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (isAllowedFile(file.mimetype, file.originalname)) {
          cb(null, true);
        } else {
          cb(new HttpException(`Tipo de archivo no soportado: ${file.mimetype}. Formatos válidos: JPG, PNG, WebP, GIF, MP4, MOV, AVI`, HttpStatus.BAD_REQUEST), false);
        }
      },
      limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('postId') postId: string,
  ) {
    if (!file) throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    if (!postId) throw new HttpException('postId is required', HttpStatus.BAD_REQUEST);
    return this.mediaService.saveUpload(postId, file);
  }

  @Post('upload-standalone')
  @ApiOperation({ summary: 'Upload a media file without linking to a post (returns URL)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Media file to upload' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, join(process.cwd(), process.env.UPLOAD_DIRECTORY ?? './uploads'));
        },
        filename: (req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (isAllowedFile(file.mimetype, file.originalname)) {
          cb(null, true);
        } else {
          cb(new HttpException(`Tipo de archivo no soportado: ${file.mimetype}. Formatos válidos: JPG, PNG, WebP, GIF, MP4, MOV, AVI`, HttpStatus.BAD_REQUEST), false);
        }
      },
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  async uploadStandalone(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    return this.mediaService.saveUploadStandalone(file);
  }

  /**
   * Speed-test endpoint — accepts a file upload (memory storage, no disk write)
   * and returns the received byte count so the client can measure upload speed.
   */
  @Post('speed-test')
  @ApiOperation({ summary: 'Upload speed test — no disk write, returns bytes received' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Test file (any size)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max for test files
    }),
  )
  speedTest(@UploadedFile() file: Express.Multer.File) {
    return {
      ok: true,
      receivedBytes: file?.buffer?.length ?? 0,
      serverLocation: 'VPS Contabo',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a media file' })
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}
