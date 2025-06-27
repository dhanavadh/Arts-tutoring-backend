import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ApiEndpoint, ApiController, ApiSpecification } from './interfaces/api-spec.interface';

@Injectable()
export class ApiDocsService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  async getApiSpecification(): Promise<ApiSpecification> {
    const controllers: ApiController[] = [];
    let totalEndpoints = 0;

    // Get all controllers
    const controllerWrappers = this.discoveryService.getControllers();

    for (const wrapper of controllerWrappers) {
      const { instance, metatype } = wrapper;
      
      if (!instance || !metatype) continue;

      const controllerPath = this.reflector.get(PATH_METADATA, metatype) || '';
      const controllerName = metatype.name;

      // Skip internal NestJS controllers
      if (controllerName.includes('Internal') || controllerName.includes('HealthCheck')) {
        continue;
      }

      const endpoints: ApiEndpoint[] = [];

      // Get all methods from the controller
      const methodNames = this.metadataScanner.getAllMethodNames(instance);

      for (const methodName of methodNames) {
        const methodRef = instance[methodName];
        
        if (!methodRef || typeof methodRef !== 'function') continue;

        // Get HTTP method and path metadata
        const httpMethod = this.reflector.get(METHOD_METADATA, methodRef);
        const methodPath = this.reflector.get(PATH_METADATA, methodRef) || '';

        if (!httpMethod) continue;

        // Get roles and guards
        const roles = this.reflector.get('roles', methodRef) || [];
        const guards = this.reflector.getAll('__guards__', methodRef) || [];

        // Build full path
        const fullPath = `/${controllerPath}${methodPath}`.replace(/\/+/g, '/');

        // Extract parameters from path
        const params = this.extractPathParams(fullPath);

        const endpoint: ApiEndpoint = {
          method: httpMethod.toUpperCase(),
          path: methodPath,
          fullPath,
          handler: methodName,
          controller: controllerName,
          roles: roles.length > 0 ? roles : undefined,
          guards: guards.length > 0 ? guards.map(g => g.name) : undefined,
          params: params.length > 0 ? params : undefined,
        };

        // Add endpoint description based on method name and path
        endpoint.description = this.generateEndpointDescription(endpoint);

        endpoints.push(endpoint);
        totalEndpoints++;
      }

      if (endpoints.length > 0) {
        controllers.push({
          name: controllerName,
          path: controllerPath,
          description: this.generateControllerDescription(controllerName),
          endpoints: endpoints.sort((a, b) => a.fullPath.localeCompare(b.fullPath)),
        });
      }
    }

    return {
      controllers: controllers.sort((a, b) => a.name.localeCompare(b.name)),
      totalEndpoints,
      lastGenerated: new Date().toISOString(),
    };
  }

  private extractPathParams(path: string): string[] {
    const params: string[] = [];
    const matches = path.match(/:([^/]+)/g);
    
    if (matches) {
      matches.forEach(match => {
        params.push(match.substring(1)); // Remove the ':' prefix
      });
    }

    return params;
  }

  private generateEndpointDescription(endpoint: ApiEndpoint): string {
    const { method, handler, controller } = endpoint;
    
    // Generate description based on method name patterns
    if (handler.startsWith('create')) return `Create a new ${this.extractResource(controller)}`;
    if (handler.startsWith('get') && handler.includes('All')) return `Get all ${this.extractResource(controller, true)}`;
    if (handler.startsWith('get') && handler.includes('ById')) return `Get ${this.extractResource(controller)} by ID`;
    if (handler.startsWith('get')) return `Get ${this.extractResource(controller)} information`;
    if (handler.startsWith('update')) return `Update ${this.extractResource(controller)}`;
    if (handler.startsWith('delete')) return `Delete ${this.extractResource(controller)}`;
    if (handler.startsWith('assign')) return `Assign ${this.extractResource(controller)}`;
    if (handler.startsWith('submit')) return `Submit ${this.extractResource(controller)}`;
    if (handler.startsWith('publish')) return `Publish ${this.extractResource(controller)}`;
    if (handler.startsWith('unpublish')) return `Unpublish ${this.extractResource(controller)}`;
    if (handler.includes('login')) return 'User authentication';
    if (handler.includes('register')) return 'User registration';
    if (handler.includes('forgot')) return 'Password reset request';
    if (handler.includes('reset')) return 'Password reset';
    if (handler.includes('verify')) return 'Account verification';
    if (handler.includes('health')) return 'System health check';

    return `${method} operation for ${this.extractResource(controller)}`;
  }

  private generateControllerDescription(controllerName: string): string {
    const resource = this.extractResource(controllerName);
    
    switch (controllerName.toLowerCase()) {
      case 'authcontroller':
        return 'Authentication and authorization endpoints';
      case 'userscontroller':
        return 'User management and profile operations';
      case 'teacherscontroller':
        return 'Teacher-specific operations and management';
      case 'studentscontroller':
        return 'Student-specific operations and management';
      case 'quizzescontroller':
        return 'Quiz creation, assignment, and management';
      case 'bookingscontroller':
        return 'Booking and appointment management';
      case 'articlescontroller':
        return 'Article and content management';
      case 'uploadscontroller':
        return 'File upload and media management';
      case 'admincontroller':
        return 'Administrative operations and system management';
      case 'emailcontroller':
        return 'Email sending and notification services';
      case 'otpcontroller':
        return 'One-time password and verification services';
      case 'healthcontroller':
        return 'System health monitoring and diagnostics';
      default:
        return `${resource} related operations`;
    }
  }

  private extractResource(controllerName: string, plural: boolean = false): string {
    let resource = controllerName.replace('Controller', '').toLowerCase();
    
    if (plural) {
      if (resource.endsWith('s')) return resource;
      if (resource.endsWith('y')) return resource.slice(0, -1) + 'ies';
      return resource + 's';
    }
    
    return resource;
  }
}