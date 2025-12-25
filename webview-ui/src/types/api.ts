export interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  location: 'query' | 'body' | 'header' | 'path';
}

export interface SecurityIssue {
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation?: string;
}

export interface ResponseSchema {
  status: number;
  contentType: string;
  schema: string;
  example?: string;
}

export interface ApiHeader {
  name: string;
  required: boolean;
  description: string;
  example?: string;
}

export interface RequestBodySchema {
  contentType: string;
  required: boolean;
  schema: string;
  example?: string;
}

// Individual endpoint/method in a route file
export interface ApiEndpoint {
  method: string;
  summary: string;
  description?: string;
  params: ApiParam[];
  headers?: ApiHeader[]; // Optional: Header requirements
  requestBody?: RequestBodySchema; // Optional: Request body schema
  responseSchema: ResponseSchema[];
}

// Complete analysis of a route file (can have multiple methods)
export interface ApiData {
  endpoint: string; // e.g., "/api/users"
  endpoints: ApiEndpoint[]; // All methods: GET, POST, PUT, DELETE, etc.
  issues: SecurityIssue[]; // Security issues for the entire file
  timestamp?: string;
}

// Project-wide API scanning types
export interface ProjectApiData {
  filePath: string;
  relativePath: string;
  apiData: ApiData;
}

export interface ProjectScanResult {
  totalFiles: number;
  totalEndpoints: number;
  apis: ProjectApiData[];
  timestamp: string;
}

