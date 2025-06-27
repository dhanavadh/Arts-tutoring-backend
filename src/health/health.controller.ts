import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { DatabaseHealthService } from '../common/database-health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly databaseHealthService: DatabaseHealthService) {}

  // Public endpoint for basic health check
  @Get()
  async getBasicHealth() {
    try {
      const isHealthy = await this.databaseHealthService.checkDatabaseConnection();
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'arts-tutoring-api',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'arts-tutoring-api',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Public endpoint for database status
  @Get('database')
  async getDatabaseHealth() {
    try {
      const health = await this.databaseHealthService.getHealthStatus();
      // Return limited info for public endpoint
      return {
        status: health.status,
        isConnected: health.isConnected,
        responseTime: health.responseTime,
        lastChecked: health.lastChecked,
        database: health.database,
        host: health.host,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        isConnected: false,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Protected endpoint for detailed system health (admin only)
  @Get('system')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getSystemHealth() {
    const databaseHealth = await this.databaseHealthService.getHealthStatus();
    
    return {
      status: databaseHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.version,
      memoryUsage: process.memoryUsage(),
      database: databaseHealth,
    };
  }

  // Protected endpoint for detailed database health (admin only)
  @Get('admin/database')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getDetailedDatabaseHealth() {
    return await this.databaseHealthService.getHealthStatus();
  }
}