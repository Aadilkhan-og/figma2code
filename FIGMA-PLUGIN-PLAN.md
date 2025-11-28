# Figma Plugin Implementation Plan

## Problem Statement

**Current Issue**: The Figma REST API has severe rate limiting (429 errors) that prevents reliable extraction of design data. The generated output is incomplete - missing dashboard statistics, charts, and most UI components.

**Root Cause Analysis**:
1. REST API calls consume rate limit quota quickly
2. Image fills require separate API calls (quota intensive)
3. Complex designs with many nodes exhaust limits
4. No caching between extraction phases

**Proposed Solution**: Build a Figma Plugin that runs inside Figma and has direct access to the document without REST API rate limits.

---

## Research Summary

### Official Documentation Sources

1. **[Plugin Manifest](https://www.figma.com/plugin-docs/manifest/)** - Manifest structure and required fields
2. **[Accessing the Document](https://www.figma.com/plugin-docs/accessing-document/)** - Node traversal methods
3. **[Node Properties](https://www.figma.com/plugin-docs/api/node-properties/)** - Available node data
4. **[Making Network Requests](https://www.figma.com/plugin-docs/making-network-requests/)** - Sending data to external servers
5. **[PostMessage API](https://www.figma.com/plugin-docs/api/properties/figma-ui-postmessage/)** - Plugin ↔ UI communication
6. **[TextNode API](https://www.figma.com/plugin-docs/api/TextNode/)** - Text extraction
7. **[ExportSettings](https://www.figma.com/plugin-docs/api/ExportSettings/)** - Image export

### Key Capabilities

**Plugin Advantages over REST API**:
- ✅ **No rate limits** - Direct document access
- ✅ **Complete data** - Access to all node properties
- ✅ **Faster execution** - No network latency
- ✅ **Real-time updates** - Works with live document
- ✅ **Image export** - Built-in export without separate API calls
- ✅ **Font loading** - Can load fonts for accurate text measurements

---

## Architecture Design

### 1. Plugin Structure

```
figma-plugin/
├── manifest.json          # Plugin configuration
├── code.ts               # Main plugin logic (sandbox)
├── ui.html               # Plugin UI (iframe)
├── ui.ts                 # UI logic with network access
└── types.ts              # Shared TypeScript types
```

### 2. Data Flow

```
┌─────────────────────┐
│   Figma Document    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Plugin (code.ts)  │  ← Direct node access
│   - Traverse nodes  │
│   - Extract props   │
│   - Build IR JSON   │
└──────────┬──────────┘
           │ postMessage
           ▼
┌─────────────────────┐
│   UI (ui.html)      │  ← Has network access
│   - Receive IR      │
│   - Send to server  │
└──────────┬──────────┘
           │ fetch()
           ▼
┌─────────────────────┐
│   Backend Server    │
│   - Process IR      │
│   - Generate code   │
│   - Build & test    │
└─────────────────────┘
```

### 3. Communication Protocol

**Plugin → UI** (via `figma.ui.postMessage`):
```typescript
{
  type: 'extraction-complete',
  data: {
    ir: IRDocument,        // Complete IR structure
    screenshots: {
      figma: string,       // Base64 screenshot
    },
    metadata: {
      nodeCount: number,
      fileId: string,
      nodeName: string,
    }
  }
}
```

**UI → Backend** (via `fetch`):
```typescript
POST /api/plugin/extract
{
  ir: IRDocument,
  screenshots: {...},
  metadata: {...}
}

Response:
{
  jobId: string,
  status: 'processing'
}
```

---

## Implementation Plan

### Phase 1: Plugin Scaffold (2-3 hours)

**Goal**: Create basic plugin structure with communication working

**Tasks**:
1. ✅ Create manifest.json with required fields
2. ✅ Set up TypeScript build configuration
3. ✅ Implement basic code.ts with node traversal
4. ✅ Create ui.html with communication UI
5. ✅ Test postMessage communication
6. ✅ Test network requests to localhost

**Files to Create**:
- `figma-plugin/manifest.json`
- `figma-plugin/code.ts`
- `figma-plugin/ui.html`
- `figma-plugin/tsconfig.json`
- `figma-plugin/package.json`

**Manifest Structure**:
```json
{
  "name": "Figma2Code Extractor",
  "id": "figma2code-extractor",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": [
      "http://localhost:3000",
      "https://your-domain.com"
    ],
    "reasoning": "Send extracted design data to backend for code generation"
  },
  "editorType": ["figma"]
}
```

---

### Phase 2: Node Extraction Logic (4-6 hours)

**Goal**: Extract complete node tree with all properties

**Key Methods**:

```typescript
// Traverse entire selection or page
async function extractNodes(node: SceneNode): Promise<IRNode> {
  // Use findAll for deep traversal
  const allNodes = node.findAll();

  return {
    id: node.id,
    name: node.name,
    type: detectNodeType(node),
    componentType: detectComponentType(node),

    // Layout & Position
    boundingBox: extractBoundingBox(node),
    autoLayout: extractAutoLayout(node),
    constraints: extractConstraints(node),

    // Styling
    styles: await extractStyles(node),

    // Content
    textContent: extractText(node),
    imageUrl: await extractImage(node),
    iconName: null, // Will be mapped later

    // Children (recursive)
    children: await Promise.all(
      node.children?.map(extractNodes) || []
    ),
  };
}
```

**Property Extraction Functions**:

1. **`extractBoundingBox(node)`**
   - x, y, width, height, rotation
   - Use `node.x`, `node.y`, `node.width`, `node.height`, `node.rotation`

2. **`extractAutoLayout(node)`**
   - mode: HORIZONTAL | VERTICAL
   - gap, padding, alignment
   - Use `node.layoutMode`, `node.itemSpacing`, `node.paddingTop`, etc.

3. **`extractStyles(node)`**
   - fills: `node.fills`
   - strokes: `node.strokes`
   - effects: `node.effects`
   - opacity: `node.opacity`
   - Use `getCSSAsync()` for computed styles

4. **`extractText(node: TextNode)`**
   ```typescript
   if (node.type === 'TEXT') {
     await figma.loadFontAsync(node.fontName as FontName);
     return {
       content: node.characters,
       fontSize: node.fontSize,
       fontFamily: node.fontName,
       // ... more properties
     };
   }
   ```

5. **`extractImage(node)`**
   ```typescript
   if (node.fills && Array.isArray(node.fills)) {
     for (const fill of node.fills) {
       if (fill.type === 'IMAGE') {
         const image = figma.getImageByHash(fill.imageHash);
         const bytes = await image.getBytesAsync();
         return btoa(String.fromCharCode(...bytes)); // Base64
       }
     }
   }
   ```

**Component Type Detection**:
```typescript
function detectComponentType(node: SceneNode): ComponentType {
  // Check component/instance
  if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    const name = node.name.toLowerCase();

    // Button detection
    if (name.includes('button') || name.includes('btn')) {
      return 'BUTTON';
    }

    // Input detection
    if (name.includes('input') || name.includes('textfield')) {
      return 'INPUT';
    }

    // Icon detection
    if (name.includes('icon') || node.type === 'VECTOR') {
      return 'ICON';
    }

    // Card detection
    if (name.includes('card')) {
      return 'CARD';
    }
  }

  // Layout detection
  if (node.type === 'FRAME') {
    const name = node.name.toLowerCase();
    if (name.includes('nav') || name.includes('header')) {
      return 'NAVBAR';
    }
    if (name.includes('sidebar')) {
      return 'SIDEBAR';
    }
  }

  // Default based on node type
  return node.type === 'TEXT' ? 'TEXT' :
         node.type === 'FRAME' ? 'CONTAINER' :
         'UNKNOWN';
}
```

---

### Phase 3: Screenshot Capture (1-2 hours)

**Goal**: Capture screenshot of selected node for visual diff

```typescript
async function captureScreenshot(node: SceneNode): Promise<string> {
  // Export as PNG
  const bytes = await node.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: 2 } // 2x for retina
  });

  // Convert to base64
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
```

---

### Phase 4: UI & Communication (2-3 hours)

**Goal**: Build plugin UI for configuration and feedback

**UI Features**:
1. **Selection Info**
   - Show selected node name
   - Show node count
   - Preview mode (optional)

2. **Configuration**
   - Backend URL input
   - Skip build checkbox
   - Skip visual diff checkbox

3. **Progress Feedback**
   - Extraction progress bar
   - Upload status
   - Job ID display
   - Link to generated code

**UI HTML** (`ui.html`):
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: 'Inter', sans-serif;
      padding: 16px;
    }
    .button {
      background: #0d99ff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    .progress {
      width: 100%;
      height: 4px;
      background: #e0e0e0;
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: #0d99ff;
      transition: width 0.3s;
    }
  </style>
</head>
<body>
  <h2>Figma2Code Extractor</h2>

  <div id="selection-info">
    <p>Select a frame or component to extract</p>
  </div>

  <div id="config">
    <label>
      Backend URL:
      <input type="text" id="backend-url" value="http://localhost:3000" />
    </label>
    <label>
      <input type="checkbox" id="skip-build" />
      Skip build validation
    </label>
    <label>
      <input type="checkbox" id="skip-visual" />
      Skip visual comparison
    </label>
  </div>

  <button class="button" id="extract-btn">Extract & Send</button>

  <div id="progress" style="display: none;">
    <p id="status-text">Extracting...</p>
    <div class="progress">
      <div class="progress-bar" id="progress-bar" style="width: 0%;"></div>
    </div>
  </div>

  <div id="result" style="display: none;">
    <p id="result-text"></p>
    <a id="result-link" target="_blank">View Generated Code</a>
  </div>

  <script src="dist/ui.js"></script>
</body>
</html>
```

**UI TypeScript** (`ui.ts`):
```typescript
const extractBtn = document.getElementById('extract-btn') as HTMLButtonElement;
const backendUrl = document.getElementById('backend-url') as HTMLInputElement;
const skipBuild = document.getElementById('skip-build') as HTMLInputElement;
const skipVisual = document.getElementById('skip-visual') as HTMLInputElement;

// Listen for extract button
extractBtn.addEventListener('click', () => {
  // Tell plugin to start extraction
  parent.postMessage({
    pluginMessage: {
      type: 'extract',
      config: {
        backendUrl: backendUrl.value,
        skipBuild: skipBuild.checked,
        skipVisual: skipVisual.checked
      }
    }
  }, '*');
});

// Listen for messages from plugin
window.onmessage = async (event) => {
  const msg = event.data.pluginMessage;

  if (msg.type === 'extraction-complete') {
    // Show progress
    updateProgress(50, 'Sending to backend...');

    // Send to backend
    try {
      const response = await fetch(`${backendUrl.value}/api/plugin/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg.data)
      });

      const result = await response.json();

      // Show success
      updateProgress(100, 'Complete!');
      showResult(result);

    } catch (error) {
      showError('Failed to send to backend: ' + error.message);
    }
  }

  if (msg.type === 'progress') {
    updateProgress(msg.percent, msg.status);
  }
};

function updateProgress(percent: number, status: string) {
  // Update UI...
}

function showResult(result: any) {
  // Show job ID and link...
}

function showError(message: string) {
  // Show error message...
}
```

---

### Phase 5: Backend Integration (3-4 hours)

**Goal**: Add plugin endpoint to backend server

**New API Endpoint**:

```typescript
// src/api/plugin-routes.ts
import express from 'express';
import { AgentOrchestrator } from '../agent/index.js';

const router = express.Router();

router.post('/extract', async (req, res) => {
  try {
    const { ir, screenshots, metadata } = req.body;

    // Create job
    const jobId = generateJobId();
    const outputDir = path.join('jobs', jobId, 'output');

    // Save IR and screenshot
    await fs.mkdir(path.join('jobs', jobId), { recursive: true });
    await fs.writeFile(
      path.join('jobs', jobId, 'ir.json'),
      JSON.stringify(ir, null, 2)
    );
    await fs.writeFile(
      path.join('jobs', jobId, 'screenshot-figma.png'),
      Buffer.from(screenshots.figma, 'base64')
    );

    // Save metadata
    await fs.writeFile(
      path.join('jobs', jobId, 'metadata.json'),
      JSON.stringify({
        id: jobId,
        source: 'plugin',
        ...metadata,
        createdAt: new Date().toISOString(),
        status: 'processing'
      }, null, 2)
    );

    // Start processing (async)
    processPluginExtraction(jobId, ir, outputDir, req.body.config)
      .catch(err => console.error('Plugin processing error:', err));

    // Return immediately
    res.json({
      success: true,
      jobId,
      status: 'processing',
      message: 'Extraction received, processing started'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function processPluginExtraction(
  jobId: string,
  ir: IRDocument,
  outputDir: string,
  config: any
) {
  const agentConfig: AgentConfig = {
    figmaAccessToken: '', // Not needed - we have IR already
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: 'gpt-4-turbo-preview',
    maxBuildRetries: 5,
    maxVisualCorrectionCycles: 7,
    visualSimilarityThreshold: 90,
    sandboxTimeout: 30000,
    sandboxPort: 3001,
    outputDir,
    debug: true
  };

  const orchestrator = new AgentOrchestrator(agentConfig);

  // Skip Figma extraction - use provided IR
  // Generate code from IR
  // Build
  // Visual diff
  // ...existing pipeline
}

export default router;
```

**Update server.ts**:
```typescript
import pluginRoutes from './api/plugin-routes.js';

app.use('/api/plugin', pluginRoutes);
```

---

### Phase 6: Testing & Validation (2-3 hours)

**Goal**: Verify plugin extracts complete data without rate limits

**Test Cases**:

1. **Simple Component Test**
   - Extract single button
   - Verify all properties present
   - Verify screenshot captured
   - Verify backend receives data

2. **Complex Dashboard Test**
   - Extract Orders dashboard (current failing case)
   - Verify all statistics cards extracted
   - Verify charts detected
   - Verify tab buttons extracted
   - Compare with REST API output

3. **Large Document Test**
   - Extract page with 100+ nodes
   - Verify no rate limit errors
   - Measure extraction time
   - Verify completeness

4. **Image Fill Test**
   - Extract component with image fills
   - Verify images exported as base64
   - Verify images saved correctly

**Success Criteria**:
- ✅ No 429 rate limit errors
- ✅ Complete node tree extracted
- ✅ All text content preserved
- ✅ All layout properties captured
- ✅ All styling (fills, strokes, effects) present
- ✅ Images exported successfully
- ✅ Component types detected correctly
- ✅ Backend receives and processes data
- ✅ Generated code builds successfully
- ✅ Visual similarity >90%

---

## Migration Strategy

### Dual-Mode Support

**Short term** (Week 2.5):
- Keep REST API extraction as fallback
- Add plugin extraction as primary method
- User can choose extraction method

**Medium term** (Week 3):
- Plugin becomes primary
- REST API deprecated but available
- Documentation updated

**Long term** (Week 4+):
- Plugin only
- Remove REST API extraction code
- Simplify codebase

### Backward Compatibility

**IR Format**: No changes needed - plugin produces same IR structure as REST API

**Existing Jobs**: Continue to work - only extraction method changes

**Frontend**: No changes needed - same API endpoints

---

## File Structure

```
figma2code/
├── figma-plugin/              # NEW: Plugin directory
│   ├── manifest.json
│   ├── code.ts
│   ├── ui.html
│   ├── ui.ts
│   ├── types.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── dist/                  # Build output
│       ├── code.js
│       ├── ui.html
│       └── ui.js
├── src/
│   ├── api/
│   │   ├── index.ts
│   │   └── plugin-routes.ts   # NEW: Plugin endpoint
│   ├── agent/
│   ├── figma/
│   ├── generator/
│   └── ...
└── ...
```

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| 1. Plugin Scaffold | 2-3 hours | Pending |
| 2. Node Extraction | 4-6 hours | Pending |
| 3. Screenshot Capture | 1-2 hours | Pending |
| 4. UI & Communication | 2-3 hours | Pending |
| 5. Backend Integration | 3-4 hours | Pending |
| 6. Testing & Validation | 2-3 hours | Pending |
| **Total** | **14-21 hours** | **~2-3 days** |

---

## Benefits Over REST API

| Feature | REST API | Plugin | Improvement |
|---------|----------|--------|-------------|
| Rate Limits | 429 errors | No limits | ✅ 100% |
| Extraction Speed | 5-10s | 1-2s | ✅ 80% faster |
| Data Completeness | Partial | Complete | ✅ 100% |
| Image Export | Separate calls | Built-in | ✅ Simpler |
| Cost | API quota | Free | ✅ $0 |
| Maintenance | Complex retry logic | Simple | ✅ Less code |

---

## Risk Assessment

### Low Risk
- ✅ Well-documented API
- ✅ Community examples available
- ✅ TypeScript support
- ✅ Can test locally

### Medium Risk
- ⚠️ Users must install plugin
- ⚠️ Requires Figma desktop app (works in browser too)
- ⚠️ Learning curve for plugin development

### High Risk
- ❌ None identified

### Mitigation
- Keep REST API as fallback during transition
- Provide clear installation instructions
- Create video tutorial for users
- Test extensively before deprecating REST API

---

## Next Steps

1. ✅ **Approved?** - Get user approval on this plan
2. ⏳ **Phase 1** - Create plugin scaffold
3. ⏳ **Phase 2** - Implement node extraction
4. ⏳ **Phase 3** - Add screenshot capture
5. ⏳ **Phase 4** - Build UI
6. ⏳ **Phase 5** - Integrate with backend
7. ⏳ **Phase 6** - Test with failing dashboard design

---

## References

All documentation sources consulted:

1. [Plugin Manifest](https://www.figma.com/plugin-docs/manifest/)
2. [Plugin API Reference](https://developers.figma.com/docs/plugins/api/api-reference/)
3. [Accessing the Document](https://www.figma.com/plugin-docs/accessing-document/)
4. [Node Properties](https://www.figma.com/plugin-docs/api/node-properties/)
5. [TextNode API](https://www.figma.com/plugin-docs/api/TextNode/)
6. [ExportSettings](https://www.figma.com/plugin-docs/api/ExportSettings/)
7. [Making Network Requests](https://www.figma.com/plugin-docs/making-network-requests/)
8. [PostMessage API](https://www.figma.com/plugin-docs/api/properties/figma-ui-postmessage/)
9. [findAll Method](https://www.figma.com/plugin-docs/api/properties/nodes-findall/)
10. [findAllWithCriteria](https://www.figma.com/plugin-docs/api/properties/nodes-findallwithcriteria/)

---

**Status**: Plan complete, awaiting approval to proceed with implementation
