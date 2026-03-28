---
title: Explainable Multilingual RAG Workspace
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Explainable Multilingual RAG Workspace

A portfolio-grade Retrieval-Augmented Generation application built with **FastAPI**, **Next.js 15**, **Groq**, and **FAISS**.

This project lets a user upload a PDF, build a searchable vector index, ask questions in **Arabic or English**, and receive answers that are either:

- **Grounded in the uploaded document** with source snippets and page references
- **Answered from general knowledge** when the question is not document-specific

The application also includes an **RAG Inspector** that exposes routing decisions, retrieval query details, chunk usage, and source metadata to make the system more transparent and easier to evaluate.

## Table of contents

- [What this project demonstrates](#what-this-project-demonstrates)
- [Core features](#core-features)
- [Real use cases](#real-use-cases)
- [Why this is more than a generic chatbot](#why-this-is-more-than-a-generic-chatbot)
- [System architecture](#system-architecture)
- [High-level flow](#high-level-flow)
- [Engineering decisions and trade-offs](#engineering-decisions-and-trade-offs)
- [Challenges I faced and how I solved them](#challenges-i-faced-and-how-i-solved-them)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [API overview](#api-overview)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Docker](#docker)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Future improvements](#future-improvements)

## What this project demonstrates

- **AI product thinking**
  - This is not just a chat UI. It combines retrieval, routing, explainability, streaming, and deployment into one usable product.
- **RAG engineering**
  - Document ingestion, chunking, embeddings, FAISS retrieval, prompt orchestration, and source-grounded answers.
- **Multilingual UX**
  - Arabic and English support in both retrieval behavior and interface rendering.
- **Production awareness**
  - Deployment-oriented environment handling, CORS control, health endpoints, Docker support, and frontend/backend separation.

## Core features

- **PDF upload and indexing**
  - Upload a single PDF and build an in-memory FAISS index for retrieval.
- **Agentic routing**
  - Questions are routed between:
    - **PDF context** when the question is about the uploaded document
    - **General knowledge** when the question is unrelated to the PDF
- **Arabic-aware retrieval improvements**
  - Arabic text normalization improves match quality across different letter forms.
- **Follow-up question handling**
  - Recent conversation history is sent to the backend so follow-up questions can resolve pronouns, page requests, and references.
- **Streaming responses**
  - Assistant answers are streamed token-by-token for a smoother UX.
- **Source citations**
  - PDF-grounded answers expose source snippets and page numbers.
- **RAG Inspector**
  - The UI can show:
    - route used
    - retrieval query
    - chunk usage
    - decision basis
    - source documents and pages
- **Readable Arabic + English interface**
  - Direction-aware message rendering and Arabic-friendly typography.

## Real use cases

- **Technical document assistant**
  - Ask questions about RFCs, manuals, specifications, API references, or internal technical docs.
- **Research paper exploration**
  - Summarize key findings, extract evidence, and ask follow-up questions with citations.
- **Policy and compliance review**
  - Find exact passages, sections, or page references in long documents.
- **Bilingual knowledge retrieval**
  - Useful when users ask in Arabic about an English or mixed-language document, or switch languages across turns.

## Why this is more than a generic chatbot

Many chatbot demos only wrap an LLM with a simple interface.

This project is different because it includes:

- **retrieval-aware answer generation**
- **question routing between multiple answer strategies**
- **conversation-aware retrieval for follow-up questions**
- **page-aware citation formatting**
- **inspectable metadata for explainability**
- **real deployment constraints and fixes**

That makes it much closer to a real **AI engineer portfolio project** than a standard chat clone.

## System architecture

### Frontend

- **Framework**: Next.js 15.5.14 + React 19
- **Styling**: Tailwind CSS
- **Markdown rendering**: `react-markdown` + `remark-gfm`
- **UX features**:
  - drag-and-drop PDF upload
  - streaming chat
  - source reveal panel
  - RAG inspector panel
  - Arabic/English direction-aware rendering

### Backend

- **Framework**: FastAPI
- **LLM provider**: Groq
- **Default model**: `llama-3.3-70b-versatile`
- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2`
- **Vector store**: FAISS
- **Document loader**: `PyPDFLoader`
- **Core responsibilities**:
  - upload and parsing
  - chunking and indexing
  - retrieval
  - routing
  - prompt construction
  - streaming responses
  - deployment-friendly health checks and CORS

## High-level flow

```text
User uploads PDF
  -> backend extracts text with PyPDFLoader
  -> text is normalized and chunked
  -> chunks are embedded with HuggingFace embeddings
  -> vectors are stored in FAISS

User asks a question
  -> backend builds a retrieval query
  -> backend retrieves candidate chunks from FAISS
  -> router decides: PDF-grounded answer or general answer
  -> backend prepares the final prompt
  -> LLM response is streamed to the frontend
  -> UI shows answer, latency, sources, and inspector metadata
```

## Engineering decisions and trade-offs

### Why Groq

- Excellent latency for a responsive chat experience
- Strong fit for streaming UX demos and interactive document QA
- Model can be swapped via environment variable instead of hardcoding it

### Why FAISS

- Fast local similarity search
- No need for an external vector database for a portfolio-scale app
- Simple and effective for a single-user, single-document workflow

### Why FastAPI

- Clean API layer for upload, chat, and streaming endpoints
- Good fit for Python-based RAG orchestration
- Easy deployment to Docker-based platforms

### Why Next.js

- Great developer experience for modern UI work
- Easy deployment on Vercel
- Strong fit for a polished frontend with streaming and stateful chat interactions

### Current trade-offs

- The FAISS index is **in memory**
- The app currently supports **one active uploaded PDF at a time**
- There is **no authentication or persistence layer yet**

These trade-offs were intentional to keep the first version focused, deployable, and easy to explain.

## Challenges I faced and how I solved them

This section is important because it shows the engineering work behind the project, not just the final output.

### 1. Arabic retrieval quality was weaker than expected

**Problem**

Arabic text can vary in form, which hurts naive matching and retrieval quality.

**What I changed**

- Added Arabic normalization in the backend
- Normalized important Arabic character variants before retrieval
- Kept the retrieval layer lightweight while improving relevance

**Result**

Better document matching and more reliable answers for Arabic questions.

### 2. Follow-up questions were hard to resolve correctly

**Problem**

Questions like “في أي صفحة؟” or “quote that part” depend on previous turns and often fail if the backend only sees the latest user message.

**What I changed**

- Sent recent conversation history from the frontend to the backend
- Added history-aware retrieval query building
- Improved routing heuristics for reference-style follow-ups

**Result**

The assistant handles follow-up questions much better, especially around document references, pages, and quotations.

### 3. Answers needed clearer evidence and explainability

**Problem**

A RAG system is much more credible when the user can inspect why an answer was produced.

**What I changed**

- Added source snippets and page metadata
- Formatted retrieved context with page labels
- Built an **Inspector** panel to expose route, retrieval query, chunk counts, and decision basis

**Result**

The project now demonstrates explainability instead of acting like a black-box chatbot.

### 4. Hardcoded model assumptions were risky for deployment

**Problem**

If a hosted LLM model is retired or renamed, hardcoded values can break production behavior.

**What I changed**

- Made the Groq model configurable via `GROQ_MODEL`
- Made the embedding model configurable via `EMBEDDING_MODEL_NAME`

**Result**

The project is more robust and easier to maintain across provider changes.

### 5. Public deployment introduced backend configuration issues

**Problem**

A local FastAPI app may work fine in development but still need deployment-safe CORS and runtime settings.

**What I changed**

- Added configurable `ALLOWED_ORIGINS`
- Added configurable `ALLOWED_ORIGIN_REGEX`
- Added health endpoints
- Made the backend port environment-driven
- Added Docker configuration for deployment platforms

**Result**

The backend became much more production-friendly.

### 6. Vercel deployment initially failed because of project configuration

**Problem**

The frontend deployment was being affected by incorrect project settings and an invalid root-level Vercel configuration.

**What I changed**

- Removed the incorrect Python-oriented Vercel routing/build behavior from the root config
- Set the Vercel deployment to use the `frontend` directory correctly
- Updated Next.js to a safe current version used in this repo

**Result**

The frontend is aligned with Vercel's expected Next.js deployment flow.

### 7. Backend cold starts needed attention on free hosting

**Problem**

Embedding setup and Python AI dependencies can make free-host cold starts slow.

**What I changed**

- Kept embeddings lazy-loaded
- Used a lighter default embedding model
- Adjusted Docker setup to be more compatible with CPU-based deployment

**Result**

The backend became more practical for free-tier hosting and portfolio demos.

## Tech stack

- **Frontend**: Next.js 15.5.14, React 19, Tailwind CSS, TypeScript
- **Backend**: FastAPI, LangChain, Groq, FAISS, PyPDFLoader
- **Embeddings**: Hugging Face sentence-transformers
- **Deployment**: Vercel for frontend, Hugging Face Spaces for backend, Render configuration included as an alternative
- **Containerization**: Docker

## Repository structure

```text
RAG/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── .env.example
├── Dockerfile
├── render.yaml
├── vercel.json
└── README.md
```

## API overview

### `POST /upload`

Uploads a PDF, extracts text, normalizes content, splits it into chunks, and builds the FAISS index.

### `POST /chat`

Returns a non-streaming JSON response with:

- `answer`
- `sources`
- `route`
- `response_time`
- `inspector`

### `POST /chat/stream`

Streams the answer through Server-Sent Events.

Supported SSE event types:

- `token`
- `sources`
- `metadata`
- `done`
- `error`

### Health endpoints

- `GET /`
- `GET /health`
- `GET /health/ready`

These make the backend easier to deploy and observe in production.

## Environment variables

### Backend

Copy `backend/.env.example` to `backend/.env`:

```bash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ALLOWED_ORIGIN_REGEX=https://.*\.vercel\.app
```

### Frontend

Copy `frontend/.env.example` to `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Local development

### Backend

From the repository root:

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Or from inside `backend/`:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Local URLs

- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:8000`

## Docker

From the repository root:

```bash
docker compose up --build
```

Services:

- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:8000`

## Deployment

### Frontend on Vercel

- Import the repository into Vercel
- Set **Root Directory** to `frontend`
- Use **Next.js** as the framework preset
- Leave **Output Directory** empty
- Set `NEXT_PUBLIC_API_URL` to your deployed backend URL

The root `vercel.json` is intentionally minimal so it does not override Next.js behavior.

### Backend on Hugging Face Spaces

This repository includes a root `Dockerfile` configured for Docker-based deployment on Hugging Face Spaces.

Required environment variables:

```bash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
ALLOWED_ORIGIN_REGEX=https://.*\.vercel\.app
```

### Optional backend deployment on Render

`render.yaml` is included if you want to deploy the backend on Render instead.

## Troubleshooting

### `GROQ_API_KEY is not set`

Create `backend/.env` from `backend/.env.example` and add a valid Groq API key.

### The frontend cannot reach the backend

Make sure `NEXT_PUBLIC_API_URL` points to your deployed backend URL, not `localhost` in production.

### Answers are not using the PDF

- Make sure a PDF has been uploaded first
- If the question is unrelated to the document, the router may intentionally answer from general knowledge

### First upload is slow

That can happen on cold starts because embeddings may still be loading or downloading on the backend host.

## Limitations

- The FAISS index is **in memory only**
- Restarting the backend resets the uploaded document index
- Only **one active PDF** is supported at a time
- There is currently **no authentication**
- There is currently **no persistent storage layer**

## Future improvements

- Multi-document support
- Persistent vector storage
- Authentication and user workspaces
- Evaluation dashboard for retrieval quality
- Usage analytics and observability
- Background processing for large PDFs

## Why I think this project is portfolio-worthy

This repository demonstrates more than prompt usage. It shows the ability to:

- design a full-stack AI system
- reason about retrieval quality
- handle multilingual and follow-up behavior
- build explainability into the UX
- debug deployment issues across platforms
- improve developer and user experience iteratively

For a hiring manager or tech lead, the strongest signal is not just that the app works, but that the project reflects **engineering decisions, trade-offs, debugging, and product thinking**.

## Summary

This project combines:

- **Groq** for fast inference and streaming
- **FAISS** for lightweight vector retrieval
- **FastAPI** for RAG orchestration APIs
- **Next.js 15** for a polished frontend
- **Explainability tooling** through the RAG Inspector

It is designed to showcase practical AI engineering around **retrieval**, **routing**, **multilingual UX**, **deployment**, and **transparent answer generation**.
