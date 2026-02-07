import { useState } from 'react';
import {
  Card,
  Text,
  Badge,
  Table,
  Stack,
  Title,
  Button,
  Group,
  Loader,
  Center,
  Alert,
  Divider,
  Code,
} from '@mantine/core';
import { ProjectScanResult } from '../types/api';
import { getVsCodeApi } from '../utils/vscodeApi';

function ProjectOverviewTab() {
  const [projectData, setProjectData] = useState<ProjectScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Get VS Code API
  const vscodeApi = getVsCodeApi();

  // Listen for messages from extension
  useState(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'project-scan-progress':
          setScanProgress(
            `${message.message} (${message.current}/${message.total})`
          );
          break;

        case 'project-scan-complete':
          setProjectData(message.data);
          setIsScanning(false);
          setScanProgress('');
          setError('');
          break;

        case 'project-scan-error':
          setError(message.error);
          setIsScanning(false);
          setScanProgress('');
          break;

        case 'export-success':
          // Show success feedback (optional - VS Code already shows notification)
          break;

        case 'export-postman-success':
          // Show success feedback for Postman export
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  });

  const handleScanProject = () => {
    setIsScanning(true);
    setError('');
    setScanProgress('Memulai scan...');
    
    vscodeApi?.postMessage({
      type: 'project-scan',
    });
  };

  const handleExportMarkdown = () => {
    if (!projectData) return;

    vscodeApi?.postMessage({
      type: 'export-markdown',
      projectData: projectData,
    });
  };

  const handleExportPostman = () => {
    if (!projectData) return;

    vscodeApi?.postMessage({
      type: 'export-postman',
      projectData: projectData,
    });
  };

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

  return (
    <Stack gap="md">
      {/* Header */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="xs">
          📚 Project API Overview
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Scan semua route files di project untuk melihat dokumentasi API keseluruhan
        </Text>

        <Group gap="md">
          <Button
            onClick={handleScanProject}
            loading={isScanning}
            disabled={isScanning}
            variant="filled"
            size="md"
          >
            🔍 Scan All Routes
          </Button>

          {projectData && (
            <>
              <Button
                onClick={handleExportMarkdown}
                variant="light"
                size="md"
                disabled={isScanning}
              >
                📄 Export to README.md
              </Button>
              <Button
                onClick={handleExportPostman}
                variant="light"
                color="orange"
                size="md"
                disabled={isScanning}
              >
                📦 Export to Postman
              </Button>
            </>
          )}
        </Group>
      </Card>

      {/* Loading State */}
      {isScanning && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Center>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text size="sm">{scanProgress}</Text>
            </Stack>
          </Center>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert color="red" title="Error">
          {error}
        </Alert>
      )}

      {/* Results */}
      {projectData && !isScanning && (
        <>
          {/* Summary Stats */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={5} mb="md">
              📊 Summary
            </Title>
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed">
                  Total Files
                </Text>
                <Text size="xl" fw={700}>
                  {projectData.totalFiles}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Total Endpoints
                </Text>
                <Text size="xl" fw={700}>
                  {projectData.totalEndpoints}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Scanned
                </Text>
                <Text size="sm">
                  {new Date(projectData.timestamp).toLocaleString('id-ID')}
                </Text>
              </div>
            </Group>
          </Card>

          {/* API List */}
          {projectData.apis.length === 0 ? (
            <Alert color="blue" title="Tidak ada route files">
              Tidak ditemukan file route.ts atau route.js di project ini.
            </Alert>
          ) : (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Title order={5} mb="md">
                📋 All APIs ({projectData.apis.length} files)
              </Title>

              <Stack gap="lg">
                {projectData.apis.map((api, index) => (
                  <div key={index}>
                    <Group gap="sm" mb="xs">
                      <Text size="lg" fw={600}>
                        {api.apiData.endpoint}
                      </Text>
                      <Badge variant="light" size="sm">
                        {api.apiData.endpoints.length} method(s)
                      </Badge>
                    </Group>

                    <Code block mb="sm">
                      {api.relativePath}
                    </Code>

                    <Table highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Method</Table.Th>
                          <Table.Th>Summary</Table.Th>
                          <Table.Th>Params</Table.Th>
                          <Table.Th>Issues</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {api.apiData.endpoints.map((endpoint, epIndex) => (
                          <Table.Tr key={epIndex}>
                            <Table.Td>
                              <Badge color={getMethodColor(endpoint.method)}>
                                {endpoint.method}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{endpoint.summary}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" size="sm">
                                {endpoint.params.length} param(s)
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              {api.apiData.issues.length > 0 ? (
                                <Badge color="orange" size="sm">
                                  {api.apiData.issues.length} issue(s)
                                </Badge>
                              ) : (
                                <Badge color="green" size="sm">
                                  ✓ Clean
                                </Badge>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>

                    {index < projectData.apis.length - 1 && <Divider my="lg" />}
                  </div>
                ))}
              </Stack>
            </Card>
          )}
        </>
      )}

      {/* Empty State */}
      {!projectData && !isScanning && !error && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Center style={{ minHeight: '200px' }}>
            <Stack align="center" gap="md">
              <Text size="xl">🔍</Text>
              <Text size="lg" fw={500}>
                Belum ada data
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Klik tombol "Scan All Routes" untuk memulai scanning project Anda
              </Text>
            </Stack>
          </Center>
        </Card>
      )}
    </Stack>
  );
}

export default ProjectOverviewTab;
