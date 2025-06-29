import './env.config'; // Load environment variables first
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_teacher_system',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false, // Temporarily disabled to avoid schema sync issues
  logging: process.env.NODE_ENV === 'development',
  timezone: '+00:00',
  charset: 'utf8mb4',
  // Connection pool configuration
  extra: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    idleTimeout: 300000, // 5 minutes
  },
  // Retry configuration
  retryAttempts: 3,
  retryDelay: 3000,
  // Query timeout
  maxQueryExecutionTime: 30000, // 30 seconds
};
