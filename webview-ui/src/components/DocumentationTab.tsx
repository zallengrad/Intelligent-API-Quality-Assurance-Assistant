import { Card, Text, Badge, Table, Stack, Title, Code, Group, Divider, Box } from '@mantine/core';
import { ApiData } from '../types/api';
import { useState, useRef, useCallback } from 'react';

interface DocumentationTabProps {
  apiData: ApiData;
}

// Helper function to format JSON with pretty-print
const formatJsonPretty = (jsonString: string): string => {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // If not valid JSON, return as-is
    return jsonString;
  }
};

// Resizable Code Block component
interface ResizableCodeBlockProps {
  content: string;
  minHeight?: number;
  defaultHeight?: number;
}

function ResizableCodeBlock({ content, minHeight = 80, defaultHeight = 150 }: ResizableCodeBlockProps) {
  const [height, setHeight] = useState(defaultHeight);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientY - startY.current;
      const newHeight = Math.max(minHeight, startHeight.current + delta);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height, minHeight]);

  const formattedContent = formatJsonPretty(content);

  return (
    <Box ref={containerRef} style={{ position: 'relative' }}>
      <Code
        block
        style={{
          height: `${height}px`,
          overflow: 'auto',
          whiteSpace: 'pre',
          resize: 'none',
        }}
      >
        {formattedContent}
      </Code>
      {/* Resize handle */}
      <Box
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '8px',
          cursor: 'ns-resize',
          background: 'linear-gradient(to bottom, transparent, rgba(128, 128, 128, 0.3))',
          borderBottomLeftRadius: '4px',
          borderBottomRightRadius: '4px',
        }}
        title="Drag to resize"
      />
    </Box>
  );
}

