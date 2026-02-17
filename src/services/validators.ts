/**
 * Hybrid Validation Module - CoPrompter Pattern
 * 
 * Measurable/Deterministic validators untuk validasi cepat tanpa LLM.
 * Mengurangi latensi dengan memisahkan validasi struktural (kode) dari kualitatif (LLM).
 */

import { ApiData, ApiEndpoint, SecurityIssue, ApiParam, ResponseSchema } from '../types/api';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] as const;
const VALID_SEVERITIES = ['error', 'warning', 'info'] as const;
const VALID_PARAM_LOCATIONS = ['query', 'body', 'header', 'path'] as const;

// ============================================================================
// STEP 1: CLEAN LLM RESPONSE (Deterministik, ~0ms)
// ============================================================================

/**
 * Membersihkan response LLM dari markdown code blocks dan whitespace.
 * @param text - Raw text dari LLM
 * @returns Cleaned text siap untuk JSON.parse
 */
export function cleanLLMResponse(text: string): string {
  let cleaned = text.trim();
  
  // Hapus markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  
  // Hapus karakter non-printable yang kadang muncul dari LLM
  // Gunakan regex yang aman untuk SonarQube: hapus karakter selain printable ASCII, newline, carriage return, dan tab.
  // Printable ASCII: \x20-\x7E
  // Whitespace yang diizinkan: \n (\x0A), \r (\x0D), \t (\x09)
  cleaned = cleaned.replaceAll(/[^\x20-\x7E\n\r\t]/g, '');
  
  return cleaned.trim();
}

// ============================================================================
// STEP 2: PARSE JSON SAFELY (Deterministik, ~0ms)
// ============================================================================

/**
 * Wrapper untuk JSON.parse dengan error handling yang baik.
 * @param text - JSON string untuk di-parse
 * @returns ParseResult dengan data atau error message
 */
export function parseJsonSafely<T>(text: string): ParseResult<T> {
  try {
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    
    // Berikan hint lokasi error jika ada
    const positionMatch = message.match(/position (\d+)/);
    let hint = '';
    if (positionMatch) {
      const pos = Number.parseInt(positionMatch[1], 10);
      const context = text.substring(Math.max(0, pos - 20), pos + 20);
      hint = ` Near: "...${context}..."`;
    }
    
    return { 
      success: false, 
      error: `JSON parsing gagal: ${message}${hint}`
    };
  }
}

// ============================================================================
// STEP 3: VALIDATE STRUCTURE (Deterministik, ~0ms)
// ============================================================================

/**
 * Validasi struktur ApiData secara deterministik.
 * Cek apakah semua field wajib ada dan memiliki tipe yang benar.
 */
