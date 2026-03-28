import json
import logging
import os
from pathlib import Path
import re
import shutil
import tempfile
import time
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
try:
    from langchain_core.prompts import (
        ChatPromptTemplate,
        HumanMessagePromptTemplate,
        SystemMessagePromptTemplate,
    )
except ImportError:
    from langchain.prompts import (
        ChatPromptTemplate,
        HumanMessagePromptTemplate,
        SystemMessagePromptTemplate,
    )

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

load_dotenv(BASE_DIR / ".env")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag_api")

app = FastAPI(title="RAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Globals – loaded once at startup to avoid re-initialising on every request
# ---------------------------------------------------------------------------

vector_store: Optional[FAISS] = None
embeddings: Optional[HuggingFaceEmbeddings] = None

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    message: str
    history: list["ChatTurn"] = Field(default_factory=list)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    route: Optional[Literal["pdf", "general"]] = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict[str, str | int]] = Field(default_factory=list)
    route: Literal["pdf", "general"]
    response_time: float


class UploadResponse(BaseModel):
    message: str
    filename: str
    chunks: int


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

RAG_SYSTEM_PROMPT = (
    "You are a helpful assistant. Use ONLY the retrieved PDF context below to answer "
    "the user's question.\n"
    "- If the user writes in Arabic, respond entirely in Arabic.\n"
    "- If the user writes in English, respond entirely in English.\n"
    "- Use the conversation history to resolve follow-up questions like page requests, "
    "quotes, or pronouns that refer to an earlier answer.\n"
    "- The retrieved context contains explicit page labels like [Page 35]. When the "
    "answer comes from the document, mention the relevant page number(s) in the final answer.\n"
    "- If the user asks for a quote, citation, page number, or evidence, quote the most "
    "relevant text exactly as it appears in the retrieved context and include page numbers.\n"
    "- If the answer cannot be found in the context, say so honestly in the user's language "
    "and do NOT make up information.\n\n"
    "Conversation history:\n{history}\n\n"
    "Retrieved PDF context:\n{context}"
)

GENERAL_SYSTEM_PROMPT = (
    "You are a helpful assistant.\n"
    "- If the user writes in Arabic, respond entirely in Arabic.\n"
    "- If the user writes in English, respond entirely in English.\n"
    "- Use the conversation history to resolve follow-up questions when possible.\n"
    "- Answer using your general knowledge.\n"
    "- If you are uncertain, say so honestly."
)

ROUTER_SYSTEM_PROMPT = (
    "You are a routing classifier for a RAG assistant.\n"
    "Decide whether the user's question should be answered from the uploaded PDF "
    "or from general knowledge.\n"
    "If there is an uploaded PDF, prefer pdf when the user asks about the document, "
    "RFC contents, section/page numbers, quotations, evidence, or a follow-up question "
    "that refers to a previous PDF-grounded answer.\n"
    "Reply with exactly one word:\n"
    "- pdf: when the question is about the uploaded file, document, PDF, its "
    "summary, contents, sections, or information likely contained in it.\n"
    "- general: when the question is a broad question unrelated to the uploaded PDF."
)

RAG_PROMPT = ChatPromptTemplate.from_messages(
    [
        SystemMessagePromptTemplate.from_template(RAG_SYSTEM_PROMPT),
        HumanMessagePromptTemplate.from_template("{question}"),
    ]
)

GENERAL_PROMPT = ChatPromptTemplate.from_messages(
    [
        SystemMessagePromptTemplate.from_template(GENERAL_SYSTEM_PROMPT),
        HumanMessagePromptTemplate.from_template(
            "Conversation history:\n{history}\n\nQuestion: {question}"
        ),
    ]
)

ROUTER_PROMPT = ChatPromptTemplate.from_messages(
    [
        SystemMessagePromptTemplate.from_template(ROUTER_SYSTEM_PROMPT),
        HumanMessagePromptTemplate.from_template(
            "Conversation history:\n{history}\n\nQuestion: {question}"
        ),
    ]
)

ARABIC_DIACRITICS_PATTERN = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
WHITESPACE_PATTERN = re.compile(r"\s+")
QUERY_TERM_PATTERN = re.compile(r"[A-Za-z0-9./_-]+|[\u0600-\u06FF]+")

FOLLOW_UP_REFERENCE_HINTS = (
    "في اي صفحه",
    "في اي صفحة",
    "في أي صفحه",
    "في أي صفحة",
    "اذكر الصفحة",
    "اذكر الصفحه",
    "ارقام الصفح",
    "ارقام الصفحات",
    "أرقام الصفحات",
    "استشهد",
    "اقتبس",
    "هات من الكتاب",
    "من الكتاب",
    "من المستند",
    "from the book",
    "from the document",
    "from the pdf",
    "which page",
    "what page",
    "cite",
    "citation",
    "quote",
)

