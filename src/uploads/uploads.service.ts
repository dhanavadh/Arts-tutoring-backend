import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileUpload, UploadType } from './entities/file-upload.entity';
import { User } from '../users/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadsService {
  constructor(
    @InjectRepository(FileUpload)
    private fileUploadRepository: Repository<FileUpload>,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    uploadType: UploadType,
    user: User,
    entityId?: number,
  ): Promise<FileUpload> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = this.getAllowedMimeTypes(uploadType);
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const filename = `${uuidv4()}${fileExtension}`;
    const uploadPath = this.getUploadPath(uploadType);
    const fullPath = path.join(uploadPath, filename);

    // Ensure directory exists
    fs.mkdirSync(uploadPath, { recursive: true });

    // Save file
    fs.writeFileSync(fullPath, file.buffer);

    // Save to database
    const fileUpload = this.fileUploadRepository.create({
      filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: fullPath,
      uploadType,
      uploadedById: user.id,
      entityId,
    });

    return this.fileUploadRepository.save(fileUpload);
  }

  private getAllowedMimeTypes(uploadType: UploadType): string[] {
    switch (uploadType) {
      case UploadType.PROFILE_IMAGE:
      case UploadType.ARTICLE_IMAGE:
        return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      case UploadType.DOCUMENT:
        return [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
      default:
        return [];
    }
  }

  private getUploadPath(uploadType: UploadType): string {
    const baseUploadPath = './uploads';
    switch (uploadType) {
      case UploadType.PROFILE_IMAGE:
        return path.join(baseUploadPath, 'profiles');
      case UploadType.ARTICLE_IMAGE:
        return path.join(baseUploadPath, 'articles');
      case UploadType.DOCUMENT:
        return path.join(baseUploadPath, 'documents');
      default:
        return baseUploadPath;
    }
  }

  async create(createUploadDto: any): Promise<any> {
    // This method would be called from controller
    throw new BadRequestException('Use uploadFile method instead');
  }

  async findAll(): Promise<FileUpload[]> {
    return this.fileUploadRepository.find({
      relations: ['uploadedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<FileUpload> {
    const file = await this.fileUploadRepository.findOne({
      where: { id },
      relations: ['uploadedBy'],
    });

    if (!file) {
      throw new BadRequestException('File not found');
    }

    return file;
  }

  async update(id: number, updateUploadDto: any): Promise<FileUpload> {
    const file = await this.findOne(id);
    Object.assign(file, updateUploadDto);
    return this.fileUploadRepository.save(file);
  }

  async remove(id: number): Promise<void> {
    const file = await this.findOne(id);

    // Delete physical file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    await this.fileUploadRepository.remove(file);
  }
}
