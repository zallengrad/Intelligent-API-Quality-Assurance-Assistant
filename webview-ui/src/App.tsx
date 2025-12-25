import { useState, useEffect } from 'react';
import { Tabs, Container, Title, Text, Loader, Center, Stack } from '@mantine/core';
import { ApiData } from './types/api';
import DocumentationTab from './components/DocumentationTab';
import SimulationTab from './components/SimulationTab';
import AnalysisTab from './components/AnalysisTab';
import PerformanceTab from './components/PerformanceTab';
import ProjectOverviewTab from './components/ProjectOverviewTab';

// Mock data untuk tampilan awal
const mockApiData: ApiData = {
  endpoint: '/api/example',
  endpoints: [
    {
      method: 'GET',
      summary: 'Contoh endpoint API',
      description: 'Ini adalah placeholder. Simpan file Next.js route untuk melihat analisis sesungguhnya.',
      params: [
        {
          name: 'id',
          type: 'string',
          required: true,
          description: 'Identifikasi resource',
          location: 'query',
        },
      ],
      responseSchema: [
        {
          status: 200,
          contentType: 'application/json',
          schema: '{ "data": "string" }',
          example: '{ "data": "Hello World" }',
        },
      ],
    },
  ],
  issues: [
    {
      severity: 'info',
      title: 'Belum ada analisis',
      description: 'Simpan file route.ts Next.js untuk memicu analisis AI',
    },
  ],
};

function App() {
  const [apiData, setApiData] = useState<ApiData>(mockApiData);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('documentation');

  useEffect(() => {
    // Mendengarkan pesan dari extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'api-data-update':
          setApiData(message.data);
          setIsLoading(false);
          break;
        case 'loading':
          setIsLoading(message.isLoading);
          break;
        case 'error':
          setIsLoading(false);
          // Handle error display
          console.error('Error dari extension:', message.message);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  if (isLoading) {
    return (
      <Container p="md">
        <Center style={{ minHeight: '200px' }}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text>Menganalisis API route dengan AI...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container p="md" style={{ maxWidth: '100%' }}>
      <Stack gap="md">
        <div>
          <Title order={2} size="h3">
            API Inspector
          </Title>
          <Text size="sm" c="dimmed">
            Dokumentasi & analisis API
          </Text>
        </div>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="documentation">Dokumentasi</Tabs.Tab>
            <Tabs.Tab value="testing">Simulasi</Tabs.Tab>
            <Tabs.Tab value="performance">Load Test</Tabs.Tab>
            <Tabs.Tab value="analysis">Analisis</Tabs.Tab>
            <Tabs.Tab value="project">All API</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="documentation" pt="md">
            <DocumentationTab apiData={apiData} />
          </Tabs.Panel>

          <Tabs.Panel value="testing" pt="md">
            <SimulationTab apiData={apiData} />
          </Tabs.Panel>

          <Tabs.Panel value="performance" pt="md">
            <PerformanceTab apiData={apiData} />
          </Tabs.Panel>

          <Tabs.Panel value="analysis" pt="md">
            <AnalysisTab apiData={apiData} />
          </Tabs.Panel>

          <Tabs.Panel value="project" pt="md">
            <ProjectOverviewTab />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}

export default App;