DOCUMENT_REFERENCE_HINTS = FOLLOW_UP_REFERENCE_HINTS + (
    "pdf",
    "document",
    "book",
    "file",
    "section",
    "source",
    "sources",
    "page",
    "pages",
    "rfc",
    "http/1.1",
    "المستند",
    "الوثيقة",
    "الملف",
    "الكتاب",
    "صفحه",
    "صفحة",
    "قسم",
    "مصدر",
    "مصادر",
)

QUERY_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "from",
    "for",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "this",
    "to",
    "what",
    "which",
    "ما",
    "ماذا",
    "هو",
    "هي",
    "في",
    "من",
    "عن",
    "على",
    "الى",
    "إلى",
    "هذا",
    "هذه",
    "هات",
    "اذكر",
    "استشهد",
    "اقتبس",
    "صفحه",
    "صفحة",
    "الصفحه",
    "الصفحة",
}


def normalize_text(text: str) -> str:
    normalized = ARABIC_DIACRITICS_PATTERN.sub("", text or "")
    normalized = normalized.replace("ـ", "")
    normalized = (
        normalized.replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .replace("ٱ", "ا")
        .replace("ة", "ه")
        .replace("ى", "ي")
        .replace("ؤ", "و")
        .replace("ئ", "ي")
    )
    normalized = WHITESPACE_PATTERN.sub(" ", normalized)
    return normalized.strip()


def format_history(history: list[ChatTurn], limit: int = 6) -> str:
    recent_turns = [turn for turn in history if turn.content.strip()][-limit:]
    if not recent_turns:
        return "No prior conversation."

    lines = []
    for turn in recent_turns:
        speaker = "User" if turn.role == "user" else "Assistant"
        route_note = f" [{turn.route}]" if turn.role == "assistant" and turn.route else ""
        content = WHITESPACE_PATTERN.sub(" ", turn.content).strip()
        lines.append(f"{speaker}{route_note}: {content[:600]}")

    return "\n".join(lines)


def format_context(documents) -> str:
    if not documents:
        return "No relevant PDF context retrieved."

    return "\n\n".join(
        f"[Page {document.metadata.get('page', 0) + 1} | Source: {os.path.basename(document.metadata.get('source', ''))}]\n{get_document_text(document)}"
        for document in documents
    )


def extract_query_terms(text: str) -> set[str]:
    normalized = normalize_text(text).lower()
    return {
        term
        for term in QUERY_TERM_PATTERN.findall(normalized)
        if len(term) >= 3 and term not in QUERY_STOPWORDS
    }


def last_pdf_assistant_turn(history: list[ChatTurn]) -> Optional[ChatTurn]:
    for turn in reversed(history):
        if turn.role == "assistant" and turn.route == "pdf" and turn.content.strip():
            return turn
    return None


def is_follow_up_reference_question(question: str, history: list[ChatTurn]) -> bool:
    normalized_question = normalize_text(question).lower()
    if any(hint in normalized_question for hint in FOLLOW_UP_REFERENCE_HINTS):
        return True

    if not history:
        return False

    recent_pdf_answer = last_pdf_assistant_turn(history)
    if recent_pdf_answer is None:
        return False

    return len(normalized_question.split()) <= 6


def build_retrieval_query(question: str, history: list[ChatTurn]) -> str:
    if not history:
        return question

    if not is_follow_up_reference_question(question, history):
        return question

    recent_turns = history[-4:]
    history_lines = []
    for turn in recent_turns:
        speaker = "User" if turn.role == "user" else "Assistant"
        content = WHITESPACE_PATTERN.sub(" ", turn.content).strip()
        history_lines.append(f"{speaker}: {content[:500]}")

    return f"Current question: {question}\nRecent conversation:\n" + "\n".join(history_lines)


def has_retrieval_overlap(question: str, documents) -> bool:
    if not documents:
        return False

    query_terms = extract_query_terms(question)
    if not query_terms:
        return False

    joined_document_text = normalize_text(
        " ".join(get_document_text(document) for document in documents)
    ).lower()
    matches = sum(1 for term in query_terms if term in joined_document_text)

    return matches >= 2 or (len(query_terms) == 1 and matches == 1)


def explicitly_mentions_document(question: str) -> bool:
    normalized_question = normalize_text(question).lower()
    return any(hint in normalized_question for hint in DOCUMENT_REFERENCE_HINTS)


def require_groq_api_key() -> str:
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not set. Add it to the .env file.",
        )
    return groq_api_key


def get_groq_model_name() -> str:
    return os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)


