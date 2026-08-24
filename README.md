# 🎓 RepoTutor

**RepoTutor** is an end-to-end, repository-grounded AI platform for code comprehension, architecture visualization, RAG-assisted contextual chat, fine-tuning dataset generation, and model evaluation.

RepoTutor bridges the gap between raw codebase repositories and custom Code-LLMs by parsing Abstract Syntax Trees (ASTs), mapping visual component structures, providing code intelligence, generating instruction-tuning datasets directly from target repositories, and fine-tuning & evaluating custom model adapters.

---

## 🌟 Key Features

### 1. 📂 Repository Ingestion & Management
- Connect public or private GitHub repositories seamlessly.
- Track repository state, commit history, language breakdowns, and metadata.
- Background cloning and execution status tracking.

### 2. 🌳 Tree-Sitter AST Code Parsing
- Multi-language AST extraction powered by `tree-sitter` (Python, JavaScript, TypeScript, Java).
- Automatic identification of classes, functions, methods, imports, docstrings, and lines of code (LOC).
- Structural indexing stored in Supabase for fast graph building and context retrieval.

### 3. 🕸️ Interactive Architecture Visualizer
- Dynamic visual graph powered by `@xyflow/react` (React Flow).
- Node-based hierarchical view of codebase directories, files, functions, and cross-file dependencies.
- Interactive filtering by file type, depth, and structural complexity.

### 4. 💬 Repository RAG Chat & Intelligence Hub
- Grounded codebase Q&A using structural context and code snippets.
- Automated code summaries, complexity distribution analytics, and maintainability metrics.
- Persisted chat threads linked to specific repositories and AST references.

### 5. ⚡ Repository-Grounded Fine-Tuning & Dataset Pipeline
- **Dataset Generator**: Automatically creates JSONL instruction-tuning datasets (`train.jsonl`, `validation.jsonl`) from parsed ASTs, docstrings, and context pairs.
- **LoRA / QLoRA Training Engine**: Configurable fine-tuning workflows built on Hugging Face (`transformers`, `peft`, `accelerate`). Supports models such as `Qwen2.5-Coder`.
- **Live Job Monitoring**: Epoch tracking, loss curves, training metrics, adapter path resolution, and fallback simulation mode for CPU/GPU-less testing environments.

### 6. 📊 Fine-Tuned Model Evaluation & Promotion Framework
- Quantitative benchmark comparisons between base models and fine-tuned adapters.
- Automated metric evaluation (BLEU, CodeBLEU, Pass@1, execution latency).
- Qualitative spot-checking rubric and automated promotion criteria before deploying fine-tuned adapters as defaults.

---

## 🏗️ System Architecture

