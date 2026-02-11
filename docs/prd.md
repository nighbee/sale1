# Product Requirements Document (PRD)

**Project Name:** SalesAI – Intelligent Revenue Intelligence & Coaching SaaS
**Version:** 1.0
**Date:** February 2026
**Status:** Approved for Development

---

## 1. Executive Summary

**SalesAI** is a B2B SaaS platform designed to automate Quality Assurance (QA) for sales teams. It ingests communication data (voice calls, chats) from CRMs (AmoCRM), analyzes them using Speech-to-Text (STT) and Large Language Models (LLM), and provides actionable insights.

**Primary Goal:** To move sales analysis from "random sampling" to "100% coverage," giving Managers a God-mode view of performance and Representatives an automated AI Coach.

---

## 2. User Personas & Roles (RBAC)

| Role                              | Access Level | Responsibilities                                                                                |
| :-------------------------------- | :----------- | :---------------------------------------------------------------------------------------------- |
| **Super Admin** (Dev/Owner)       | System-Wide  | Manage tenants (companies), monitor system health (Grafana), view global error logs.            |
| **Tenant Admin** (Sales Director) | Company-Wide | View full team analytics, **configure Scripts (CRUD)**, connect CRM integrations, manage users. |
| **Sales Representative** (User)   | Individual   | View _only_ own calls, see personal "Coach" dashboard, view "Next Best Actions."                |

---

## 3. Functional Requirements

### 3.1 Authentication & Multi-Tenancy (Hard Fail Requirement)

- **System:** JWT (JSON Web Token) based authentication.
- **Multi-tenancy:** Isolation logic where every database query must include `company_id`.
- **Features:**
  - Registration (Company Setup).
  - Login / Logout.
  - Password Reset.
  - Invite User (Admin sends email to Rep).

### 3.2 Data Ingestion & Integrations

- **AmoCRM Webhook Listener:**
  - Endpoint: `POST /api/v1/webhooks/amocrm/call-finished`
  - Payload: Call link, Manager ID, Client Phone, Deal ID.
  - **Performance:** Must respond `200 OK` within 100ms (handled by Golang).
- **File Handling:**
  - Download audio files from external links (Salebot/CRM).
  - **Storage:** Save files to **MinIO** (Self-hosted S3) for permanence.

### 3.3 The Analysis Pipeline (AI Module)

- **Audio Processing:**
  - Convert audio to 16kHz WAV.
  - **Diarization:** Distinguish between "Speaker 0" (Rep) and "Speaker 1" (Client).
- **Transcription (STT):**
  - Service: OpenAI Whisper (Self-hosted or API).
  - Output: JSON with timestamps and speaker labels.
- **LLM Evaluation (The "Brain"):**
  - Input: Transcript + "Golden Script" + System Prompts.
  - **Outputs (Based on Spreadsheet):**
    - **Quality Score (0-100):** Weighted average of sub-metrics.
    - **Script Adherence:** Did they follow the phases (Intro, Qualify, Close)?
    - **Error Detection:** Formatting errors, rude language, missed questions.
    - **Brief:** 3-sentence summary of the call.
    - **Next Best Action:** Concrete step for the Rep (e.g., "Send Case Study X").

### 3.4 The "Script Builder" (CRUD Module)

- _This satisfies the Diploma "Complex CRUD" requirement._
- **UI:** A drag-and-drop or form-based builder for Managers.
- **Fields:**
  - Phase Name (e.g., "Objection Handling").
  - Required Keywords (e.g., "Price", "Contract").
  - Forbidden Keywords (e.g., "I don't know").
  - Custom AI Instructions.

### 3.5 Dashboards & Visualization

- **Manager Dashboard:**
  - Team Heatmap (Who is performing best?).
  - Call Volume Trends.
  - Topic Analysis (What are clients asking about?).
- **Call Detail Page ("Karaoke" Player):**
  - Waveform audio player.
  - **Interactive Transcript:** Text highlights as audio plays.
  - Sidebar: AI Insights aligned with timestamps.

### 3.6 Notifications & Feedback Loop

- **CRM Write-back:** Push the "Brief" and "Next Best Action" back to AmoCRM as a Note on the Deal.
- **Alerts:** Telegram/Email notification if a "Critical Error" (e.g., Client threatens to sue) is detected.

---

## 4. Technical Architecture (Polyglot Microservices)

To maximize the **Diploma Complexity Score**, we use a hybrid stack.

### 4.1 High-Level Diagram

