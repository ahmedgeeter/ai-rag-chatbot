---
title: AI RAG Chatbot Backend
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# RAG Chat with Groq + FAISS

A production-ready multilingual RAG application built with **FastAPI**, **Next.js 15**, **Groq Llama-3**, and **FAISS**.

This project lets you upload a PDF, index it locally with lightweight vector search, and chat with it through a premium dark UI. It also includes an **agentic router** that decides whether to answer from the uploaded PDF or from the model's general knowledge.

## Why this stack

- **Groq + Llama-3**
  - Uses configurable Groq models with `llama-3.3-70b-versatile` as the current default for low-latency streaming UX.
- **FAISS**
  - Uses **lightweight local vector search** for fast retrieval without requiring an external vector database.
- **FastAPI**
  - Clean backend APIs for upload, retrieval, chat, and streaming.
- **Next.js 15**
  - Modern frontend with streaming chat, markdown rendering, premium dark theme, and source inspection.

## Features

- **PDF upload and indexing**
  - Upload a PDF to `/upload`
  - Split into 800-character chunks
  - Embed with `all-MiniLM-L6-v2` by default, with env-based override for multilingual models
  - Store vectors in local FAISS memory
- **Agentic routing**
  - If the question is about the uploaded document, use FAISS retrieval
  - If the question is unrelated, answer from Groq general knowledge
- **Arabic optimization**
  - Normalizes Arabic text forms during indexing and retrieval for better match quality
- **Streaming chat UI**
  - Tokens stream in real time from the backend
- **Source reveal**
  - Expand the exact snippets used for PDF-grounded answers
- **Latency tracker**
  - Shows `Generated in Xs` under each assistant response
- **Multilingual behavior**
  - Answers in Arabic or English based on the user's language

## Architecture

### Backend

- **Framework**: FastAPI
- **Model**: Groq `llama-3.3-70b-versatile`
- **Embeddings**: HuggingFace `sentence-transformers/all-MiniLM-L6-v2` by default
- **Vector Store**: FAISS
- **Document Loader**: `PyPDFLoader`

### Frontend

- **Framework**: Next.js 15.5.14 + React 19
- **Styling**: Tailwind CSS
- **Markdown**: `react-markdown` + `remark-gfm`
- **Icons**: `lucide-react`
- **Upload UX**: drag-and-drop with glow effect

## Project structure

```text
RAG/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── .dockerignore
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   ├── .dockerignore
│   └── next-env.d.ts
├── docker-compose.yml
├── .gitignore
└── README.md
```

## API overview

### `POST /upload`

Uploads a PDF, extracts text, normalizes Arabic variants, splits into chunks, and builds the FAISS index.

### `POST /chat`

Returns a non-streaming answer with metadata:

- `answer`
- `sources`
- `route`
- `response_time`

### `POST /chat/stream`

Streams the answer through Server-Sent Events.

SSE event types:

- `token`
- `sources`
- `metadata`
- `done`
- `error`

## Environment variables

### Backend

Copy `backend/.env.example` to `backend/.env`:

```bash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
```

### Frontend

Copy `frontend/.env.example` to `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Security

Sensitive environment files are excluded from git.

Ignored by `.gitignore`:

- `backend/.env`
- `frontend/.env.local`
- `.env`
- `.env.*`

Tracked template files:

- `backend/.env.example`
- `frontend/.env.example`

Never commit a real Groq API key.

## Local development

### 1. Backend

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

If you prefer to run from inside `backend/`:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend runs on:

```text
http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:3000
```

## Docker

### Build and run

From the repository root:

```bash
docker compose up --build
```

Services:

- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:8000`

### Docker images

- **Backend image**: `python:3.11-slim`
- **Frontend image**: `node:20-alpine`

## Production notes

- The current FAISS index is **in-memory**.
  - Rebuilding or restarting the backend resets the uploaded document index.
- The backend currently accepts a single active uploaded PDF at a time.
- **Vercel** should host the frontend only.
- **Render** is the recommended host for the current FastAPI backend.
- For a larger production deployment, consider:
  - persistent vector storage
  - authentication
  - file size limits
  - origin restrictions for CORS
  - API rate limiting
  - background job processing for large PDFs

## RAG flow

1. Upload PDF
2. Extract text with `PyPDFLoader`
3. Normalize Arabic text for stronger retrieval
4. Split into chunks
5. Embed with multilingual sentence transformers
6. Store in FAISS
7. Route each user question:
   - **PDF question** → retrieve context from FAISS
   - **General question** → answer directly from Groq
8. Stream answer to the UI
9. Show latency and reveal sources when available

## Troubleshooting

### Frontend TypeScript or JSX errors in the IDE

If you see missing React/JSX/module errors, install frontend dependencies first:

```bash
cd frontend
npm install
```

### Backend key error

If you get `GROQ_API_KEY is not set`, create `backend/.env` from `backend/.env.example` and add your Groq key.

### No PDF context in answers

Upload a PDF first. If a question is unrelated to the PDF, the router may intentionally answer from general knowledge instead.

### Vercel frontend cannot reach the backend

Set `NEXT_PUBLIC_API_URL` in Vercel to your public backend URL, for example:

```bash
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
```

Do not leave it as `https://YOUR-BACKEND-URL` and do not use `localhost` in production.

## Deployment

### Frontend on Vercel

- Import the GitHub repository into Vercel
- Set **Root Directory** to `frontend`
- Set **Framework Preset** to `Next.js`
- Leave **Output Directory** empty
- Add `NEXT_PUBLIC_API_URL` as an environment variable pointing to your deployed backend

### Backend on Render

This repository now includes `render.yaml` for the backend service.

- Create a new **Blueprint** or **Web Service** in Render from this repository
- Use `backend` as the root directory if you create the service manually
- Build command:

```bash
pip install --upgrade pip && pip install -r requirements.txt
```

- Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

- Set these environment variables in Render:

```bash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
```

## Summary

This project combines:

- **Groq Llama-3** for extremely fast streaming inference
- **FAISS** for lightweight local vector retrieval
- **FastAPI** for a clean Python backend
- **Next.js 15** for a polished, premium chat experience

It is optimized for **speed**, **multilingual retrieval**, and a modern **RAG-first UX**.
