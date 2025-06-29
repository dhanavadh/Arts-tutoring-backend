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
import { Availability } from '../../bookings/entities/availability.entity';
import { Course } from '../../courses/entities/course.entity';

@Entity('teachers')
export class Teacher {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, (user) => user.teacher, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'text' })
  subject: string;

  @Column({
    name: 'hourly_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  hourlyRate: number;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ name: 'years_experience', default: 0 })
  yearsExperience: number;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'availability_schedule', type: 'json', nullable: true })
  availabilitySchedule: any;

  @OneToMany(() => Booking, (booking) => booking.teacher)
  bookings: Booking[];

  @OneToMany(() => Article, (article) => article.teacher)
  articles: Article[];

  @OneToMany(() => Availability, (availability) => availability.teacher)
  availability: Availability[];

  @OneToMany(() => Course, (course) => course.teacher)
  courses: Course[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
