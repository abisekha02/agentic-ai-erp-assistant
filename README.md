# Enterprise Agentic AI Knowledge Assistant

Employees ask questions about company documents and get answers **with the document and page they came from**.
The assistant can also check a leave balance and draft a leave request, but **never submits anything until the
employee approves it**.

**Stack:** React + TypeScript + Tailwind · Django REST Framework · PostgreSQL + pgvector · OpenAI · LangGraph · JWT

## Architecture

```
React (Vite)  --JWT-->  Django REST API
                          |-- accounts/   register, login, roles (admin / employee)
                          |-- documents/  upload -> extract -> chunk -> embed -> pgvector
                          |-- chat/       LangGraph workflow, RAG, conversations, feedback
                          '-- hr/         leave balance + leave requests (the "approved task")

LangGraph workflow (chat/graph.py)

START -> classify -+-> retrieve -> answer ------------------------> END     (policy questions)
                   +-> leave_balance -----------------------------> END     (reads HR data)
                   +-> smalltalk ---------------------------------> END
                   '-> propose_leave -+-> approval_gate -----------> END     (waits for a human)
                                      '-> asks for missing details-> END
(user clicks Approve / Cancel) --> START -> execute_action --------> END
```

It is **one graph with specialised nodes** (query understanding, retrieval, answering, action, approval), not five
independent agents. Human-in-the-loop works by persisting a `PendingAction` row at `approval_gate`; the graph stops,
and the Approve button re-enters it at `execute_action`. State lives in PostgreSQL, so it survives restarts and
multiple workers.

### Enterprise behaviours worth reading in the code
- **Permission-aware retrieval** - the access filter is inside the SQL vector query (`chat/rag.py`), so restricted chunks never reach the prompt. Tested.
- **Grounded answers** - similarity floor + "answer only from context, else found=false". Unanswerable questions return a refusal instead of a guess.
- **Prompt-injection hygiene** - retrieved text is declared untrusted in the prompt; the LLM can only propose actions, and the action layer re-validates before executing.
- **Idempotent approvals** - row-locked, status-checked; approving twice creates one request. Users can only decide their own actions.
- **Roles** - self-registration always creates an employee; admins are created via `createsuperuser`/Django admin/seed.
- **Citations** - PDF chunks cite `Page N`; DOCX has no stable pages, so chunks cite the nearest heading (`Section: ...`).
- **Observability** - every assistant message stores intent, graph trace, latency, and retrieved chunk scores; users give thumbs up/down.

## Run it locally

```bash
cp .env.example .env            # add OPENAI_API_KEY
docker compose up -d            # Postgres with pgvector

cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo      # demo users + 4 fictional documents (one admin-only)
python manage.py runserver      # http://localhost:8000

cd ../frontend
npm install && npm run dev      # http://localhost:5173
```

Demo logins: `priya / Employee@12345` (employee) and `admin / Admin@12345` (admin).
Try as Priya: *"What is the leave policy?"*, *"How many annual leave days do I have left?"*,
*"Book annual leave for next Monday and Tuesday"*. Then ask *"What is the salary range for band E1?"* as Priya
(refused) and as admin (answered, cited).

No API key? Set `FAKE_AI=1` to explore the UI with a deterministic offline mode. Answers are crude there; it exists for tests.

## Using Gemini's free tier instead of OpenAI
OpenAI's API has no free tier. Any OpenAI-compatible provider works: set `OPENAI_BASE_URL`, `OPENAI_API_KEY`,
`CHAT_MODEL` and `EMBEDDING_MODEL` (see `.env.example`). Embeddings are requested at 1536 dimensions to match the
database column. **Switching embedding models requires re-indexing**: delete and re-upload documents (or Reprocess),
because vectors from different models are not comparable. Free tiers may use your prompts for model training, so
only use them with non-confidential demo documents.

## Tests and evaluation

```bash
cd backend
python manage.py test chat --noinput                 # 13 tests, needs Postgres + pgvector
python manage.py evaluate_rag --no-llm               # retrieval only (cheap)
python manage.py evaluate_rag                        # retrieval + answer correctness + refusal accuracy
```
`evaluation/questions.json` holds labelled questions (including permission and unanswerable cases). **Run it with real
OpenAI keys and record your numbers here**, then tune `CHUNK_TOKENS`, `RETRIEVAL_TOP_K`, `MIN_SIMILARITY`.

| Date | Chunk size | top-k | Retrieval hit rate | Answer correctness | Correct refusals |
|------|-----------|-------|--------------------|--------------------|------------------|
| _fill in_ | 600 | 5 | | | |

## Deploy
- **Backend (Render):** `render.yaml` provisions Postgres + web service. The pgvector extension is created by the first migration. Set `OPENAI_API_KEY`, `FRONTEND_ORIGIN`, attach a disk for `MEDIA_ROOT`. Then run `python manage.py seed_demo` once from the Render shell.
- **Frontend (Vercel):** root directory `frontend`, env var `VITE_API_URL=https://<your-render-app>.onrender.com/api`.

## Known limits / next steps
- Ingestion runs inside the upload request (fine for small files; move to a task queue for big ones). Scanned PDFs need OCR.
- Retrieval is vector-only; add keyword (BM25) hybrid search and a reranker if the evaluation shows misses.
- Tokens are kept in `localStorage` for simplicity; use httpOnly cookies for production.
- The admin Analytics page (questions per day, not-found rate, helpful rate, most-cited documents, downvoted answers) reads from `GET /api/chat/stats/`.
- Leave approval by a manager (the next step after "submitted") is not built.
