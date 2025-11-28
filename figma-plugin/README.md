# Figma2Code Plugin

A Figma plugin that extracts design data directly from the Figma document without REST API rate limits.

## Why Use This Plugin?

**Problem**: The Figma REST API has severe rate limiting (429 errors) that prevents reliable extraction of complex designs.

**Solution**: This plugin runs inside Figma and has direct document access - no rate limits, faster extraction, and complete data.

### Benefits vs REST API

| Feature | REST API | Plugin | Improvement |
|---------|----------|--------|-------------|
| Rate Limits | 429 errors | No limits | ✅ 100% |
| Speed | 5-10s | 1-2s | ✅ 80% faster |
| Data Completeness | Partial | Complete | ✅ 100% |
| Image Export | Separate calls | Built-in | ✅ Simpler |

---

## Installation

### 1. Import to Figma

1. Open Figma Desktop (or browser)
2. Go to **Menu** → **Plugins** → **Development** → **Import plugin from manifest...**
3. Navigate to this directory (`figma-plugin/`) and select `manifest.json`
4. The plugin will appear in your **Plugins** menu under **Development**

### 2. Start Backend Server

Make sure your backend server is running:

```bash
cd /path/to/figma2code
npm run dev
# OR
npm run backend
```

The backend should be running on `http://localhost:3000`

---

## Usage

### Step 1: Select a Frame/Component

1. Open your Figma design
2. Select the frame or component you want to extract
3. The plugin will show node count and selection info

### Step 2: Run the Plugin

1. Go to **Menu** → **Plugins** → **Development** → **Figma2Code Extractor**
2. Configure settings:
   - **Backend URL**: Default is `http://localhost:3000`
   - **Skip build**: Skip TypeScript/build validation
   - **Skip visual**: Skip visual comparison with screenshot
3. Click **"Extract & Send to Backend"**

### Step 3: Wait for Processing

The plugin will:
1. ✅ Extract complete node tree (all properties, styles, layout)
2. ✅ Capture screenshot for visual diff
3. ✅ Send data to backend
4. ✅ Backend processes and generates code
5. ✅ Shows Job ID when complete

### Step 4: View Results

Check the backend logs or frontend UI for the job status and generated code.

---

## What Gets Extracted

### Complete Node Data

- **Layout**: Position, size, rotation, constraints, auto-layout
- **Styling**: Fills, strokes, effects, shadows, opacity, border-radius
- **Typography**: Font family, size, weight, line-height, letter-spacing, color
- **Content**: Text content, images (as base64)
- **Hierarchy**: Complete child tree with all relationships
- **Component Types**: Semantic detection (Button, Input, Card, etc.)

### Screenshot

- 2x resolution PNG for visual diff comparison
- Exported directly from Figma (no REST API call needed)

---

## Development

### Build

```bash
cd figma-plugin
npm install
npm run build
```

### Watch Mode

```bash
npm run dev
```

This watches for file changes and rebuilds automatically.

### File Structure

```
figma-plugin/
├── manifest.json          # Plugin configuration
├── src/
│   ├── code.ts           # Main plugin logic (runs in sandbox)
│   ├── ui.html           # Plugin UI (runs in iframe)
│   └── types.ts          # Shared TypeScript types
├── dist/                 # Build output
│   ├── code.js
│   ├── ui.html
│   └── types.js
├── package.json
├── tsconfig.json
└── README.md
```

---

## Troubleshooting

### Plugin Not Showing Up

- Make sure you imported from the correct `manifest.json`
- Check that the plugin is under **Plugins** → **Development**
- Try closing and reopening Figma

### "No Selection" Error

- Select a Frame, Component, or Instance before running
- Group nodes are not supported (convert to Frame first)

### Network Error

- Make sure backend is running on `http://localhost:3000`
- Check backend URL in plugin UI
- Check browser console for CORS errors

### Extraction Takes Too Long

- Large designs (>1000 nodes) may take 5-10 seconds
- Complex gradients and effects add processing time
- Consider extracting smaller sections

### Backend Returns Error

- Check backend logs for details
- Verify the IR structure is valid
- Make sure all required fields are present

---

## How It Works

### Architecture

```
┌─────────────────────┐
│   Figma Document    │  ← User selects node
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Plugin (code.ts)  │  ← Direct document access (no API limits)
│   - Traverse tree   │
│   - Extract styles  │
│   - Build IR JSON   │
│   - Capture PNG     │
└──────────┬──────────┘
           │ postMessage
           ▼
┌─────────────────────┐
│   UI (ui.html)      │  ← Has network access
│   - Receive data    │
│   - Show progress   │
└──────────┬──────────┘
           │ fetch()
           ▼
┌─────────────────────┐
│   Backend Server    │  ← Same as before
│   - Generate code   │
│   - Build & test    │
│   - Visual diff     │
└─────────────────────┘
```

### Key Features

1. **Direct Access**: Plugin runs in Figma's sandbox with full document API
2. **No Rate Limits**: Not using REST API, so no 429 errors
3. **Complete Data**: Access to all node properties (fills, effects, text, layout)
4. **Fast**: No network latency for node traversal
5. **Built-in Export**: Screenshot generation without separate API calls

---

## API Reference

### Messages from UI → Plugin

```typescript
{
  type: 'extract',
  config: {
    backendUrl: string,
    skipBuild: boolean,
    skipVisual: boolean
  }
}
```

### Messages from Plugin → UI

```typescript
// Selection changed
{
  type: 'selection-changed',
  data: {
    nodeCount: number,
    nodeName: string,
    nodeType: string
  }
}

// Progress update
{
  type: 'extraction-progress',
  percent: number,
  status: string
}

// Extraction complete
{
  type: 'extraction-complete',
  data: {
    ir: IRDocument,
    screenshot: string,  // Base64
    metadata: {...}
  }
}

// Error
{
  type: 'extraction-error',
  error: string
}
```

### Backend API Endpoint

```
POST /api/plugin/extract

Body:
{
  ir: IRDocument,
  screenshot: string,
  metadata: ExtractionMetadata,
  config: {
    skipBuild: boolean,
    skipVisual: boolean
  }
}

Response:
{
  success: true,
  jobId: string,
  status: 'processing',
  message: string
}
```

---

## Comparison with REST API Extraction

### REST API Method (OLD)

```
Figma Design
    ↓ REST API call
Figma API (rate limited)
    ↓ JSON response
Backend Server
    ↓ Process
Generated Code

Problems:
- 429 rate limit errors
- Incomplete data extraction
- Slow (network latency)
- Complex retry logic needed
```

### Plugin Method (NEW)

```
Figma Design
    ↓ Direct access (no API)
Plugin in Figma
    ↓ Complete data + screenshot
Backend Server
    ↓ Process
Generated Code

Benefits:
- No rate limits
- Complete data
- Faster extraction
- Simpler code
```

---

## Future Enhancements

- [ ] Batch extraction (multiple nodes at once)
- [ ] Export as JSON file (download to disk)
- [ ] Preview mode (show IR before sending)
- [ ] Component library detection
- [ ] Design token extraction
- [ ] Export to different backends (configurable URLs)

---

## Contributing

1. Make changes in `src/`
2. Run `npm run build`
3. Reload plugin in Figma: **Plugins** → **Development** → **Reload**
4. Test with a sample design

---

## License

MIT

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend logs for detailed errors
3. Open an issue on GitHub