function DocumentationTab({ apiData }: DocumentationTabProps) {
  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'blue',
      POST: 'green',
      PUT: 'yellow',
      DELETE: 'red',
      PATCH: 'orange',
    };
    return colors[method.toUpperCase()] || 'gray';
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'green';
    if (status >= 400 && status < 500) return 'orange';
    if (status >= 500) return 'red';
    return 'gray';
  };

  return (
    <Stack gap="md">
      {/* File Endpoint Header */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="xs">
          File: {apiData.endpoint}
        </Title>
        <Text size="sm" c="dimmed">
          {apiData.endpoints.length} HTTP method terdeteksi
        </Text>
        {apiData.timestamp && (
          <Text size="xs" c="dimmed" mt="xs">
            Terakhir dianalisis: {new Date(apiData.timestamp).toLocaleString('id-ID')}
          </Text>
        )}
      </Card>

      {/* Loop melalui semua endpoints (methods) */}
      {apiData.endpoints.map((endpoint, index) => (
        <div key={index}>
          {/* Endpoint Header */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="md" mb="sm">
              <Badge color={getMethodColor(endpoint.method)} size="lg">
                {endpoint.method}
              </Badge>
              <Code style={{ fontSize: '1.1rem', flex: 1 }}>{apiData.endpoint}</Code>
            </Group>

            <Title order={5} mb="xs">
              {endpoint.summary}
            </Title>

            {endpoint.description && (
              <Text size="sm" c="dimmed">
                {endpoint.description}
              </Text>
            )}
          </Card>

          {/* ✅ NEW: Overview Section */}
          <Card shadow="sm" padding="lg" radius="md" withBorder mt="sm">
            <Title order={6} mb="md">
              📋 Overview
            </Title>

            <Table striped highlightOnHover>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td fw={500} w={200}>Method</Table.Td>
                  <Table.Td>
                    <Badge color={getMethodColor(endpoint.method)}>
                      {endpoint.method}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>URL</Table.Td>
                  <Table.Td>
                    <Code>{apiData.endpoint}</Code>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>Content-Type</Table.Td>
                  <Table.Td>
                    <Code>application/json</Code>
                  </Table.Td>
                </Table.Tr>
                {endpoint.headers && endpoint.headers.some(h => h.name.toLowerCase() === 'authorization') && (
                  <Table.Tr>
                    <Table.Td fw={500}>Authentication</Table.Td>
                    <Table.Td>
                      <Badge color="red" variant="light">Required</Badge>
                      <Text size="xs" c="dimmed" mt={4}>
                        Bearer Token
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {endpoint.requestBody && (
                  <Table.Tr>
                    <Table.Td fw={500}>Request Body</Table.Td>
                    <Table.Td>
                      <Badge color={endpoint.requestBody.required ? 'red' : 'gray'}>
                        {endpoint.requestBody.required ? 'Required' : 'Optional'}
                      </Badge>
                      <Text size="xs" c="dimmed" mt={4}>
                        {endpoint.requestBody.contentType}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                <Table.Tr>
                  <Table.Td fw={500}>Response Types</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {endpoint.responseSchema.map((resp, idx) => (
                        <Badge key={idx} color={getStatusColor(resp.status)} size="sm">
                          {resp.status}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Card>

          {/* ✅ NEW: Headers Section */}
          {endpoint.headers && endpoint.headers.length > 0 && (
            <Card shadow="sm" padding="lg" radius="md" withBorder mt="sm">
              <Title order={6} mb="md">
                🔑 Headers
              </Title>

              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Required</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Example</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {endpoint.headers.map((header, headerIndex) => (
                    <Table.Tr key={headerIndex}>
                      <Table.Td>
                        <Code>{header.name}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={header.required ? 'red' : 'gray'} size="sm">
                          {header.required ? 'Required' : 'Optional'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{header.description}</Text>
                      </Table.Td>
                      <Table.Td>
                        {header.example && <Code>{header.example}</Code>}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}

          {/* Parameters - Updated styling */}
          {endpoint.params && endpoint.params.length > 0 && (
            <Card shadow="sm" padding="lg" radius="md" withBorder mt="sm">
              <Title order={6} mb="md">
                📝 Parameters
              </Title>

              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Location</Table.Th>
                    <Table.Th>Required</Table.Th>
                    <Table.Th>Description</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {endpoint.params.map((param, paramIndex) => (
                    <Table.Tr key={paramIndex}>
                      <Table.Td>
                        <Code>{param.name}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" size="sm">
                          {param.type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="outline" size="sm">
                          {param.location}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={param.required ? 'red' : 'gray'} size="sm">
                          {param.required ? 'Required' : 'Optional'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{param.description}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}

          {/* ✅ NEW: Request Body Section */}
          {endpoint.requestBody && (
            <Card shadow="sm" padding="lg" radius="md" withBorder mt="sm">
              <Title order={6} mb="md">
                📤 Request Body
              </Title>

              <Stack gap="md">
                <Group gap="sm">
                  <Badge color={endpoint.requestBody.required ? 'red' : 'gray'}>
                    {endpoint.requestBody.required ? 'Required' : 'Optional'}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {endpoint.requestBody.contentType}
                  </Text>
                </Group>

                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Schema:
                  </Text>
                  <ResizableCodeBlock content={endpoint.requestBody.schema} />
                </div>

                {endpoint.requestBody.example && (
                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Example:
                    </Text>
                    <ResizableCodeBlock content={endpoint.requestBody.example} />
                  </div>
                )}
              </Stack>
            </Card>
          )}

          {/* Response Schema - Enhanced */}
          {endpoint.responseSchema && endpoint.responseSchema.length > 0 && (
            <Card shadow="sm" padding="lg" radius="md" withBorder mt="sm">
              <Title order={6} mb="md">
                📥 Response
              </Title>

              <Stack gap="md">
                {endpoint.responseSchema.map((response, respIndex) => (
                  <div key={respIndex}>
                    <Group gap="sm" mb="xs">
                      <Badge color={getStatusColor(response.status)} size="lg">
                        {response.status}
                      </Badge>
                      <Text size="sm" fw={500}>
                        {response.status >= 200 && response.status < 300 && 'Success'}
                        {response.status >= 400 && response.status < 500 && 'Client Error'}
                        {response.status >= 500 && 'Server Error'}
                      </Text>
                      <Text size="sm" c="dimmed">
                        • {response.contentType}
                      </Text>
                    </Group>

                    <Text size="sm" fw={500} mb="xs">
                      Schema:
                    </Text>
                    <ResizableCodeBlock content={response.schema} />

                    {response.example && (
                      <>
                        <Text size="sm" fw={500} mt="md" mb="xs">
                          Example:
                        </Text>
                        <ResizableCodeBlock content={response.example} />
                      </>
                    )}

                    {respIndex < endpoint.responseSchema.length - 1 && (
                      <Divider my="md" />
                    )}
                  </div>
                ))}
              </Stack>
            </Card>
          )}

          {index < apiData.endpoints.length - 1 && <Divider my="xl" />}
        </div>
      ))}
    </Stack>
  );
}

export default DocumentationTab;