`[AmoCRM]` -> `[Nginx]` -> `[Golang API]` -> `[Redis Queue]` -> `[Python AI Worker]` -> `[PostgreSQL]`

### 4.2 Tech Stack

| Component        | Technology                   | Reasoning for Diploma                                      |
| :--------------- | :--------------------------- | :--------------------------------------------------------- |
| **Frontend**     | React (Next.js) + TypeScript | Modern UX standards, "Complex UI" criteria.                |
| **API Backend**  | **Golang (Fiber)**           | High performance, concurrency, "Architectural Complexity". |
| **AI Worker**    | **Python (3.11)**            | Native support for PyTorch/Whisper/LangChain.              |
| **Database**     | PostgreSQL                   | Relational data integrity, complex queries.                |
| **Queue**        | Redis                        | Asynchronous processing (solves `socket hang up`).         |
| **File Storage** | MinIO (Docker)               | Simulates AWS S3, keeps data safe.                         |
| **Deployment**   | Docker Compose               | Reproducibility, easy "Engineering" points.                |

---

## 5. Database Schema (Entities)

We require **>6 Tables** to meet the diploma scale criteria.

1.  **`companies`**: Tenant settings, subscription status.
2.  **`users`**: Auth credentials, roles, link to `companies`.
3.  **`scripts`**: JSON definitions of sales scripts (The Logic).
4.  **`integrations`**: Storing OAuth tokens for AmoCRM.
5.  **`calls`**: Metadata (Duration, Manager, Link, Status).
6.  **`transcripts`**: The raw text with timestamps (stored separate for performance).
7.  **`analysis_reports`**: The LLM output (Scores, Recommendations).
8.  **`notifications`**: Log of alerts sent to users.

---

## 6. API Specifications (Key Endpoints)

The system will have **>15 Endpoints**.

**Auth Group:**

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/refresh`

**Calls Group:**

- `POST /webhooks/amocrm` (Ingest)
- `GET /calls` (List with pagination & filters)
- `GET /calls/{id}` (Details)
- `GET /calls/{id}/audio` (Stream from MinIO)

**Scripts Group (CRUD):**

- `POST /scripts` (Create new logic)
- `GET /scripts`
- `PUT /scripts/{id}`
- `DELETE /scripts/{id}`

**Analytics Group:**

- `GET /analytics/team-performance`
- `GET /analytics/leaderboard`

---

## 7. Non-Functional Requirements (Quality Attributes)

1.  **Latency:** API must respond to Webhooks in <200ms. Analysis can take up to 5 minutes (Async).
2.  **Reliability:** Retry logic implemented in Python Worker (3 retries for 500 errors).
3.  **Scalability:** The Python worker can be scaled horizontally (add more containers) if call volume increases.
4.  **Security:**
    - Passwords hashed with `bcrypt`.
    - API secured via JWT.
    - **PII Redaction:** AI prompts must instruct to ignore credit card numbers.

---

## 8. Diploma Criteria Compliance Checklist

| Criteria           | Implementation in Project                                       | Status |
| :----------------- | :-------------------------------------------------------------- | :----- |
| **Auth & Roles**   | JWT, Admin/Director/Rep roles implemented in Golang middleware. | ✅     |
| **Multi-page**     | 7+ Modules (Dash, Settings, Script Builder, Call Player, etc.). | ✅     |
| **Backend System** | REST API in Golang, separate from DB.                           | ✅     |
| **Complex Logic**  | AI Analysis Pipeline + Script Matching Algorithm.               | ✅     |
| **Architecture**   | Microservices (Go API + Python Worker + Redis).                 | ✅     |
| **Connectivity**   | Backend <-> AI <-> DB <-> Frontend <-> CRM.                     | ✅     |
| **Scale**          | 8 Database Tables, ~20 API Endpoints.                           | ✅     |
| **UX/UI**          | Loading states, Waveform visualization, Real-time status.       | ✅     |

---

## 9. Implementation Phases

1.  **Phase 1 (Infrastructure):** Docker setup (Go, Postgres, Redis, MinIO).
2.  **Phase 2 (Core Backend):** Golang API for Auth and Webhook ingestion.
3.  **Phase 3 (AI Pipeline):** Python worker to fetch audio, transcribe, and analyze.
4.  **Phase 4 (Frontend):** React Dashboard and "Karaoke" Player.
5.  **Phase 5 (Integration):** AmoCRM connection and Notification logic.

---

This PRD provides the exact roadmap to build a SaaS that is commercially viable and academically superior. **The shift to Golang for the API significantly strengthens the "Engineering" and "Architecture" score of your diploma.**
