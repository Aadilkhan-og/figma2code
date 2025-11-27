# POSTDEV Setup Guide

This guide walks you through setting up and running the POSTDEV backend service for early access.

## Prerequisites

- Node.js 18+ installed
- Figma Access Token ([Get one here](https://www.figma.com/developers/api#access-tokens))
- OpenAI API Key ([Get one here](https://platform.openai.com/api-keys))

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
FIGMA_ACCESS_TOKEN=your_figma_token_here
OPENAI_API_KEY=your_openai_key_here
PORT=3001
```

**How to get your tokens:**

- **Figma Token**: Go to Figma → Settings → Account → Personal Access Tokens → Generate new token
- **OpenAI Key**: Go to platform.openai.com → API Keys → Create new secret key

### 3. Start the Server

```bash
npm run server
```

You should see:

```
╔═══════════════════════════════════════════╗
║                                           ║
║      POSTDEV Backend Server Running       ║
║                                           ║
╚═══════════════════════════════════════════╝

  🚀 Server:  http://0.0.0.0:3001
  📊 Health:  http://0.0.0.0:3001/api/health
  📝 Jobs:    http://0.0.0.0:3001/api/jobs
```

### 4. Open the Demo

Open your browser and go to:

```
http://localhost:3001
```

You'll see the POSTDEV demo interface where you can paste a Figma URL and generate code.

## Testing the API

### Health Check

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-11-27T...",
  "ready": true,
  "figmaConnected": true,
  "openaiConnected": true,
  "errors": []
}
```

### Create a Job

```bash
curl -X POST http://localhost:3001/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "figmaUrl": "https://www.figma.com/file/YOUR_FILE_ID/Your-Design"
  }'
```

Response:

```json
{
  "jobId": "abc123def456",
  "status": "pending",
  "figmaUrl": "https://www.figma.com/file/...",
  "createdAt": "2025-11-27T..."
}
```

### Check Job Status

```bash
curl http://localhost:3001/api/jobs/abc123def456
```

Response:

```json
{
  "id": "abc123def456",
  "status": "processing",
  "progress": 45,
  "currentPhase": "Generating React code...",
  "createdAt": "2025-11-27T...",
  "updatedAt": "2025-11-27T..."
}
```

### Download Bundle

Once the job status is `complete`:

```bash
curl -O http://localhost:3001/api/jobs/abc123def456/download
```

This downloads `postdev-abc123def456.zip` containing your generated React code.

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/jobs` | Create new job |
| GET | `/api/jobs/:id` | Get job status |
| GET | `/api/jobs/:id/download` | Download bundle |
| GET | `/api/jobs` | List all jobs (admin) |
| DELETE | `/api/jobs/:id` | Delete job (admin) |

### Job Lifecycle

1. **pending** → Job created, waiting to start
2. **processing** → Job is running (0-100% progress)
3. **complete** → Job finished successfully, bundle ready
4. **failed** → Job failed, check `error` field

## Project Structure

```
figma2code/
├── src/
│   ├── api/              # POSTDEV API wrapper
│   │   └── index.ts      # generateFromFigmaLink()
│   ├── backend/          # Backend service
│   │   ├── server.ts     # Express server
│   │   └── job-storage.ts # Job persistence
│   ├── agent/            # Orchestrator (existing engine)
│   ├── figma/            # Figma extraction (existing)
│   ├── generator/        # Code generation (existing)
│   └── ...               # Other modules
├── public/
│   └── index.html        # Demo frontend
├── jobs/                 # Job storage directory (auto-created)
│   └── {jobId}/
│       ├── metadata.json
│       ├── bundle.zip
│       ├── screenshot-figma.png
│       ├── screenshot-generated.png
│       └── output/       # Generated files
└── .env                  # Environment config
```

## Configuration

You can customize the server via environment variables:

```env
# Required
FIGMA_ACCESS_TOKEN=figd_...
OPENAI_API_KEY=sk-...

# Optional
PORT=3001                     # Server port
MAX_CONCURRENT_JOBS=3         # Max jobs running simultaneously
JOBS_DIR=./jobs               # Job storage directory
CORS_ORIGINS=http://localhost:3000,https://yourapp.com
```

## Troubleshooting

### "FIGMA_ACCESS_TOKEN not set"

Make sure you created a `.env` file with your Figma token.

### "Too many concurrent jobs"

The server limits concurrent jobs to prevent overload. Wait for running jobs to finish or increase `MAX_CONCURRENT_JOBS`.

### Job stuck in "processing"

Check the server logs for errors. Common issues:
- Invalid Figma URL or file not accessible
- OpenAI API quota exceeded
- Build errors in generated code

### Download fails with 404

Make sure the job status is `complete` before downloading. Check job status first.

## Next Steps

### Week 2 Priorities

Now that the productization layer is complete, next up:

1. **Dynamic Props Extraction** - Make components parameterized
2. **Icon Mapper** - Replace placeholder SVGs with lucide-react icons
3. **Tailwind Config** - Generate config from Figma styles

See `ANALYSIS.md` for the full roadmap.

### Production Deployment

For production, you'll want to:

1. Replace file-based storage with a database (PostgreSQL, MongoDB)
2. Add authentication and user management
3. Set up a proper frontend (Next.js, React)
4. Deploy backend to a cloud service (Railway, Render, Vercel)
5. Add background job processing (BullMQ, etc.)
6. Set up monitoring and logging (Sentry, LogRocket)

But for early access with 10-20 beta users, the current setup works great!

## Early Access Launch Checklist

- [x] Programmatic API wrapper
- [x] Backend service with job management
- [x] Frontend demo page
- [x] File-based job storage
- [ ] Dynamic props extraction (Week 2)
- [ ] Icon mapper (Week 2)
- [ ] Tailwind config generation (Week 3)
- [ ] Performance optimizations (Week 3)
- [ ] Demo video (Week 4)
- [ ] 20 beta users (Week 4)

---

**Questions?** Check the main `README.md` or open an issue.
