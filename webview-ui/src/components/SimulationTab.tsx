import { Card, Text, Code, Stack, Title, Badge, Button, Textarea, Select, Alert, Tabs, Group, CopyButton, ActionIcon, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy, IconClock } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { ApiData } from '../types/api';
import { getVsCodeApi } from '../utils/vscodeApi';

interface SimulationTabProps {
  apiData: ApiData;
}

interface TestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  error?: string;
  duration?: number;
}

function SimulationTab({ apiData }: SimulationTabProps) {
  const [selectedMethod, setSelectedMethod] = useState(apiData.endpoints[0]?.method || 'GET');
  const [requestBody, setRequestBody] = useState('{\n  \n}');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [requestStartTime, setRequestStartTime] = useState<number>(0);

  const currentEndpoint = apiData.endpoints.find(e => e.method === selectedMethod) || apiData.endpoints[0];

  useEffect(() => {
    console.log('[SimulationTab] Component mounted, listening for messages');
    
    // Listen untuk response dari extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('[SimulationTab] Received message:', message);
      
      if (message.type === 'test-request-response') {
        console.log('[SimulationTab] Got test response:', message.response);
        const duration = requestStartTime > 0 ? Date.now() - requestStartTime : 0;
        setResponse({ ...message.response, duration });
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      console.log('[SimulationTab] Component unmounting, removing listener');
      window.removeEventListener('message', handleMessage);
    };
  }, [requestStartTime]);

  const sendTestRequest = () => {
    console.log('[SimulationTab] Sending test request...');
    setIsLoading(true);
    setResponse(null);
    setRequestStartTime(Date.now());

    const requestData = {
      type: 'send-test-request',
      method: selectedMethod,
      endpoint: apiData.endpoint,
      body: requestBody,
    };

    console.log('[SimulationTab] Request data:', requestData);

    // Use shared VS Code API instance
    const vscode = getVsCodeApi();
    if (vscode) {
      vscode.postMessage(requestData);
      console.log('[SimulationTab] Message sent to extension via VS Code API');
    } else {
      console.error('[SimulationTab] VS Code API not available!');
      setIsLoading(false);
      setResponse({
        status: 0,
        statusText: 'Error',
        headers: {},
        body: null,
        error: 'VS Code API tidak tersedia. Extension mungkin tidak running dengan benar.',
      });
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'green';
    if (status >= 300 && status < 400) return 'blue';
    if (status >= 400 && status < 500) return 'orange';
    if (status >= 500) return 'red';
    return 'gray';
  };

  return (
    <Stack gap="md">
      {/* Request Configuration */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={5} mb="md">
          Konfigurasi Request
        </Title>

        <Stack gap="md">
          {/* Method & Endpoint */}
          <Group gap="sm">
            <Select
              style={{ width: 120 }}
              value={selectedMethod}
              onChange={(value) => setSelectedMethod(value || 'GET')}
              data={apiData.endpoints.map(e => ({ value: e.method, label: e.method }))}
            />
            <Code style={{ flex: 1, padding: '8px', fontSize: '14px' }}>
              http://localhost:3000{apiData.endpoint}
            </Code>
          </Group>

          {/* Request Body untuk POST/PUT/PATCH */}
          {['POST', 'PUT', 'PATCH'].includes(selectedMethod.toUpperCase()) && (
            <Tabs defaultValue="body">
              <Tabs.List>
                <Tabs.Tab value="body">Body</Tabs.Tab>
                <Tabs.Tab value="headers">Headers</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="body" pt="md">
                <Textarea
                  label="Request Body (JSON)"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.currentTarget.value)}
                  minRows={8}
                  placeholder='{\n  "key": "value"\n}'
                  styles={{ input: { fontFamily: 'monospace', fontSize: '13px' } }}
                />
              </Tabs.Panel>

              <Tabs.Panel value="headers" pt="md">
                <Text size="sm" c="dimmed">
                  Content-Type: application/json (default)
                </Text>
              </Tabs.Panel>
            </Tabs>
          )}

          {/* Send Button */}
          <Button 
            variant="filled" 
            onClick={sendTestRequest}
            loading={isLoading}
            disabled={isLoading}
            color="blue"
            size="md"
            fullWidth
          >
            {isLoading ? 'Mengirim Permintaan...' : 'Kirim Request'}
          </Button>
        </Stack>
      </Card>

      {/* Response Display - Postman Style */}
      {response && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={5}>Response</Title>
            <Group gap="xs">
              {response.duration && (
                <Badge leftSection={<IconClock size={14} />} color="gray" variant="light">
                  {response.duration}ms
                </Badge>
              )}
              <Badge color={getStatusColor(response.status)} size="lg">
                {response.status} {response.statusText}
              </Badge>
            </Group>
          </Group>

          {/* Error Alert */}
          {response.error && (
            <Alert color="red" title="Request Failed" mb="md">
              <Text size="sm">{response.error}</Text>
              <Text size="xs" c="dimmed" mt="xs">
                Pastikan Next.js dev server running di http://localhost:3000
              </Text>
            </Alert>
          )}

          {/* Response Data Tabs */}
          {!response.error && (
            <Tabs defaultValue="body">
              <Tabs.List>
                <Tabs.Tab value="body">
                  Body
                </Tabs.Tab>
                <Tabs.Tab value="headers">
                  Headers ({Object.keys(response.headers).length})
                </Tabs.Tab>
              </Tabs.List>

              {/* Body Tab */}
              <Tabs.Panel value="body" pt="md">
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500}>Response Body</Text>
                  <CopyButton value={typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied!' : 'Copy'}>
                        <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
                <Code block style={{ maxHeight: '400px', overflow: 'auto', fontSize: '13px' }}>
                  {typeof response.body === 'string' 
                    ? response.body 
                    : JSON.stringify(response.body, null, 2)}
                </Code>
              </Tabs.Panel>

              {/* Headers Tab */}
              <Tabs.Panel value="headers" pt="md">
                <Stack gap="xs">
                  {Object.entries(response.headers).map(([key, value]) => (
                    <Group key={key} gap="xs">
                      <Code style={{ fontWeight: 600 }}>{key}:</Code>
                      <Text size="sm">{value}</Text>
                    </Group>
                  ))}
                </Stack>
              </Tabs.Panel>
            </Tabs>
          )}
        </Card>
      )}

      {/* Code Examples */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Tabs defaultValue="curl">
          <Tabs.List>
            <Tabs.Tab value="curl">cURL</Tabs.Tab>
            <Tabs.Tab value="fetch">JavaScript</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="curl" pt="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>cURL Command</Text>
              <CopyButton value={generateCurlCommand()}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied!' : 'Copy'}>
                    <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
            <Code block>{generateCurlCommand()}</Code>
          </Tabs.Panel>

          <Tabs.Panel value="fetch" pt="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>Fetch Example</Text>
              <CopyButton value={generateFetchExample()}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied!' : 'Copy'}>
                    <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
            <Code block>{generateFetchExample()}</Code>
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Parameter Info */}
      {currentEndpoint && currentEndpoint.params && currentEndpoint.params.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={6} mb="md">
            Parameter untuk {selectedMethod}
          </Title>
          <Stack gap="sm">
            {currentEndpoint.params.map((param, index) => (
              <div key={index}>
                <Group gap="xs">
                  <Badge color={param.required ? 'red' : 'gray'} size="sm">
                    {param.required ? 'Wajib' : 'Opsional'}
                  </Badge>
                  <Code>{param.name}</Code>
                  <Badge variant="light" size="sm">{param.type}</Badge>
                  <Badge variant="outline" size="sm">{param.location}</Badge>
                </Group>
                <Text size="sm" c="dimmed" ml="md" mt="xs">
                  {param.description}
                </Text>
              </div>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );

  function generateCurlCommand() {
    const method = selectedMethod;
    const endpoint = apiData.endpoint;
    
    let curl = `curl -X ${method} 'http://localhost:3000${endpoint}'`;
    curl += ` \\\n  -H 'Content-Type: application/json'`;
    
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      curl += ` \\\n  -d '${requestBody.replace(/'/g, "'\"'\"'")}'`;
    }
    
    return curl;
  }

  function generateFetchExample() {
    const method = selectedMethod;
    const endpoint = apiData.endpoint;
    
    let fetchCode = `fetch('http://localhost:3000${endpoint}'`;
    
    if (method !== 'GET') {
      fetchCode += `, {\n  method: '${method}',\n  headers: {\n    'Content-Type': 'application/json'\n  }`;
      
      if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        fetchCode += `,\n  body: JSON.stringify(${requestBody})`;
      }
      
      fetchCode += `\n}`;
    }
    
    fetchCode += `)\n  .then(res => res.json())\n  .then(data => console.log(data));`;
    
    return fetchCode;
  }
}

export default SimulationTab;
