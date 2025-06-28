export interface ApiEndpoint {
  method: string;
  path: string;
  fullPath: string;
  handler: string;
  controller: string;
  description?: string;
  roles?: string[];
  guards?: string[];
  params?: string[];
  body?: string;
  response?: string;
}

export interface ApiController {
  name: string;
  path: string;
  description?: string;
  endpoints: ApiEndpoint[];
}

export interface ApiSpecification {
  controllers: ApiController[];
  totalEndpoints: number;
  lastGenerated: string;
}