def build_llm(*, streaming: bool = False, temperature: float = 0.2) -> ChatGroq:
    return ChatGroq(
        model=get_groq_model_name(),
        api_key=require_groq_api_key(),
        temperature=temperature,
        streaming=streaming,
    )


def get_embedding_model_name() -> str:
    return os.getenv("EMBEDDING_MODEL_NAME", DEFAULT_EMBEDDING_MODEL)


def get_embeddings() -> HuggingFaceEmbeddings:
    global embeddings

    if embeddings is None:
        embedding_model_name = get_embedding_model_name()
        logger.info("Initialising embeddings model: %s", embedding_model_name)
        embeddings = HuggingFaceEmbeddings(
            model_name=embedding_model_name
        )
        logger.info("Embeddings model is ready")

    return embeddings


def get_document_text(document) -> str:
    return document.metadata.get("original_content") or document.page_content


def build_sources(documents) -> list[dict[str, str | int]]:
    return [
        {
            "text": get_document_text(document),
            "page": document.metadata.get("page", 0) + 1,
            "source": os.path.basename(document.metadata.get("source", "")),
        }
        for document in documents
    ]


def route_question(question: str, history: list[ChatTurn], candidate_documents) -> Literal["pdf", "general"]:
    if vector_store is None:
        return "general"

    if explicitly_mentions_document(question) or is_follow_up_reference_question(question, history):
        return "pdf"

    if has_retrieval_overlap(question, candidate_documents):
        return "pdf"

    router_response = build_llm(temperature=0).invoke(
        ROUTER_PROMPT.format_messages(
            question=question,
            history=format_history(history),
        )
    )
    decision = router_response.content.strip().lower()
    return "pdf" if decision.startswith("pdf") else "general"


def retrieve_documents(question: str):
    if vector_store is None:
        return []
    return vector_store.similarity_search(normalize_text(question), k=5)


def prepare_chat(question: str, history: list[ChatTurn]):
    history_text = format_history(history)
    retrieval_query = build_retrieval_query(question, history)
    candidate_documents = retrieve_documents(retrieval_query)
    route = route_question(question, history, candidate_documents)
    documents = candidate_documents if route == "pdf" else []

    if route == "pdf":
        messages = RAG_PROMPT.format_messages(
            context=format_context(documents),
            history=history_text,
            question=question,
        )
    else:
        messages = GENERAL_PROMPT.format_messages(
            history=history_text,
            question=question,
        )

    return route, documents, messages

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """
    Accept a PDF, split it into 800-character chunks with 100-character overlap,
    embed each chunk with a multilingual MiniLM model, and store in a FAISS index.
    """
    global vector_store
    started_at = time.perf_counter()

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    logger.info("Starting PDF upload processing for %s", file.filename)

    # Persist the upload to a temp file so PyPDFLoader can read it from disk
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        loader = PyPDFLoader(tmp_path)
        documents = loader.load()
        logger.info("Loaded %s pages from %s", len(documents), file.filename)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            length_function=len,
        )
        chunks = splitter.split_documents(documents)
        logger.info("Split %s into %s chunks", file.filename, len(chunks))

        if not chunks:
            raise HTTPException(
                status_code=422, detail="Could not extract any text from the PDF."
            )

        for chunk in chunks:
            original_content = chunk.page_content
            chunk.page_content = normalize_text(original_content) or original_content
            chunk.metadata["original_content"] = original_content
            chunk.metadata["source"] = file.filename

        logger.info("Building FAISS index for %s", file.filename)
        vector_store = FAISS.from_documents(chunks, get_embeddings())
        logger.info(
            "Finished indexing %s in %.2fs",
            file.filename,
            time.perf_counter() - started_at,
        )
    finally:
        os.unlink(tmp_path)

    return UploadResponse(
        message="PDF uploaded and indexed successfully.",
        filename=file.filename,
        chunks=len(chunks),
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    started_at = time.perf_counter()
    try:
        route, documents, messages = prepare_chat(request.message, request.history)
        response = build_llm().invoke(messages)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ChatResponse(
        answer=response.content,
        sources=build_sources(documents),
        route=route,
        response_time=round(time.perf_counter() - started_at, 2),
    )


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    started_at = time.perf_counter()

    try:
        route, documents, messages = prepare_chat(request.message, request.history)
        sources = build_sources(documents)
        llm = build_llm(streaming=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    async def event_generator():
        try:
            async for chunk in llm.astream(messages):
                if chunk.content:
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"
            yield f"data: {json.dumps({'type': 'sources', 'content': sources})}\n\n"
            yield f"data: {json.dumps({'type': 'metadata', 'content': {'response_time': round(time.perf_counter() - started_at, 2), 'route': route}})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