export function validateApiDataStructure(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if data is object
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Data harus berupa object'], warnings: [] };
  }

  const obj = data as Record<string, unknown>;

  // Check required field: endpoint
  if (!obj.endpoint) {
    errors.push('Field "endpoint" wajib ada');
  } else if (typeof obj.endpoint !== 'string') {
    errors.push('Field "endpoint" harus string');
  } else if (!obj.endpoint.startsWith('/')) {
    warnings.push('Field "endpoint" sebaiknya dimulai dengan "/"');
  }

  // Check required field: endpoints
  if (!obj.endpoints) {
    errors.push('Field "endpoints" wajib ada');
  } else if (!Array.isArray(obj.endpoints)) {
    errors.push('Field "endpoints" harus array');
  } else if (obj.endpoints.length === 0) {
    warnings.push('Array "endpoints" kosong, tidak ada method yang terdeteksi');
  } else {
    // Validate each endpoint
    obj.endpoints.forEach((ep, index) => {
      const epErrors = validateEndpoint(ep, index);
      errors.push(...epErrors.errors);
      warnings.push(...epErrors.warnings);
    });
  }

  // Check required field: issues
  if (!obj.issues) {
    errors.push('Field "issues" wajib ada');
  } else if (!Array.isArray(obj.issues)) {
    errors.push('Field "issues" harus array');
  } else {
    // Validate each issue
    obj.issues.forEach((issue, index) => {
      const issueErrors = validateSecurityIssue(issue, index);
      errors.push(...issueErrors.errors);
      warnings.push(...issueErrors.warnings);
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate individual endpoint structure
 */
function validateEndpoint(ep: unknown, index: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `endpoints[${index}]`;

  if (!ep || typeof ep !== 'object') {
    return { valid: false, errors: [`${prefix} harus berupa object`], warnings: [] };
  }

  const endpoint = ep as Record<string, unknown>;

  // Check method
  if (!endpoint.method) {
    errors.push(`${prefix}.method wajib ada`);
  } else if (typeof endpoint.method !== 'string') {
    errors.push(`${prefix}.method harus string`);
  } else if (!VALID_HTTP_METHODS.includes(endpoint.method.toUpperCase() as any)) {
    warnings.push(`${prefix}.method "${endpoint.method}" bukan HTTP method standar`);
  }

  // Check summary
  if (!endpoint.summary) {
    errors.push(`${prefix}.summary wajib ada`);
  } else if (typeof endpoint.summary !== 'string') {
    errors.push(`${prefix}.summary harus string`);
  } else if (endpoint.summary.length < 5) {
    warnings.push(`${prefix}.summary terlalu pendek`);
  }

  // Check params (optional but must be array if exists)
  if (endpoint.params !== undefined) {
    if (!Array.isArray(endpoint.params)) {
      errors.push(`${prefix}.params harus array`);
    } else {
      endpoint.params.forEach((param, pIndex) => {
        const paramErrors = validateParam(param, `${prefix}.params[${pIndex}]`);
        errors.push(...paramErrors.errors);
        warnings.push(...paramErrors.warnings);
      });
    }
  }

  // Check responseSchema (optional but must be array if exists)
  if (endpoint.responseSchema !== undefined) {
    if (!Array.isArray(endpoint.responseSchema)) {
      errors.push(`${prefix}.responseSchema harus array`);
    } else {
      endpoint.responseSchema.forEach((resp, rIndex) => {
        const respErrors = validateResponseSchema(resp, `${prefix}.responseSchema[${rIndex}]`);
        errors.push(...respErrors.errors);
        warnings.push(...respErrors.warnings);
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate parameter structure
 */
function validateParam(param: unknown, prefix: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!param || typeof param !== 'object') {
    return { valid: false, errors: [`${prefix} harus berupa object`], warnings: [] };
  }

  const p = param as Record<string, unknown>;

  if (!p.name || typeof p.name !== 'string') {
    errors.push(`${prefix}.name wajib ada dan harus string`);
  }

  if (!p.type || typeof p.type !== 'string') {
    errors.push(`${prefix}.type wajib ada dan harus string`);
  }

  if (typeof p.required !== 'boolean') {
    warnings.push(`${prefix}.required sebaiknya boolean`);
  }

  if (p.location && !VALID_PARAM_LOCATIONS.includes(p.location as any)) {
    warnings.push(`${prefix}.location "${p.location}" bukan lokasi valid`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate response schema structure
 */
function validateResponseSchema(resp: unknown, prefix: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!resp || typeof resp !== 'object') {
    return { valid: false, errors: [`${prefix} harus berupa object`], warnings: [] };
  }

  const r = resp as Record<string, unknown>;

  if (typeof r.status !== 'number') {
    errors.push(`${prefix}.status wajib ada dan harus number`);
  } else if (r.status < 100 || r.status > 599) {
    warnings.push(`${prefix}.status ${r.status} bukan HTTP status code valid`);
  }

  if (!r.contentType || typeof r.contentType !== 'string') {
    warnings.push(`${prefix}.contentType sebaiknya ada`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate security issue structure
 */
function validateSecurityIssue(issue: unknown, index: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `issues[${index}]`;

  if (!issue || typeof issue !== 'object') {
    return { valid: false, errors: [`${prefix} harus berupa object`], warnings: [] };
  }

  const i = issue as Record<string, unknown>;

  if (!i.severity || !VALID_SEVERITIES.includes(i.severity as any)) {
    errors.push(`${prefix}.severity harus salah satu dari: ${VALID_SEVERITIES.join(', ')}`);
  }

  if (!i.title || typeof i.title !== 'string') {
    errors.push(`${prefix}.title wajib ada dan harus string`);
  }

  if (!i.description || typeof i.description !== 'string') {
    errors.push(`${prefix}.description wajib ada dan harus string`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// STEP 4: ENSURE COMPLETE STRUCTURE (Auto-fix minor issues)
// ============================================================================

/**
 * Memastikan struktur data lengkap dengan default values.
 * Memperbaiki minor issues tanpa perlu retry ke LLM.
 */
export function ensureCompleteStructure(data: Record<string, unknown>): ApiData {
  return {
    endpoint: (data.endpoint as string) || '/api/unknown',
    endpoints: Array.isArray(data.endpoints) 
      ? data.endpoints.map(ensureEndpointComplete) 
      : [],
    issues: Array.isArray(data.issues) 
      ? data.issues.map(ensureIssueComplete) 
      : [],
    timestamp: new Date().toISOString()
  };
}

function ensureEndpointComplete(ep: unknown): ApiEndpoint {
  const endpoint = (ep || {}) as Record<string, unknown>;
  return {
    method: (endpoint.method as string)?.toUpperCase() || 'GET',
    summary: (endpoint.summary as string) || 'Tidak ada ringkasan',
    description: endpoint.description as string | undefined,
    params: Array.isArray(endpoint.params) 
      ? endpoint.params.map(ensureParamComplete) 
      : [],
    responseSchema: Array.isArray(endpoint.responseSchema)
      ? endpoint.responseSchema.map(ensureResponseComplete)
      : []
  };
}

function ensureParamComplete(param: unknown): ApiParam {
  const p = (param || {}) as Record<string, unknown>;
  return {
    name: (p.name as string) || 'unnamed',
    type: (p.type as string) || 'string',
    required: Boolean(p.required),
    description: (p.description as string) || '',
    location: VALID_PARAM_LOCATIONS.includes(p.location as any) 
      ? (p.location as ApiParam['location']) 
      : 'query'
  };
}

function ensureResponseComplete(resp: unknown): ResponseSchema {
  const r = (resp || {}) as Record<string, unknown>;
  return {
    status: typeof r.status === 'number' ? r.status : 200,
    contentType: (r.contentType as string) || 'application/json',
    schema: (r.schema as string) || '{}',
    example: r.example as string | undefined
  };
}

function ensureIssueComplete(issue: unknown): SecurityIssue {
  const i = (issue || {}) as Record<string, unknown>;
  return {
    severity: VALID_SEVERITIES.includes(i.severity as any) 
      ? (i.severity as SecurityIssue['severity']) 
      : 'info',
    title: (i.title as string) || 'Unknown Issue',
    description: (i.description as string) || 'Tidak ada deskripsi',
    recommendation: i.recommendation as string | undefined
  };
}
