import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsExceptionFilter } from './uploads-exception.filter';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const UPLOADS_ROOT = join(process.cwd(), 'uploads');
const POST_IMAGE_UPLOAD_DIR = join(UPLOADS_ROOT, 'posts');
const PUBLIC_POST_IMAGE_PATH = '/uploads/posts';
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

mkdirSync(POST_IMAGE_UPLOAD_DIR, { recursive: true });

type UploadedImage = {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
};

type UploadRequest = {
  protocol?: string;
  get?: (name: string) => string | undefined;
  headers?: Record<string, string | string[] | undefined>;
};

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getRequestOrigin(req: UploadRequest) {
  const forwardedProto = firstHeaderValue(req.headers?.['x-forwarded-proto'])
    ?.split(',')
    .at(0)
    ?.trim();
  const forwardedHost = firstHeaderValue(req.headers?.['x-forwarded-host'])
    ?.split(',')
    .at(0)
    ?.trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.get?.('host') || 'localhost:3000';

  return `${protocol}://${host}`;
}

@Controller('uploads')
@UseFilters(UploadsExceptionFilter)
export class UploadsController {
  @UseGuards(JwtAuthGuard)
  @Post('images')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: POST_IMAGE_UPLOAD_DIR,
        filename: (_req, file, callback) => {
          const extension = ALLOWED_IMAGE_TYPES.get(file.mimetype);
          callback(null, `${randomUUID()}${extension ?? ''}`);
        },
      }),
      limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES,
        files: 1,
      },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
          callback(
            new BadRequestException(
              'Formato inválido. Envie uma imagem JPG, PNG ou WebP.',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadPostImage(
    @Req() req: UploadRequest,
    @UploadedFile() file?: UploadedImage,
  ) {
    if (!file) {
      throw new BadRequestException('Envie uma imagem no campo "image".');
    }

    const publicPath = `${PUBLIC_POST_IMAGE_PATH}/${file.filename}`;

    return {
      imageUrl: `${getRequestOrigin(req)}${publicPath}`,
      path: publicPath,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
