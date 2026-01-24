# NextJS API Inspector

A powerful VS Code extension that automatically analyzes and documents Next.js API routes using AI-powered insights from Google Gemini.

## Features

- 🔍 **Automatic Detection**: Instantly detects when you save Next.js API route files (`route.ts`, `route.js`)
- 🤖 **AI-Powered Analysis**: Uses Google Gemini to analyze your API endpoints
- 📚 **Auto Documentation**: Generates comprehensive API documentation including:
  - HTTP methods and endpoints
  - Request parameters (query, body, headers, path)
  - Response schemas with examples
- 🧪 **Testing Tools**: Provides ready-to-use cURL and fetch examples
- 🛡️ **Security Analysis**: Identifies potential security vulnerabilities
- ⚡ **Scalability Insights**: Detects performance and scalability concerns
- 🎨 **Beautiful UI**: Modern sidebar panel built with React and Mantine UI

## Installation

### Option 1: Install from VSIX

1. **Download** the `.vsix` file from your source (GitHub release, shared link, etc.)
2. **Open VS Code**
3. **Go to Extensions** (Ctrl+Shift+X)
4. **Click** the "..." menu (top-right of Extensions panel)
5. **Select** "Install from VSIX..."
6. **Choose** the downloaded `.vsix` file
7. **Reload** VS Code when prompted

---

### Option 2: From Source (For Developers)

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed build instructions.

1. Clone this repository:
   ```bash
   git clone <your-repo-url>
   cd nextjs-api-inspector
   ```

2. Install dependencies:
   ```bash
   npm install
   cd webview-ui
   npm install
   cd ..
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Open the project in VS Code and press `F5` to launch the Extension Development Host

---

## Setup

### Getting Your API Key

This extension requires a **free** Google Gemini API key:

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key

### Configuring the Extension

After installation:

1. Open VS Code settings (Ctrl+,)
2. Search for "NextJS API Inspector"
3. Paste your API key in the `nextjsApiInspector.geminiApiKey` field

**Alternative method:**
- The extension will show a warning on first use
- Click "Set API Key" button
- This will open the settings for you

## Usage

1. **Open the Sidebar**: Click the NextJS API Inspector icon in the Activity Bar
2. **Create/Edit an API Route**: Open or create a Next.js API route file (e.g., `app/api/users/route.ts`)
3. **Save the File**: Press Ctrl+S to save
4. **View Analysis**: The sidebar will automatically update with:
   - **Documentation Tab**: Complete API documentation
   - **Testing Tab**: cURL and fetch examples
   - **Analysis Tab**: Security and scalability insights

### Manual Analysis

You can also manually trigger analysis:
1. Open a Next.js route file
2. Open Command Palette (Ctrl+Shift+P)
3. Run: `NextJS API Inspector: Analyze Current File`

## Example

Given this Next.js API route:

```typescript
// app/api/users/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  // Fetch user from database
  const user = await db.user.findUnique({ where: { id } });
  
  return Response.json(user);
}
```

The extension will automatically generate:
- 📄 Documentation with endpoint details
- 🧪 Test examples (cURL, fetch)
- 🛡️ Security warnings (e.g., missing authentication, input validation)

## Project Structure

```
nextjs-api-inspector/
├── src/                        # Extension source code
│   ├── extension.ts            # Main extension entry point
│   ├── SidebarProvider.ts      # Webview provider
│   ├── services/
│   │   └── aiService.ts        # Google Gemini integration
│   └── types/
│       └── api.ts              # TypeScript interfaces
├── webview-ui/                 # React UI source
│   ├── src/
│   │   ├── App.tsx             # Main React component
│   │   ├── components/         # UI components
│   │   └── types/              # Shared types
│   └── package.json
├── dist/                       # Built files (generated)
├── package.json                # Extension manifest
└── esbuild.js                  # Build configuration
```

## Development

### Building

```bash
# Build both extension and webview
npm run build

# Build extension only
npm run build:extension

# Build webview only
npm run build:webview
```

### Watch Mode

```bash
# Watch extension for changes
npm run watch

# Watch webview for changes (in another terminal)
npm run watch:webview
```

### Debugging

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Set breakpoints in `src/` files
4. For webview debugging:
   - Right-click in the sidebar panel
   - Select "Inspect Element" (if available)
   - Or check Help > Toggle Developer Tools

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `nextjsApiInspector.geminiApiKey` | Google Gemini API key for AI analysis | `""` |

## Tech Stack

- **Extension**: TypeScript, VS Code Extension API, esbuild
- **Webview UI**: React, TypeScript, Vite, Mantine UI
- **AI**: Google Gemini 1.5 Flash (Latest)

## Building VSIX

To build the extension as a `.vsix` file for distribution:

```bash
# Install vsce globally (first time only)
npm install -g @vscode/vsce

# Build the extension
npm run build

# Package as VSIX
vsce package
```

This creates `nextjs-api-inspector-0.0.1.vsix` that can be shared and installed on any VS Code instance.

**Note:** Users who install the `.vsix` will need to configure their own Gemini API key in settings.

**For detailed deployment instructions**, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Limitations

- Only analyzes Next.js App Router route files (`route.ts`, `route.js`)
- Requires active Google Gemini API key
- Analysis quality depends on code clarity and AI model capabilities

## Roadmap

- [ ] Support for Pages Router API routes (`pages/api/**/*.ts`)
- [ ] Built-in API testing (send requests directly from UI)
- [ ] Export documentation to Markdown/OpenAPI
- [ ] Custom AI prompt templates
- [ ] Response caching to reduce API calls

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

If you encounter any issues or have questions:
1. Check the VS Code Output panel (View > Output > NextJS API Inspector)
2. Open an issue on GitHub
3. Make sure your Gemini API key is correctly configured

## Credits

Built with ❤️ using:
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Google Gemini AI](https://ai.google.dev/)
- [Mantine UI](https://mantine.dev/)
- [Vite](https://vitejs.dev/)
