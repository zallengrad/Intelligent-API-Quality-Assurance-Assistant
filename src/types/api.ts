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

// Individual endpoint/method in a route file
export interface ApiEndpoint {
  method: string;
  summary: string;
  description?: string;
  params: ApiParam[];
  responseSchema: ResponseSchema[];
}

// ============================================================================
// CoPrompter Criteria Evaluation Types
// ============================================================================

/**
 * Tipe evaluasi criteria sesuai paper CoPrompter (Section 5.2, Step 4):
 * - measurable: Dapat dievaluasi dengan kode deterministik (word count, keyword check, etc)
 * - layered_measurable: Perlu LLM untuk extract section, lalu diukur dengan kode
 * - descriptive: Perlu LLM untuk menilai kualitas (tone, clarity, logic, etc)
 */
export type CriteriaEvaluationType = 'measurable' | 'layered_measurable' | 'descriptive';

/**
 * Fungsi pengukuran untuk criteria measurable
 */
export type MeasureFunction = 
  | 'word_count'           // Hitung jumlah kata
  | 'sentence_count'       // Hitung jumlah kalimat
  | 'keyword_presence'     // Cek keberadaan keyword
  | 'http_method_valid'    // Cek HTTP method valid
  | 'status_code_valid'    // Cek HTTP status code valid
  | 'json_structure'       // Cek struktur JSON
  | 'field_exists'         // Cek field tertentu ada
  | 'array_not_empty'      // Cek array tidak kosong
  | 'string_not_empty'     // Cek string tidak kosong
  | 'regex_match';         // Cek regex pattern

/**
 * Evaluation Criteria sesuai paper CoPrompter
 */
export interface EvaluationCriteria {
  id: string;
  question: string;                           // Pertanyaan untuk mengevaluasi criteria
  groundTruth: string | number | [number, number] | boolean;  // Expected value/range
  evaluationType: CriteriaEvaluationType;     // Bagaimana criteria dievaluasi
  measureFunction?: MeasureFunction;          // Untuk measurable: fungsi pengukuran
  targetField?: string;                       // Field yang dicek (e.g., "endpoint", "endpoints[0].method")
  extractPrompt?: string;                     // Untuk layered: prompt untuk extract section
}

/**
 * Hasil evaluasi criteria
 */
export interface CriteriaEvaluationResult {
  criteriaId: string;
  passed: boolean;
  actualValue?: string | number | boolean;
  expectedValue?: string | number | [number, number] | boolean;
  evaluationTime: number;  // ms
  evaluationType: CriteriaEvaluationType;
}

// Complete analysis of a route file (can have multiple methods)
export interface ApiData {
  endpoint: string; // e.g., "/api/users"
  endpoints: ApiEndpoint[]; // All methods: GET, POST, PUT, DELETE, etc.
  issues: SecurityIssue[]; // Security issues for the entire file
  evaluationCriteria?: EvaluationCriteria[];  // Criteria untuk evaluasi output
  criteriaResults?: CriteriaEvaluationResult[]; // Hasil evaluasi criteria
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

