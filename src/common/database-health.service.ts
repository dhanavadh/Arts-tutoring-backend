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
      // Check if data source is destroyed or not initialized
      if (!this.dataSource.isInitialized) {
        this.logger.warn('Database connection not initialized, attempting to connect...');
        try {
          await this.dataSource.initialize();
          this.logger.log('Database connection established successfully');
        } catch (initError) {
          this.logger.error('Failed to initialize database connection:', initError);
          return false;
        }
      }

      // Simple health check query with timeout
      const queryPromise = this.dataSource.query('SELECT 1');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 5000)
      );
      
      await Promise.race([queryPromise, timeoutPromise]);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Database health check failed:', errorMessage);

      // Only attempt reconnection if it's a timeout or connection error
      if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('Pool is closed') || errorMessage.includes('timeout')) {
        return await this.attemptReconnection();
      }
      
      return false;
    }
  }

  private async attemptReconnection(): Promise<boolean> {
    try {
      this.logger.warn('Attempting database reconnection...');
      
      // Safely destroy existing connection if it exists
      if (this.dataSource.isInitialized) {
        try {
          await this.dataSource.destroy();
          this.logger.log('Previous connection destroyed');
        } catch (destroyError) {
          this.logger.warn('Error destroying previous connection:', destroyError);
        }
      }

      // Wait a moment before reconnecting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Initialize new connection
      await this.dataSource.initialize();
      this.logger.log('Database reconnection successful');
      
      // Test the new connection
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (reconnectError: unknown) {
      const reconnectErrorMessage = reconnectError instanceof Error ? reconnectError.message : 'Unknown error';
      this.logger.error('Database reconnection failed:', reconnectErrorMessage);
      return false;
    }
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    isConnected: boolean;
    driver: string;
    database: string;
    host: string;
    responseTime?: number;
    lastChecked: string;
    error?: string;
  }> {
    const startTime = Date.now();
    const options = this.dataSource.options;
    
    try {
      const isHealthy = await this.checkDatabaseConnection();
      const responseTime = Date.now() - startTime;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        isConnected: this.dataSource.isInitialized && isHealthy,
        driver: this.dataSource.driver?.constructor.name || 'unknown',
        database: typeof options === 'object' && options && 'database' in options ? String(options.database) : 'unknown',
        host: typeof options === 'object' && options && 'host' in options ? String(options.host) : 'unknown',
        responseTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        status: 'unhealthy',
        isConnected: false,
        driver: this.dataSource.driver?.constructor.name || 'unknown',
        database: typeof options === 'object' && options && 'database' in options ? String(options.database) : 'unknown',
        host: typeof options === 'object' && options && 'host' in options ? String(options.host) : 'unknown',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: errorMessage,
      };
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
      driver: this.dataSource.driver?.constructor.name || 'unknown',
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
