import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ApiDocsService } from './api-docs.service';
import { ApiSpecification } from './interfaces/api-spec.interface';

@Controller('api-docs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiDocsController {
  constructor(private readonly apiDocsService: ApiDocsService) {}

  @Get('specification')
  @Roles(UserRole.ADMIN)
  async getApiSpecification(): Promise<ApiSpecification> {
    return await this.apiDocsService.getApiSpecification();
  }

  @Get('openapi')
  @Roles(UserRole.ADMIN)
  async getOpenApiSpec() {
    const spec = await this.apiDocsService.getApiSpecification();

    // Convert to OpenAPI 3.0 format
    return {
      openapi: '3.0.0',
      info: {
        title: 'Arts Tutoring API',
        description: 'API documentation for the Arts Tutoring platform',
        version: '1.0.0',
        contact: {
          name: 'Arts Tutoring Development Team',
        },
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Development server',
        },
      ],
      paths: this.buildOpenApiPaths(spec.controllers),
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    };
  }

  private buildOpenApiPaths(controllers: any[]) {
    const paths = {};

    controllers.forEach((controller) => {
      controller.endpoints.forEach((endpoint) => {
        if (!paths[endpoint.fullPath]) {
          paths[endpoint.fullPath] = {};
        }

        paths[endpoint.fullPath][endpoint.method.toLowerCase()] = {
          summary: endpoint.description,
          tags: [controller.name.replace('Controller', '')],
          security: endpoint.roles ? [{ bearerAuth: [] }] : [],
          parameters: endpoint.params
            ? endpoint.params.map((param) => ({
                name: param,
                in: 'path',
                required: true,
                schema: { type: 'string' },
              }))
            : [],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { type: 'object' },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
            },
            '403': {
              description: 'Forbidden',
            },
            '404': {
              description: 'Not found',
            },
          },
        };
      });
    });

    return paths;
  }
}
