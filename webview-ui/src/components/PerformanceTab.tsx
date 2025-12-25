import { Card, Text, Stack, Title, Badge, Button, Select, Alert, Group, NumberInput, Textarea, Progress, Divider, SimpleGrid } from '@mantine/core';
import { IconRocket, IconAlertCircle, IconClock, IconCheck, IconX } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { ApiData } from '../types/api';
import { getVsCodeApi, isVsCodeApiAvailable } from '../utils/vscodeApi';

interface PerformanceTabProps {
  apiData: ApiData;
}

interface LoadTestConfig {
  endpoint: string;
  method: string;
  concurrency: number;
  totalRequests: number;
  body: string;
}

interface LoadTestProgress {
  progress: number;
  completed: number;
  total: number;
  successCount: number;
  errorCount: number;
}

interface LoadTestResult {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  duration: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  rps: number;
  successRate: number;
}

interface AIInsight {
  grade: string;
  gradeColor: string;
  findings: string[];
  recommendations: string[];
  bottlenecks: string[];
}

function PerformanceTab({ apiData }: PerformanceTabProps) {
  const [selectedMethod, setSelectedMethod] = useState(apiData.endpoints[0]?.method || 'GET');
  const [concurrency, setConcurrency] = useState(10);
  const [totalRequests, setTotalRequests] = useState(50);
  const [requestBody, setRequestBody] = useState('{\n  \n}');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<LoadTestProgress | null>(null);
  const [result, setResult] = useState<LoadTestResult | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [apiError, setApiError] = useState<string>('');
  const [aiInsights, setAiInsights] = useState<AIInsight | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && startTime > 0) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, startTime]);

  // Listen for messages from extension
  useEffect(() => {
    console.log('[PerformanceTab] Component mounted, listening for messages');

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('[PerformanceTab] Received message:', message);

      if (message.type === 'load-test-progress') {
        console.log('[PerformanceTab] Progress update:', message);
        setProgress({
          progress: message.progress,
          completed: message.completed,
          total: message.total,
          successCount: message.successCount,
          errorCount: message.errorCount,
        });
      } else if (message.type === 'load-test-result') {
        console.log('[PerformanceTab] Test completed:', message.results);
        setResult(message.results);
        setIsRunning(false);
        
        // Request AI insights automatically
        requestAIInsights(message.results);
      } else if (message.type === 'ai-performance-insights') {
        console.log('[PerformanceTab] AI Insights received:', message.insights);
        setAiInsights(message.insights);
        setIsLoadingInsights(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      console.log('[PerformanceTab] Component unmounting');
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const startLoadTest = () => {
    console.log('[PerformanceTab] Starting load test');
    
    // Check if VS Code API is available
    if (!isVsCodeApiAvailable()) {
      console.error('[PerformanceTab] VS Code API not available!');
      setApiError('VS Code API tidak tersedia. Extension mungkin tidak running dengan benar. Silakan reload webview.');
      return;
    }

    setApiError(''); // Clear any previous errors
    setIsRunning(true);
    setProgress(null);
    setResult(null);
    setStartTime(Date.now());
    setElapsedTime(0);

    const config: LoadTestConfig = {
      endpoint: apiData.endpoint,
      method: selectedMethod,
      concurrency,
      totalRequests,
      body: requestBody,
    };

    console.log('[PerformanceTab] Config:', config);

    const vscode = getVsCodeApi();
    if (vscode) {
      vscode.postMessage({
        type: 'run-load-test',
        config,
      });
      console.log('[PerformanceTab] Message sent to extension');
    }
  };

  const requestAIInsights = (testResult: LoadTestResult) => {
    console.log('[PerformanceTab] Requesting AI insights...');
    setIsLoadingInsights(true);
    setAiInsights(null);

    const vscode = getVsCodeApi();
    if (vscode) {
      vscode.postMessage({
        type: 'analyze-performance',
        results: testResult,
        config: {
          endpoint: apiData.endpoint,
          method: selectedMethod,
          concurrency,
          totalRequests,
        },
      });
    } else {
      setIsLoadingInsights(false);
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusColor = (successRate: number) => {
    if (successRate >= 95) return 'green';
    if (successRate >= 80) return 'yellow';
    return 'red';
  };

  return (
    <Stack gap="md">
      {/* API Error Alert */}
      {apiError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error" withCloseButton onClose={() => setApiError('')}>
          <Text size="sm">{apiError}</Text>
        </Alert>
      )}

      {/* Configuration Card */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={5} mb="md">
          Load Test Configuration
        </Title>

        <Stack gap="md">
          {/* Endpoint & Method */}
          <Group gap="sm" grow>
            <Select
              label="HTTP Method"
              value={selectedMethod}
              onChange={(value) => setSelectedMethod(value || 'GET')}
              data={apiData.endpoints.map(e => ({ value: e.method, label: e.method }))}
              disabled={isRunning}
            />
            <Text size="sm" mt="xl" c="dimmed" style={{ fontFamily: 'monospace' }}>
              {apiData.endpoint}
            </Text>
          </Group>

          {/* Concurrency & Total Requests */}
          <SimpleGrid cols={2}>
            <NumberInput
              label="Concurrency (Virtual Users)"
              description="Number of parallel requests"
              value={concurrency}
              onChange={(value) => setConcurrency(Number(value))}
              min={1}
              max={100}
              disabled={isRunning}
            />
            <NumberInput
              label="Total Requests"
              description="Total number of requests to send"
              value={totalRequests}
              onChange={(value) => setTotalRequests(Number(value))}
              min={10}
              max={1000}
              disabled={isRunning}
            />
          </SimpleGrid>

          {/* Request Body for POST/PUT/PATCH */}
          {['POST', 'PUT', 'PATCH'].includes(selectedMethod.toUpperCase()) && (
            <Textarea
              label="Request Body (JSON)"
              value={requestBody}
              onChange={(e) => setRequestBody(e.currentTarget.value)}
              minRows={4}
              placeholder='{\n  "key": "value"\n}'
              styles={{ input: { fontFamily: 'monospace', fontSize: '13px' } }}
              disabled={isRunning}
            />
          )}

          {/* Warning */}
          {(concurrency > 50 || totalRequests > 500) && (
            <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
              <Text size="sm">
                High concurrency or request count may impact performance. Use with caution.
              </Text>
            </Alert>
          )}

          {/* Start Button */}
          <Button
            variant="filled"
            onClick={startLoadTest}
            loading={isRunning}
            disabled={isRunning}
            color="blue"
            size="md"
            leftSection={<IconRocket size={18} />}
            fullWidth
          >
            {isRunning ? 'Running Load Test...' : 'Start Load Test'}
          </Button>
        </Stack>
      </Card>

      {/* Progress Display */}
      {isRunning && progress && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={5}>Test Progress</Title>
            <Badge leftSection={<IconClock size={14} />} color="gray" variant="light">
              {formatTime(elapsedTime)}
            </Badge>
          </Group>

          <Stack gap="md">
            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  {progress.completed} / {progress.total} requests
                </Text>
                <Text size="sm" c="dimmed">
                  {progress.progress.toFixed(1)}%
                </Text>
              </Group>
              <Progress value={progress.progress} size="xl" radius="md" striped animated />
            </div>

            <SimpleGrid cols={2}>
              <Group gap="xs">
                <IconCheck size={18} color="green" />
                <div>
                  <Text size="xs" c="dimmed">Success</Text>
                  <Text size="lg" fw={600}>{progress.successCount}</Text>
                </div>
              </Group>
              <Group gap="xs">
                <IconX size={18} color="red" />
                <div>
                  <Text size="xs" c="dimmed">Errors</Text>
                  <Text size="lg" fw={600}>{progress.errorCount}</Text>
                </div>
              </Group>
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      {/* Results Display */}
      {result && !isRunning && (
        <>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={5} mb="md">
              Test Results
            </Title>

            <Stack gap="md">
              {/* Summary Stats */}
              <SimpleGrid cols={2}>
                <div>
                  <Text size="xs" c="dimmed">Total Duration</Text>
                  <Text size="xl" fw={600}>{formatTime(result.duration)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Requests per Second</Text>
                  <Text size="xl" fw={600}>{result.rps.toFixed(2)}</Text>
                </div>
              </SimpleGrid>

              <Divider />

              {/* Latency Metrics */}
              <div>
                <Text size="sm" fw={500} mb="sm">Latency Metrics</Text>
                <SimpleGrid cols={3}>
                  <div>
                    <Text size="xs" c="dimmed">Average</Text>
                    <Text size="lg" fw={600}>{result.avgLatency.toFixed(2)}ms</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Min</Text>
                    <Text size="lg" fw={600}>{result.minLatency.toFixed(2)}ms</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Max</Text>
                    <Text size="lg" fw={600}>{result.maxLatency.toFixed(2)}ms</Text>
                  </div>
                </SimpleGrid>
              </div>

              <Divider />

              {/* Success Rate */}
              <div>
                <Text size="sm" fw={500} mb="sm">Success Rate</Text>
                <Group justify="space-between" mb="xs">
                  <div>
                    <Badge color="green" size="lg" leftSection={<IconCheck size={14} />}>
                      {result.successCount} Success
                    </Badge>
                    <Badge color="red" size="lg" ml="xs" leftSection={<IconX size={14} />}>
                      {result.errorCount} Errors
                    </Badge>
                  </div>
                  <Badge color={getStatusColor(result.successRate)} size="xl" variant="filled">
                    {result.successRate.toFixed(1)}%
                  </Badge>
                </Group>
                <Progress
                  value={result.successRate}
                  size="lg"
                  radius="md"
                  color={getStatusColor(result.successRate)}
                />
              </div>
            </Stack>
          </Card>

          {/* Summary Card */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="sm" c="dimmed">
              Completed {result.totalRequests} requests with {concurrency} concurrent users 
              in {formatTime(result.duration)}. Average latency: {result.avgLatency.toFixed(2)}ms.
            </Text>
          </Card>

          {/* AI Performance Insights Card */}
          {isLoadingInsights && (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group gap="xs" mb="md">
                <Text size="lg" fw={600}>🤖 Analisis Performa AI</Text>
                <Badge color="blue" variant="light">Sedang menganalisis...</Badge>
              </Group>
              <Stack gap="xs">
                <div style={{ height: '20px', background: '#f0f0f0', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ height: '20px', background: '#f0f0f0', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
                <div style={{ height: '20px', background: '#f0f0f0', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.4s' }} />
              </Stack>
            </Card>
          )}

          {aiInsights && !isLoadingInsights && (
            <Card shadow="sm" padding="lg" radius="md" withBorder style={{ borderLeft: `4px solid ${aiInsights.gradeColor}` }}>
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <Text size="lg" fw={600}>🤖 Analisis Performa AI</Text>
                </Group>
                <Badge color={aiInsights.gradeColor} size="xl" variant="filled">
                  Grade: {aiInsights.grade}
                </Badge>
              </Group>

              <Stack gap="md">
                {/* Key Findings */}
                {aiInsights.findings && aiInsights.findings.length > 0 && (
                  <div>
                    <Text size="sm" fw={600} mb="xs">📊 Temuan Utama:</Text>
                    <Stack gap="xs">
                      {aiInsights.findings.map((finding, idx) => (
                        <Group key={idx} gap="xs" align="flex-start">
                          <Text size="sm" c="dimmed" style={{ minWidth: '20px' }}>•</Text>
                          <Text size="sm" style={{ flex: 1 }}>{finding}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </div>
                )}

                <Divider />

                {/* Recommendations */}
                {aiInsights.recommendations && aiInsights.recommendations.length > 0 && (
                  <div>
                    <Text size="sm" fw={600} mb="xs">💡 Rekomendasi:</Text>
                    <Stack gap="xs">
                      {aiInsights.recommendations.map((rec, idx) => (
                        <Group key={idx} gap="xs" align="flex-start">
                          <Text size="sm" c="dimmed" style={{ minWidth: '20px' }}>{idx + 1}.</Text>
                          <Text size="sm" style={{ flex: 1 }}>{rec}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </div>
                )}

                {/* Bottlenecks */}
                {aiInsights.bottlenecks && aiInsights.bottlenecks.length > 0 && (
                  <>
                    <Divider />
                    <div>
                      <Text size="sm" fw={600} mb="xs">⚠️ Potensi Bottleneck:</Text>
                      <Stack gap="xs">
                        {aiInsights.bottlenecks.map((bottleneck, idx) => (
                          <Group key={idx} gap="xs" align="flex-start">
                            <Text size="sm" c="dimmed" style={{ minWidth: '20px' }}>•</Text>
                            <Text size="sm" c="orange" style={{ flex: 1 }}>{bottleneck}</Text>
                          </Group>
                        ))}
                      </Stack>
                    </div>
                  </>
                )}
              </Stack>
            </Card>
          )}
        </>
      )}

      {/* Info Card */}
      {!isRunning && !result && (
        <Card shadow="sm" padding="lg" radius="md" withBorder bg="blue.0">
          <Text size="sm" c="dimmed">
            💡 <strong>Tip:</strong> Start with lower concurrency (10-20) and fewer requests (50-100) 
            to test your endpoint. Gradually increase to find performance limits.
          </Text>
        </Card>
      )}
    </Stack>
  );
}

export default PerformanceTab;