```
                       +-----------------------------+
                       |      GitHub Repository      |
                       +--------------+--------------+
                                      |
                                      v
                       +-----------------------------+
                       |     FastAPI Backend         |
                       |  (GitPython + Tree-Sitter)  |
                       +--------------+--------------+
                                      |
          +---------------------------+---------------------------+
          |                           |                           |
          v                           v                           v
+-------------------+   +---------------------------+   +--------------------+
|  Supabase DB      |   |  Interactive Visualizer   |   |   RAG Engine &     |
| (PostgreSQL Schema|   |   (@xyflow/react Graph)   |   | Code Intelligence  |
+---------+---------+   +---------------------------+   +--------------------+
          |
          v
+------------------------------------------------------------------------+
|                      Dataset & Fine-Tuning Pipeline                     |
|  * AST -> JSONL Dataset Generation (Train/Val)                         |
|  * Hugging Face PEFT / LoRA Adapter Fine-Tuning                        |
|  * Real-Time Loss & Metric Tracking                                    |
+------------------------------------+-----------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------+
|                Evaluation & Model Promotion Framework                  |
|  * BLEU / CodeBLEU / Pass@1 Benchmarks                                 |
|  * Base vs. Adapter Latency & Qualitative Spot-Checks                 |
+------------------------------------------------------------------------+
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Graphing / Flow**: [`@xyflow/react`](https://reactflow.dev/)
- **Charts & Icons**: [Recharts](https://recharts.org/), [Lucide React](https://lucide.dev/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Backend SDK**: `@supabase/supabase-js`

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://uvicorn.org/)
- **AST Parsing**: [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) (`tree-sitter-python`, `tree-sitter-javascript`, `tree-sitter-typescript`, `tree-sitter-java`)
- **Git Integration**: [GitPython](https://gitpython.readthedocs.io/)
- **ML / Fine-Tuning**: `torch`, `transformers`, `peft`, `accelerate`, `datasets`

### Database
- **Platform**: [Supabase](https://supabase.com/) (PostgreSQL with RLS policies)

---

## 📁 Repository Structure

```
RepoTutor/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point & CORS configuration
│   │   ├── db.py                # Supabase client instantiation
│   │   ├── routes/              # API Route Handlers
│   │   │   ├── projects.py      # Repository ingestion & project management
│   │   │   ├── parsing.py       # Tree-Sitter AST parsing endpoints
│   │   │   ├── intelligence.py   # RAG & code complexity summaries
│   │   │   ├── chats.py         # Conversational Q&A threads
│   │   │   ├── jobs.py          # Background job processing status
│   │   │   └── training.py      # Dataset generation, LoRA training & evaluation
│   │   ├── services/            # Core business logic
│   │   │   ├── parser.py        # Tree-sitter multi-language AST engine
│   │   │   └── trainer.py       # Fine-tuning & evaluation execution manager
│   │   └── schemas/             # Pydantic data schemas
│   ├── requirements.txt         # Python dependencies
│   └── .env.example             # Backend environment variables example
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Dashboard.tsx    # Project overview dashboard
│   │   │   ├── AuthPage.tsx     # Authentication views
│   │   │   └── StructureView.tsx# React Flow AST graph visualizer
│   │   ├── pages/               # Application pages
│   │   │   ├── ArchitecturePage.tsx  # Architecture visualization page
│   │   │   ├── AnalyticsPage.tsx     # Code complexity & AST metrics
│   │   │   ├── ChatPage.tsx          # RAG codebase assistant interface
│   │   │   ├── ReportsPage.tsx       # Exportable reports & insights
│   │   │   └── TrainingPage.tsx      # Fine-tuning & model evaluation dashboard
│   │   ├── App.tsx              # App routing & navigation wrapper
│   │   └── main.tsx             # React entry point
│   ├── package.json             # Frontend dependencies & scripts
│   └── vite.config.ts           # Vite build configuration
├── supabase_schema.sql          # Base database migration (Phase 1)
├── supabase_schema_phase2.sql   # AST Parsing schema migration
├── supabase_schema_phase3.sql   # Architecture visualization migration
├── supabase_schema_phase4.sql   # RAG Chat schema migration
├── supabase_schema_phase5.sql   # Fine-tuning & evaluation schema migration
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.x or higher
- **Python**: v3.10 or higher
- **Git** installed on your system path
- **Supabase Account** (or local Supabase instance)

---

### 1. Database Setup (Supabase)

1. Create a new project in [Supabase](https://supabase.com/).
2. In the Supabase SQL Editor, run the schema migration files sequentially:
   - `supabase_schema.sql`
   - `supabase_schema_phase2.sql`
   - `supabase_schema_phase3.sql`
   - `supabase_schema_phase4.sql`
   - `supabase_schema_phase5.sql`

---

### 2. Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux/macOS
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in `backend/`:
   ```env
   SUPABASE_URL=https://your-supabase-project.supabase.co
   SUPABASE_KEY=your-supabase-anon-or-service-role-key
   # Optional: GitHub token for higher API rate limits
   GITHUB_TOKEN=your_github_personal_access_token
   ```
5. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend API will be available at `http://localhost:8000` (API docs at `http://localhost:8000/docs`).

---

### 3. Frontend Setup

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in `frontend/`:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_API_BASE_URL=http://localhost:8000
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:5173`.

---

## 🔌 Main API Routes Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check endpoint |
| `/api/projects` | `GET` / `POST` | List or register repositories for analysis |
| `/api/repositories/{id}/parse` | `POST` | Trigger Tree-Sitter AST parsing job |
| `/api/projects/{id}/summary` | `GET` | Retrieve repository summary & complexity metrics |
| `/api/chats/` | `POST` | Send RAG chat query against codebase |
| `/api/projects/{id}/datasets/generate` | `POST` | Generate JSONL fine-tuning dataset from repository AST |
| `/api/projects/{id}/training/start` | `POST` | Launch LoRA/QLoRA fine-tuning training job |
| `/api/projects/{id}/training/jobs` | `GET` | Fetch status, metrics, and progress of training jobs |
| `/api/projects/{id}/evaluations` | `GET` / `POST` | Run and fetch evaluation benchmarks for fine-tuned adapters |

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

