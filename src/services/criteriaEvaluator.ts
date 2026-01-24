/**
 * CoPrompter Criteria Evaluator
 * 
 * Implementasi routing criteria ke evaluator yang tepat sesuai paper (Section 5.2, Step 4):
 * - Measurable: Evaluasi dengan kode deterministik (~0ms)
 * - Layered Measurable: LLM extract section → lalu ukur dengan kode
 * - Descriptive: Full LLM evaluation untuk kualitas
 */

import { GenerativeModel } from '@google/generative-ai';
import { 
  EvaluationCriteria, 
  CriteriaEvaluationResult, 
  CriteriaEvaluationType,
  MeasureFunction,
  ApiData 
} from '../types/api';

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
const VALID_HTTP_STATUS_CODES = [
  100, 101, 102, 103,
  200, 201, 202, 203, 204, 205, 206, 207, 208, 226,
  300, 301, 302, 303, 304, 305, 307, 308,
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 425, 426, 428, 429, 431, 451,
  500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511
];

// ============================================================================
// DEFAULT CRITERIA untuk API Analysis
// ============================================================================

/**
 * Criteria default yang selalu dievaluasi untuk setiap analisis API.
 * Sebagian besar adalah MEASURABLE sehingga dievaluasi dengan kode cepat.
 */
export function getDefaultApiCriteria(): EvaluationCriteria[] {
  return [
    // === MEASURABLE CRITERIA (Fast, Deterministic) ===
    {
      id: 'endpoint_exists',
      question: 'Apakah endpoint path tersedia?',
      groundTruth: true,
      evaluationType: 'measurable',
      measureFunction: 'string_not_empty',
      targetField: 'endpoint'
    },
    {
      id: 'endpoint_starts_with_slash',
      question: 'Apakah endpoint dimulai dengan "/"?',
      groundTruth: '/',
      evaluationType: 'measurable',
      measureFunction: 'regex_match',
      targetField: 'endpoint'
    },
    {
      id: 'endpoints_not_empty',
      question: 'Apakah ada minimal 1 HTTP method yang terdeteksi?',
      groundTruth: true,
      evaluationType: 'measurable',
      measureFunction: 'array_not_empty',
      targetField: 'endpoints'
    },
    {
      id: 'http_methods_valid',
      question: 'Apakah semua HTTP method valid (GET, POST, PUT, DELETE, etc)?',
      groundTruth: true,
      evaluationType: 'measurable',
      measureFunction: 'http_method_valid',
      targetField: 'endpoints[*].method'
    },
    {
      id: 'summary_exists',
      question: 'Apakah setiap endpoint memiliki summary?',
      groundTruth: true,
      evaluationType: 'measurable',
      measureFunction: 'string_not_empty',
      targetField: 'endpoints[*].summary'
    },
    {
      id: 'summary_word_count',
      question: 'Apakah summary memiliki 3-50 kata?',
      groundTruth: [3, 50],
      evaluationType: 'measurable',
      measureFunction: 'word_count',
      targetField: 'endpoints[*].summary'
    },
    {
      id: 'status_codes_valid',
      question: 'Apakah semua response status code valid (100-599)?',
      groundTruth: true,
      evaluationType: 'measurable',
      measureFunction: 'status_code_valid',
      targetField: 'endpoints[*].responseSchema[*].status'
    },
    {
      id: 'issues_severity_valid',
      question: 'Apakah semua issue severity valid (error/warning/info)?',
      groundTruth: true,
      evaluationType: 'measurable',
      measureFunction: 'keyword_presence',
      targetField: 'issues[*].severity'
    },
    
    // === DESCRIPTIVE CRITERIA (Slow, LLM Judge) ===
    {
      id: 'summary_quality',
      question: 'Apakah summary menjelaskan fungsi endpoint dengan jelas?',
      groundTruth: true,
      evaluationType: 'descriptive'
    },
    {
      id: 'issue_recommendation_helpful',
      question: 'Apakah rekomendasi issue dapat ditindaklanjuti dan spesifik?',
      groundTruth: true,
      evaluationType: 'descriptive'
    }
  ];
}

