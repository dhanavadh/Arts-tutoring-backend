import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Article } from '../../articles/entities/article.entity';

@Entity('teachers')
export class Teacher {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, (user) => user.teacher)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  subject: string;

  @Column({ name: 'hourly_rate', type: 'decimal', precision: 10, scale: 2 })
  hourlyRate: number;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ name: 'years_experience', default: 0 })
  yearsExperience: number;

  @Column({ type: 'json', nullable: true })
  qualifications: string[];

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'availability_schedule', type: 'json', nullable: true })
  availabilitySchedule: any;

  @OneToMany(() => Booking, (booking) => booking.teacher)
  bookings: Booking[];

  @OneToMany(() => Article, (article) => article.teacher)
  articles: Article[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
