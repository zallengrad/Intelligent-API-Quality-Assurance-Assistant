import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiData } from './types/api';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'nextjs-api-inspector-sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'info':
          vscode.window.showInformationMessage(data.message);
          break;
        case 'error':
          vscode.window.showErrorMessage(data.message);
          break;
        case 'request-api-key':
          this._promptForApiKey();
          break;
        case 'send-test-request':
          await this._handleTestRequest(data, webviewView.webview);
          break;
        case 'run-load-test':
          await this._handleLoadTest(data, webviewView.webview);
          break;
        case 'analyze-performance':
          await this._handlePerformanceAnalysis(data, webviewView.webview);
          break;
      }
    });
  }

  private async _promptForApiKey() {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Google Gemini API Key',
      password: true,
      placeHolder: 'AIza...',
    });

    if (apiKey) {
      const config = vscode.workspace.getConfiguration('nextjsApiInspector');
      await config.update('geminiApiKey', apiKey, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('API Key saved successfully!');
    }
  }

  public sendApiData(apiData: ApiData) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'api-data-update',
        data: apiData,
      });
    }
  }

  public sendError(error: string) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'error',
        message: error,
      });
    }
  }

  public sendLoading(isLoading: boolean) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'loading',
        isLoading,
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get the path to the built React app
    const distPath = path.join(this._extensionUri.fsPath, 'dist', 'webview');
    const indexPath = path.join(distPath, 'index.html');

    // Check if the built React app exists
    if (!fs.existsSync(indexPath)) {
      return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>NextJS API Inspector</title>
        </head>
        <body>
          <div style="padding: 20px; font-family: system-ui;">
            <h3>Build Error</h3>
            <p>The webview UI has not been built yet.</p>
            <p>Please run: <code>npm run build:webview</code></p>
          </div>
        </body>
        </html>`;
    }

    // Read the HTML file
    let html = fs.readFileSync(indexPath, 'utf-8');

    // Get base URI for the webview
    const baseUri = webview.asWebviewUri(vscode.Uri.file(distPath));

    // Replace relative paths with webview URIs
    html = html.replace(
      /(href|src)="\/([^"]*)"/g,
      (match, attr, filePath) => {
        const uri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, filePath)));
        return `${attr}="${uri}"`;
      }
    );

    // Add CSP meta tag
    const cspSource = webview.cspSource;
    html = html.replace(
      '<head>',
      `<head>
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline'; font-src ${cspSource}; img-src ${cspSource} https: data:;">`
    );

    return html;
  }

  private async _handleTestRequest(data: any, webview: vscode.Webview) {
    console.log('[Test Request] Received request:', { method: data.method, endpoint: data.endpoint });
    
    try {
      const { method, endpoint, body } = data;
      const url = `http://localhost:3000${endpoint}`;

      console.log('[Test Request] Sending to:', url);

      // Import fetch for Node.js
      const fetch = (await import('node-fetch')).default;

      const options: any = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout (increased from 10s)
      };

      // Add body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
        options.body = body;
        console.log('[Test Request] With body:', body);
      }

      const response = await fetch(url, options);
      console.log('[Test Request] Got response:', response.status, response.statusText);

      const contentType = response.headers.get('content-type');

      let responseBody;
      try {
        if (contentType?.includes('application/json')) {
          responseBody = await response.json();
        } else {
          responseBody = await response.text();
        }
      } catch (parseError) {
        console.error('[Test Request] Error parsing response body:', parseError);
        responseBody = await response.text();
      }

      // Extract headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value: string, key: string) => {
        headers[key] = value;
      });

      const responseData = {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
        body: responseBody,
      };

      console.log('[Test Request] Sending response back to webview:', responseData);

      // Send response back to webview
      webview.postMessage({
        type: 'test-request-response',
        response: responseData,
      });

      console.log('[Test Request] Response sent successfully');
    } catch (error) {
      console.error('[Test Request] Error occurred:', error);
      
      // Send error back to webview
      const errorResponse = {
        status: 0,
        statusText: 'Error',
        headers: {},
        body: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      console.log('[Test Request] Sending error response:', errorResponse);

      webview.postMessage({
        type: 'test-request-response',
        response: errorResponse,
      });
    }
  }

  private async _handleLoadTest(data: any, webview: vscode.Webview) {
    console.log('[Load Test] Starting load test:', data.config);
    
    try {
      const { endpoint, method, concurrency, totalRequests, body } = data.config;
      
      // Validation
      const maxConcurrency = Math.min(concurrency, 100);
      const maxRequests = Math.min(totalRequests, 1000);
      
      console.log('[Load Test] Config validated:', { maxConcurrency, maxRequests });
      
      const fetch = (await import('node-fetch')).default;
      const url = `http://localhost:3000${endpoint}`;
      
      const latencies: number[] = [];
      let successCount = 0;
      let errorCount = 0;
      const startTime = Date.now();
      
      // Batch processing to prevent blocking
      const batchSize = maxConcurrency;
      const batches = Math.ceil(maxRequests / batchSize);
      
      console.log('[Load Test] Starting execution with', batches, 'batches');
      
      for (let i = 0; i < batches; i++) {
        const batchRequests = Math.min(batchSize, maxRequests - (i * batchSize));
        const promises = [];
        
        // Create batch of concurrent requests
        for (let j = 0; j < batchRequests; j++) {
          promises.push(this._executeRequest(url, method, body, latencies));
        }
        
        // Execute batch concurrently
        const results = await Promise.allSettled(promises);
        
        // Count successes and errors
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
          } else {
            errorCount++;
          }
        });
        
        // Send progress update
        const completed = Math.min((i + 1) * batchSize, maxRequests);
        const progress = (completed / maxRequests) * 100;
        
        console.log('[Load Test] Progress:', progress.toFixed(1) + '%', `(${completed}/${maxRequests})`);
        
        webview.postMessage({
          type: 'load-test-progress',
          progress,
          completed,
          total: maxRequests,
          successCount,
          errorCount,
        });
        
        // Small delay between batches to prevent overwhelming
        if (i < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      // Calculate final statistics
      const duration = Date.now() - startTime;
      const avgLatency = latencies.length > 0 
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
        : 0;
      const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
      const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
      const rps = duration > 0 ? (maxRequests / duration) * 1000 : 0;
      const successRate = maxRequests > 0 ? (successCount / maxRequests) * 100 : 0;
      
      console.log('[Load Test] Completed:', {
        duration,
        avgLatency: avgLatency.toFixed(2),
        rps: rps.toFixed(2),
        successRate: successRate.toFixed(1) + '%',
      });
      
      // Send final results
      webview.postMessage({
        type: 'load-test-result',
        results: {
          totalRequests: maxRequests,
          successCount,
          errorCount,
          duration,
          avgLatency,
          minLatency,
          maxLatency,
          rps,
          successRate,
        },
      });
      
    } catch (error) {
      console.error('[Load Test] Error:', error);
      webview.postMessage({
        type: 'load-test-result',
        results: {
          totalRequests: 0,
          successCount: 0,
          errorCount: 1,
          duration: 0,
          avgLatency: 0,
          minLatency: 0,
          maxLatency: 0,
          rps: 0,
          successRate: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  private async _executeRequest(
    url: string,
    method: string,
    body: any,
    latencies: number[]
  ): Promise<{ success: boolean; status?: number; error?: any }> {
    const requestStart = Date.now();
    
    try {
      const fetch = (await import('node-fetch')).default;
      
      const options: any = {
        method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000, // 10 second timeout
      };
      
      if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
        options.body = body;
      }
      
      const response = await fetch(url, options);
      const latency = Date.now() - requestStart;
      latencies.push(latency);
      
      return { success: response.ok, status: response.status };
    } catch (error) {
      const latency = Date.now() - requestStart;
      latencies.push(latency);
      return { success: false, error };
    }
  }

  private async _handlePerformanceAnalysis(data: any, webview: vscode.Webview) {
    console.log('[Performance Analysis] Starting AI analysis:', data.results);
    
    try {
      const { results, config } = data;
      
      // Get Gemini API key from configuration
      const apiKey = vscode.workspace.getConfiguration('nextjsApiInspector').get<string>('geminiApiKey');
      
      if (!apiKey) {
        console.error('[Performance Analysis] Gemini API key not configured');
        webview.postMessage({
          type: 'ai-performance-insights',
          insights: {
            grade: 'N/A',
            gradeColor: 'gray',
            findings: ['API key Gemini belum dikonfigurasi. Silakan atur di pengaturan extension.'],
            recommendations: [],
            bottlenecks: [],
          },
        });
        return;
      }

      // Import Gemini AI
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Create analysis prompt in Indonesian
      const prompt = `Anda adalah expert dalam performance analysis dan optimization untuk web APIs.

Analisis hasil load testing berikut dan berikan insight yang actionable dalam BAHASA INDONESIA:

**Konfigurasi Test:**
- Endpoint: ${config.endpoint}
- Method: ${config.method}
- Concurrency: ${config.concurrency} virtual users
- Total Requests: ${config.totalRequests}

**Hasil Test:**
- Success Rate: ${results.successRate.toFixed(1)}%
- Total Duration: ${results.duration}ms
- Average Latency: ${results.avgLatency.toFixed(2)}ms
- Min Latency: ${results.minLatency.toFixed(2)}ms
- Max Latency: ${results.maxLatency.toFixed(2)}ms
- Requests per Second (RPS): ${results.rps.toFixed(2)}
- Success Count: ${results.successCount}
- Error Count: ${results.errorCount}

Berikan analisis dalam format JSON SAJA (tanpa markdown, tanpa code blocks) dengan struktur:
{
  "grade": "A+/A/B+/B/C+/C/D/F",
  "gradeColor": "green/yellow/orange/red",
  "findings": ["temuan 1", "temuan 2", "temuan 3"],
  "recommendations": ["rekomendasi 1", "rekomendasi 2", "rekomendasi 3"],
  "bottlenecks": ["bottleneck 1", "bottleneck 2"]
}

**Kriteria Grading:**
- A+/A (green): Excellent performance, latency <200ms, success rate 100%, RPS tinggi
- B+/B (green): Good performance, latency <500ms, success rate >95%
- C+/C (yellow): Fair performance, latency <1000ms, success rate >90%
- D (orange): Poor performance, latency <2000ms, success rate >80%
- F (red): Critical issues, latency >2000ms or success rate <80%

**Findings:** 3-5 observasi kunci tentang performa (BAHASA INDONESIA)
**Recommendations:** 3-5 saran konkrit untuk improvement (BAHASA INDONESIA)
**Bottlenecks:** 1-3 potensi bottleneck yang teridentifikasi (BAHASA INDONESIA)

JAWAB HANYA DENGAN JSON, TIDAK ADA TEKS LAIN.`;

      console.log( '[Performance Analysis] Sending request to Gemini...');
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      let text = response.text();
      
      // Clean up response
      text = text.trim();
      if (text.startsWith('```json')) {
        text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\n/, '').replace(/\n```$/, '');
      }
      
      const insights = JSON.parse(text);
      
      console.log('[Performance Analysis] AI insights generated:', insights);
      
      // Send insights to webview
      webview.postMessage({
        type: 'ai-performance-insights',
        insights,
      });
      
    } catch (error) {
      console.error('[Performance Analysis] Error:', error);
      webview.postMessage({
        type: 'ai-performance-insights',
        insights: {
          grade: 'N/A',
          gradeColor: 'gray',
          findings: ['Terjadi error saat menganalisis performa dengan AI.'],
          recommendations: ['Coba lagi nanti atau periksa koneksi internet Anda.'],
          bottlenecks: [],
        },
      });
    }
  }
}