// ============================================================================
// MAIN EVALUATION ROUTER
// ============================================================================

/**
 * Evaluasi semua criteria dan routing ke evaluator yang tepat.
 * Sesuai CoPrompter paper Section 5.2, Step 4.
 */
export async function evaluateAllCriteria(
  data: ApiData,
  criteria: EvaluationCriteria[],
  llmModel?: GenerativeModel
): Promise<CriteriaEvaluationResult[]> {
  const results: CriteriaEvaluationResult[] = [];
  
  // Pisahkan criteria berdasarkan tipe untuk batch processing
  const measurableCriteria = criteria.filter(c => c.evaluationType === 'measurable');
  const layeredCriteria = criteria.filter(c => c.evaluationType === 'layered_measurable');
  const descriptiveCriteria = criteria.filter(c => c.evaluationType === 'descriptive');
  
  console.log(`[Criteria Evaluator] Evaluating ${measurableCriteria.length} measurable, ${layeredCriteria.length} layered, ${descriptiveCriteria.length} descriptive criteria`);

  // ========================================
  // STEP 1: Evaluate Measurable (Fast, ~0ms total)
  // ========================================
  for (const criterion of measurableCriteria) {
    const startTime = Date.now();
    const result = evaluateMeasurable(data, criterion);
    results.push({
      ...result,
      evaluationTime: Date.now() - startTime
    });
  }

  // ========================================
  // STEP 2: Evaluate Layered (LLM extract + Measure)
  // ========================================
  if (layeredCriteria.length > 0 && llmModel) {
    for (const criterion of layeredCriteria) {
      const startTime = Date.now();
      const result = await evaluateLayered(data, criterion, llmModel);
      results.push({
        ...result,
        evaluationTime: Date.now() - startTime
      });
    }
  }

  // ========================================
  // STEP 3: Evaluate Descriptive (Full LLM, slowest)
  // ========================================
  if (descriptiveCriteria.length > 0 && llmModel) {
    // Batch descriptive criteria untuk efisiensi token
    const startTime = Date.now();
    const descriptiveResults = await evaluateDescriptiveBatch(data, descriptiveCriteria, llmModel);
    const timePerCriteria = (Date.now() - startTime) / descriptiveCriteria.length;
    
    for (const result of descriptiveResults) {
      results.push({
        ...result,
        evaluationTime: Math.round(timePerCriteria)
      });
    }
  }

  // Log summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`[Criteria Evaluator] Results: ${passed} passed, ${failed} failed`);

  return results;
}

// ============================================================================
// MEASURABLE EVALUATOR (Deterministic, ~0ms)
// ============================================================================

/**
 * Evaluasi criteria measurable dengan kode deterministik.
 * Tidak menggunakan LLM sama sekali - sangat cepat.
 */
