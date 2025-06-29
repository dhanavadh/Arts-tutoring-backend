import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { BadRequestException } from '@nestjs/common';
import * as multer from 'multer';
import * as path from 'path';
import { promises as fs } from 'fs';

export const multerConfig: MulterOptions = {
  storage: multer.diskStorage({
    destination: async (req, file, callback) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'courses');
      try {
        await fs.access(uploadDir);
      } catch {
        await fs.mkdir(uploadDir, { recursive: true });
      }
      callback(null, uploadDir);
    },
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      callback(null, `course-${uniqueSuffix}${extension}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    console.log('📁 File filter check:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    });

    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      console.log('✅ File type allowed:', file.mimetype);
      callback(null, true);
    } else {
      console.log('❌ File type rejected:', file.mimetype);
      console.log('📋 Allowed types:', allowedMimes);
      callback(new BadRequestException(`Invalid file type: ${file.mimetype}. Allowed types: ${allowedMimes.join(', ')}`), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
};
