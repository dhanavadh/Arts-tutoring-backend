import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { join } from 'path';
import { existsSync, createReadStream } from 'fs';
import { UploadsService } from './uploads.service';
import { CreateUploadDto } from './dto/file-upload.dto';
import { UpdateUploadDto } from './dto/update-upload.dto';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('files/*')
  serveFile(@Req() req: Request, @Res() res: Response) {
    // Extract file path from the request URL
    const requestPath = req.url;
    const filePath = requestPath.replace('/api/v1/uploads/files/', '');

    // Handle case where filePath might be empty
    if (!filePath || filePath === requestPath) {
      throw new NotFoundException('File path not provided');
    }

    // If not a profile image, require authentication
    if (!filePath.startsWith('profiles/')) {
      // Check for JWT (reuse JwtAuthGuard logic or custom check)
      // For simplicity, throw Unauthorized if no access_token cookie
      if (!req.cookies || !req.cookies.access_token) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
    }

    // Construct the full file path
    const fullPath = join(process.cwd(), 'uploads', filePath);

    // Check if file exists
    if (!existsSync(fullPath)) {
      throw new NotFoundException('File not found');
    }

    // Set appropriate headers
    res.setHeader('Content-Type', this.getContentType(filePath));
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // Stream the file
    const fileStream = createReadStream(fullPath);
    fileStream.pipe(res);
  }

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  @Post()
  create(@Body() createUploadDto: CreateUploadDto) {
    return this.uploadsService.create(createUploadDto);
  }

  @Get()
  findAll() {
    return this.uploadsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.uploadsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUploadDto: UpdateUploadDto) {
    return this.uploadsService.update(+id, updateUploadDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.uploadsService.remove(+id);
  }
}