function evaluateMeasurable(
  data: ApiData,
  criterion: EvaluationCriteria
): Omit<CriteriaEvaluationResult, 'evaluationTime'> {
  const { measureFunction, targetField, groundTruth, id } = criterion;
  
  if (!measureFunction || !targetField) {
    return {
      criteriaId: id,
      passed: false,
      evaluationType: 'measurable'
    };
  }

  // Get value from data using targetField path
  const values = getValuesByPath(data, targetField);
  
  let passed = false;
  let actualValue: string | number | boolean | undefined;

  switch (measureFunction) {
    case 'string_not_empty':
      passed = values.every(v => typeof v === 'string' && v.trim().length > 0);
      actualValue = values.length > 0 ? String(values[0]) : undefined;
      break;

    case 'array_not_empty':
      passed = values.every(v => Array.isArray(v) && v.length > 0);
      actualValue = values.length > 0 && Array.isArray(values[0]) ? values[0].length : 0;
      break;

    case 'word_count':
      const wordCounts = values.map(v => typeof v === 'string' ? v.split(/\s+/).filter(w => w).length : 0);
      const [min, max] = groundTruth as [number, number];
      passed = wordCounts.every(count => count >= min && count <= max);
      actualValue = wordCounts.length > 0 ? wordCounts[0] : 0;
      break;

    case 'sentence_count':
      const sentenceCounts = values.map(v => typeof v === 'string' ? v.split(/[.!?]+/).filter(s => s.trim()).length : 0);
      const [minS, maxS] = groundTruth as [number, number];
      passed = sentenceCounts.every(count => count >= minS && count <= maxS);
      actualValue = sentenceCounts.length > 0 ? sentenceCounts[0] : 0;
      break;

    case 'keyword_presence':
      const validKeywords = ['error', 'warning', 'info']; // For severity check
      passed = values.every(v => typeof v === 'string' && validKeywords.includes(v));
      actualValue = values.length > 0 ? String(values[0]) : undefined;
      break;

    case 'http_method_valid':
      passed = values.every(v => typeof v === 'string' && VALID_HTTP_METHODS.includes(v.toUpperCase()));
      actualValue = values.length > 0 ? String(values[0]) : undefined;
      break;

    case 'status_code_valid':
      passed = values.every(v => typeof v === 'number' && v >= 100 && v <= 599);
      actualValue = values.length > 0 ? Number(values[0]) : undefined;
      break;

    case 'field_exists':
      passed = values.length > 0 && values.every(v => v !== undefined && v !== null);
      actualValue = values.length > 0;
      break;

    case 'regex_match':
      const pattern = groundTruth as string;
      passed = values.every(v => typeof v === 'string' && v.startsWith(pattern));
      actualValue = values.length > 0 ? String(values[0]) : undefined;
      break;

    case 'json_structure':
      passed = values.every(v => {
        if (typeof v !== 'string') return false;
        try {
          JSON.parse(v);
          return true;
        } catch {
          return false;
        }
      });
      actualValue = passed;
      break;
  }

  return {
    criteriaId: id,
    passed,
    actualValue,
    expectedValue: groundTruth,
    evaluationType: 'measurable'
  };
}

/**
 * Helper: Extract values from nested object using path notation.
 * Supports: "field", "field.subfield", "field[*].subfield"
 */
function getValuesByPath(obj: any, path: string): any[] {
  const parts = path.split('.');
  let current: any[] = [obj];

  for (const part of parts) {
    const newCurrent: any[] = [];
    
    for (const item of current) {
      if (item === null || item === undefined) continue;

      // Handle array wildcard: field[*]
      const arrayMatch = part.match(/^(.+)\[\*\]$/);
      if (arrayMatch) {
        const fieldName = arrayMatch[1];
        const value = item[fieldName];
        if (Array.isArray(value)) {
          newCurrent.push(...value);
        }
      } else {
        const value = item[part];
        if (value !== undefined) {
          newCurrent.push(value);
        }
      }
    }
    
    current = newCurrent;
  }

  return current;
}

// ============================================================================
// LAYERED EVALUATOR (LLM Extract + Deterministic Measure)
// ============================================================================

/**
 * Evaluasi criteria layered: LLM extract section, lalu ukur dengan kode.
 */
