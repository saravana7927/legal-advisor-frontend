# LexAI Frontend Documentation

This document provides complete instructions for cloning, setting up, and running the LexAI Next.js frontend. It details the UI architecture, routing, and key components.

## 1. Setup Instructions (From Scratch)

If you are a new developer cloning this repository, follow these steps to run the frontend:

### Prerequisites
- Node.js (version 18 or 20+ recommended).
- The LexAI backend must be running for full end-to-end functionality.

### Step 1: Clone the Repository
```bash
git clone <repository_url>
cd legaladvisor/la_frontend
```

### Step 2: Install Dependencies
Install the required NPM packages. You can use npm, yarn, pnpm, or bun.
```bash
npm install
```

### Step 3: Environment Variables
Create a `.env.local` file in the `la_frontend` directory to link the UI to the API.
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```
*(Ensure this URL matches the host and port where your FastAPI backend is running.)*

### Step 4: Run the Development Server
```bash
npm run dev
```
The application will be accessible at `http://localhost:3000`.

---

## 2. Architecture and Routing

The application uses the **Next.js App Router** paradigm, with pages defined in the `app/` directory and client-side logic marked with `"use client"`.

- **`/` (`app/page.tsx`)**: The landing page. Manages a `docId` state to toggle between the `UploadZone` component and the `ProcessingStatus` polling component.
- **`/doc/[id]` (`app/doc/[id]/page.tsx`)**: The document analysis workspace. This dynamic route loads the clause analysis table and mounts the `ChatPanel` for the specific `docId`.

---

## 3. Core Components (`components/`)

### A. `UploadZone.tsx`
Handles the initial file ingestion interface.
- **Props**: `onUploaded(id: string)`
- **Methods/Logic**:
  - Monitors drag-and-drop events (`onDragOver`, `onDrop`).
  - Uses a standard file input (`<input type="file" />`) hidden behind a styled label.
  - `handleFile(file: File)`: Creates a `FormData` object and posts the PDF to the backend `POST /upload` endpoint.
  - On success, it invokes the `onUploaded` callback with the returned `doc_id`, transitioning the UI to the processing phase.

### B. `ProcessingStatus.tsx`
Polls the backend to determine when the document ingestion and analysis are complete.
- **Props**: `docId: string`, `onTryAgain: () => void`
- **Methods/Logic**:
  - `pollStatus()`: A `useEffect` hook runs a `setInterval` that calls the backend `GET /doc/{doc_id}/status` endpoint every 2 seconds.
  - Monitors the `status` string (`processing`, `ready`, `error`).
  - Upon receiving `ready`, it redirects the user to the document view using Next.js `useRouter().push('/doc/' + docId)`.

### C. `ChatPanel.tsx`
Provides the interactive Retrieval-Augmented Generation (RAG) chat interface.
- **Props**: `docId: string`
- **Key State Variables**:
  - `messages: UiMessage[]`: Maintains the conversation log (user inputs and assistant replies).
  - `input: string`: Bound to the text input field.
  - `sending: boolean`: Disables input while waiting for the stream to finish.
- **Methods/Logic**:
  - `toHistoryPayload(messages)`: Slices the last `MAX_HISTORY` (6) messages to send as conversational context to the API.
  - `sendQuestion(question: string)`: The core chat function. It resets errors, appends the user's message, adds an empty placeholder for the assistant, and triggers the `POST /doc/{doc_id}/chat` endpoint.
  - Consumes **Server-Sent Events (SSE)** via `readChatSseStream(body)`. As tokens arrive, it updates the `content` of the assistant's placeholder message, creating a real-time typing effect.
  - Extracts the final `citations` payload emitted at the end of the SSE stream and appends them to the assistant's message UI.

### D. `ClauseCard.tsx`
A presentational component used in the `/doc/[id]` view.
- **Props**: Receives data about a single clause (raw text, plain English, risk assessment, law cited).
- **Methods/Logic**: Renders the analysis returned by `GET /doc/{doc_id}/analysis`. Conditionally renders the `RiskBadge` based on the evaluated risk severity.

### E. `RiskBadge.tsx`
A micro-component that accepts a risk level string (`high`, `medium`, `low`, `neutral`) and returns a styled tag (e.g., a red background for high risk, green for low risk).
