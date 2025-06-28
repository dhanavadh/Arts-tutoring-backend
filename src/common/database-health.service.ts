import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class DatabaseHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseHealthService.name);
  private healthCheckInterval?: NodeJS.Timeout;
  private isReconnecting = false;
  private lastHealthStatus = false;
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 5;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // Initial health check
    await this.performHealthCheck();

    // Start periodic health checks (every 30 seconds)
    this.startPeriodicHealthChecks();
  }

  async onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  private startPeriodicHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isReconnecting) {
        await this.performHealthCheck();
      }
    }, 30000); // Check every 30 seconds
  }

  async checkDatabaseConnection(): Promise<boolean> {
    return await this.performHealthCheck();
  }

  private async performHealthCheck(): Promise<boolean> {
    try {
      // Quick check if DataSource is available
      if (!this.dataSource) {
        this.logger.error('DataSource is not available');
        return false;
      }

      // Check if connection is initialized
      if (!this.dataSource.isInitialized) {
        this.logger.warn('Database connection is not initialized');
        this.lastHealthStatus = false;
        this.consecutiveFailures++;
        return false;
      }

      // Perform simple health check with timeout
      const result = await this.executeWithTimeout(
        () => this.dataSource.query('SELECT 1 as health'),
        3000, // 3 second timeout
      );

      if (result && result[0]?.health === 1) {
        // Health check passed
        if (!this.lastHealthStatus) {
          this.logger.log('Database connection restored');
        }
        this.lastHealthStatus = true;
        this.consecutiveFailures = 0;
        return true;
      } else {
        throw new Error('Health check query returned unexpected result');
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.lastHealthStatus = false;
      this.consecutiveFailures++;

      // Log error with appropriate level based on failure count
      if (this.consecutiveFailures <= 2) {
        this.logger.warn(
          `Database health check failed (attempt ${this.consecutiveFailures}): ${errorMessage}`,
        );
      } else {
        this.logger.error(
          `Database health check failed (attempt ${this.consecutiveFailures}): ${errorMessage}`,
        );
      }

      // Don't attempt reconnection for now - just track the failure
      return false;
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
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
    consecutiveFailures?: number;
    uptimePercent?: number;
  }> {
    const startTime = Date.now();
    const options = this.dataSource.options;

    try {
      const isHealthy = await this.performHealthCheck();
      const responseTime = Date.now() - startTime;

      // Determine status based on consecutive failures
      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      if (!isHealthy) {
        status =
          this.consecutiveFailures > this.maxConsecutiveFailures
            ? 'unhealthy'
            : 'degraded';
      }

      return {
        status,
        isConnected: this.dataSource?.isInitialized && isHealthy,
        driver: this.dataSource?.driver?.constructor.name || 'unknown',
        database:
          typeof options === 'object' && options && 'database' in options
            ? String(options.database)
            : 'unknown',
        host:
          typeof options === 'object' && options && 'host' in options
            ? String(options.host)
            : 'unknown',
        responseTime,
        lastChecked: new Date().toISOString(),
        consecutiveFailures: this.consecutiveFailures,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        status: 'unhealthy',
        isConnected: false,
        driver: this.dataSource?.driver?.constructor.name || 'unknown',
        database:
          typeof options === 'object' && options && 'database' in options
            ? String(options.database)
            : 'unknown',
        host:
          typeof options === 'object' && options && 'host' in options
            ? String(options.host)
            : 'unknown',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: errorMessage,
        consecutiveFailures: this.consecutiveFailures,
      };
    }
  }

  getConnectionStatus(): {
    isConnected: boolean;
    driver: string;
    database: string;
    host: string;
    consecutiveFailures: number;
    lastHealthCheck: boolean;
  } {
    const options = this.dataSource?.options;
    return {
      isConnected: this.dataSource?.isInitialized || false,
      driver: this.dataSource?.driver?.constructor.name || 'unknown',
      database:
        typeof options === 'object' && options && 'database' in options
          ? String(options.database)
          : 'unknown',
      host:
        typeof options === 'object' && options && 'host' in options
          ? String(options.host)
          : 'unknown',
      consecutiveFailures: this.consecutiveFailures,
      lastHealthCheck: this.lastHealthStatus,
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
        // Check if we should even attempt the operation
        if (this.consecutiveFailures > this.maxConsecutiveFailures) {
          throw new Error('Database is unhealthy, skipping operation');
        }

        // Don't check connection health on every retry - it's too expensive
        // Just try the operation and let it fail naturally
        return await this.executeWithTimeout(operation, 5000);
      } catch (error: unknown) {
        const errorObj =
          error instanceof Error ? error : new Error('Unknown error');
        lastError = errorObj;

        // Only log on first attempt to reduce spam
        if (attempt === 1) {
          this.logger.warn(
            `Database operation failed, will retry ${maxRetries - 1} more times: ${errorObj.message}`,
          );
        }

        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const backoffDelay =
            delay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    this.logger.error(
      `Database operation failed after ${maxRetries} attempts: ${lastError?.message}`,
    );
    throw lastError || new Error('Database operation failed after retries');
  }

  /**
   * Get database metrics for monitoring
   */
  getMetrics() {
    return {
      consecutiveFailures: this.consecutiveFailures,
      lastHealthStatus: this.lastHealthStatus,
      isInitialized: this.dataSource?.isInitialized || false,
      hasHealthCheckInterval: !!this.healthCheckInterval,
      isReconnecting: this.isReconnecting,
    };
  }

  /**
   * Force a health check (useful for testing or manual triggers)
   */
  async forceHealthCheck(): Promise<boolean> {
    this.logger.log('Forcing health check...');
    return await this.performHealthCheck();
  }
}
