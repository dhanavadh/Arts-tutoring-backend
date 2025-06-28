import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Teacher } from '../../teachers/entities/teacher.entity';

@Entity('availability')
export class Availability {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Teacher, (teacher) => teacher.availability)
  teacher: Teacher;

  @Column({ name: 'teacher_id' })
  teacherId: number;

  @Column({ name: 'day_of_week' })
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.

  @Column({ name: 'start_time', type: 'time' })
  startTime: string; // HH:mm format

  @Column({ name: 'end_time', type: 'time' })
  endTime: string; // HH:mm format

  @Column({ name: 'slot_duration', default: 60 })
  slotDuration: number; // Duration in minutes

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: Date; // When this availability starts

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date | null; // When this availability ends (null = no expiry)

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}