import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum UploadType {
  PROFILE_IMAGE = 'profile_image',
  ARTICLE_IMAGE = 'article_image',
  DOCUMENT = 'document',
}

@Entity('file_uploads')
export class FileUpload {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  filename: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column()
  mimetype: string;

  @Column()
  size: number;

  @Column()
  path: string;

  @ManyToOne(() => User)
  uploadedBy: User;

  @Column({ name: 'uploaded_by' })
  uploadedById: number;

  @Column({ type: 'enum', enum: UploadType, name: 'upload_type' })
  uploadType: UploadType;

  @Column({ name: 'entity_id', nullable: true })
  entityId: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