async function evaluateLayered(
  data: ApiData,
  criterion: EvaluationCriteria,
  model: GenerativeModel
): Promise<Omit<CriteriaEvaluationResult, 'evaluationTime'>> {
  const { id, extractPrompt, measureFunction, groundTruth } = criterion;

  if (!extractPrompt) {
    return {
      criteriaId: id,
      passed: false,
      evaluationType: 'layered_measurable'
    };
  }

  try {
    // Step 1: LLM Extract section
    const extractionPrompt = `${extractPrompt}\n\nData:\n${JSON.stringify(data, null, 2)}\n\nExtract ONLY the relevant text/value. No explanation.`;
    const result = await model.generateContent(extractionPrompt);
    const extractedText = result.response.text().trim();

    // Step 2: Measure with deterministic function
    let passed = false;
    let actualValue: string | number | boolean | undefined;

    switch (measureFunction) {
      case 'word_count':
        const wordCount = extractedText.split(/\s+/).filter(w => w).length;
        const [min, max] = groundTruth as [number, number];
        passed = wordCount >= min && wordCount <= max;
        actualValue = wordCount;
        break;
      
      default:
        // Fallback: string not empty check
        passed = extractedText.length > 0;
        actualValue = extractedText;
    }

    return {
      criteriaId: id,
      passed,
      actualValue,
      expectedValue: groundTruth,
      evaluationType: 'layered_measurable'
    };

  } catch (error) {
    console.error(`[Layered Eval] Error for ${id}:`, error);
    return {
      criteriaId: id,
      passed: false,
      evaluationType: 'layered_measurable'
    };
  }
}

// ============================================================================
// DESCRIPTIVE EVALUATOR (Full LLM Judge)
// ============================================================================

/**
 * Batch evaluasi criteria descriptive dengan LLM.
 * Menggabungkan semua criteria dalam satu prompt untuk efisiensi token.
 */
async function evaluateDescriptiveBatch(
  data: ApiData,
  criteria: EvaluationCriteria[],
  model: GenerativeModel
): Promise<Omit<CriteriaEvaluationResult, 'evaluationTime'>[]> {
  if (criteria.length === 0) return [];

  try {
    // Build batch prompt
    const questionsBlock = criteria.map((c, i) => 
      `${i + 1}. [${c.id}] ${c.question}`
    ).join('\n');

    const prompt = `You are evaluating the quality of an API analysis output.

DATA TO EVALUATE:
${JSON.stringify(data, null, 2)}

QUESTIONS (answer YES or NO for each):
${questionsBlock}

RESPOND IN THIS EXACT FORMAT (one answer per line):
1. YES
2. NO
...

ANSWER ONLY YES or NO for each question.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Parse responses
    const lines = responseText.split('\n').filter(l => l.trim());
    const results: Omit<CriteriaEvaluationResult, 'evaluationTime'>[] = [];

    for (let i = 0; i < criteria.length; i++) {
      const criterion = criteria[i];
      const line = lines[i] || '';
      const passed = line.toUpperCase().includes('YES');

      results.push({
        criteriaId: criterion.id,
        passed,
        actualValue: passed ? 'YES' : 'NO',
        expectedValue: criterion.groundTruth,
        evaluationType: 'descriptive'
      });
    }

    return results;

  } catch (error) {
    console.error('[Descriptive Eval] Error:', error);
    // Return all as failed on error
    return criteria.map(c => ({
      criteriaId: c.id,
      passed: false,
      evaluationType: 'descriptive' as CriteriaEvaluationType
    }));
  }
}

// ============================================================================
// QUICK CHECK (untuk fast path)
// ============================================================================

/**
 * Quick check hanya measurable criteria tanpa LLM.
 * Gunakan ini untuk fast path validation.
 */
export function quickMeasurableCheck(data: ApiData): {
  passed: boolean;
  failedCriteria: string[];
  details: CriteriaEvaluationResult[];
} {
  const criteria = getDefaultApiCriteria().filter(c => c.evaluationType === 'measurable');
  const results: CriteriaEvaluationResult[] = [];

  for (const criterion of criteria) {
    const startTime = Date.now();
    const result = evaluateMeasurable(data, criterion);
    results.push({
      ...result,
      evaluationTime: Date.now() - startTime
    });
  }

  const failedCriteria = results.filter(r => !r.passed).map(r => r.criteriaId);
  
  return {
    passed: failedCriteria.length === 0,
    failedCriteria,
    details: results
  };
}
