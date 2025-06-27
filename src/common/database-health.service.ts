import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class DatabaseHealthService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseHealthService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.checkDatabaseConnection();
  }

  async checkDatabaseConnection(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        this.logger.warn(
          'Database connection lost, attempting to reconnect...',
        );
        await this.dataSource.initialize();
        this.logger.log('Database reconnection successful');
      }

      // Simple health check query
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Database health check failed:', errorMessage);

      // Attempt to reconnect
      try {
        if (this.dataSource.isInitialized) {
          await this.dataSource.destroy();
        }
        await this.dataSource.initialize();
        this.logger.log('Database reconnection after failure successful');
        return true;
      } catch (reconnectError: unknown) {
        const reconnectErrorMessage = reconnectError instanceof Error ? reconnectError.message : 'Unknown error';
        this.logger.error('Database reconnection failed:', reconnectErrorMessage);
        return false;
      }
    }
  }

  getConnectionStatus(): {
    isConnected: boolean;
    driver: string;
    database: string;
    host: string;
  } {
    const options = this.dataSource.options;
    return {
      isConnected: this.dataSource.isInitialized,
      driver: this.dataSource.driver.constructor.name,
      database: typeof options === 'object' && options && 'database' in options ? String(options.database) : 'unknown',
      host: typeof options === 'object' && options && 'host' in options ? String(options.host) : 'unknown',
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Ensure connection is healthy before executing
        await this.checkDatabaseConnection();
        return await operation();
      } catch (error: unknown) {
        const errorObj = error instanceof Error ? error : new Error('Unknown error');
        lastError = errorObj;
        this.logger.warn(
          `Database operation failed on attempt ${attempt}/${maxRetries}: ${errorObj.message}`,
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
      }
    }

    throw lastError || new Error('Database operation failed after retries');
  }
}
