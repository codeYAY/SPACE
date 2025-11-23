# Complete Workflow: From User Request to Final UI Build

This document provides a thorough, step-by-step explanation of how the SPACE platform processes a user's request to build a UI and delivers a fully functional, live application.

---

## Overview

SPACE is an AI-powered platform that transforms natural language requests into fully functional Next.js applications. The system leverages Claude Sonnet 4 AI, sandboxed execution environments, and a multi-agent architecture to build, test, and deploy UI components in real-time.

**Tech Stack:**
- **Frontend:** Next.js 15.3.3, React, Tailwind CSS, Shadcn UI
- **Backend:** tRPC, Prisma ORM, PostgreSQL
- **AI Engine:** Claude Sonnet 4 via @inngest/agent-kit
- **Sandbox Environment:** E2B Code Interpreter (isolated Next.js environments)
- **Background Jobs:** Inngest (for async processing)
- **Authentication:** Clerk

---

## Architecture Components

### 1. **Database Schema (Prisma)**

The system tracks everything through a PostgreSQL database:

```prisma
Project {
  id: UUID
  name: String
  userId: String
  messages: Message[]
}

Message {
  id: UUID
  content: String (user request or AI response)
  role: USER | ASSISTANT
  type: RESULT | ERROR
  projectId: String
  fragment: Fragment? (optional, contains the build result)
}

Fragment {
  id: UUID
  messageId: String
  sandboxUrl: String (live preview URL)
  title: String (e.g., "Dashboard UI", "Chat Widget")
  files: JSON (all generated code files)
}
```

### 2. **Sandbox Environment (E2B)**

Each build runs in an isolated, pre-configured Next.js environment:
- **Base Image:** Node 21 (Debian-based)
- **Pre-installed:**
  - Next.js 15.3.3
  - All Shadcn UI components
  - Tailwind CSS + PostCSS
  - Lucide React icons
- **Runtime:** Development server runs on port 3000 with hot-reload
- **Timeout:** 30 minutes per sandbox session
- **File System:** Fully writable via E2B API

---

## The Complete Workflow

### Phase 1: **User Submits Request**

**Location:** Frontend UI (`src/modules/projects/ui/`)

1. **User Input:**
   - User types a natural language request: _"Build me a dashboard with charts and user stats"_
   - Submits via the chat interface

2. **tRPC Mutation Triggered:**
   - Request hits `messages.create` mutation (`src/modules/messages/server/procedures.ts`)
   - Validates input (1-10,000 characters)
   - Checks user authentication (Clerk)
   - Verifies project ownership

3. **Database Write:**
   ```typescript
   // Create user message in database
   const createdMessage = await prisma.message.create({
     data: {
       projectId: existingProject.id,
       content: input.value,
       role: "USER",
       type: "RESULT",
     },
   });
   ```

4. **Background Job Dispatch:**
   ```typescript
   // Trigger async Inngest function
   await inngest.send({
     name: "rushed-agent/run",
     data: {
       projectId: existingProject.id,
       value: input.value, // User's request
     },
   });
   ```

**Result:** User message stored, background job queued, frontend receives immediate acknowledgment.

---

### Phase 2: **Inngest Background Processing**

**Location:** `src/inngest/functions.ts`

The `codeAgentFunction` handles the entire build process asynchronously.

#### Step 2.1: **Sandbox Creation**

```typescript
const sandboxId = await step.run("get-sandbox-id", async () => {
  const sandbox = await Sandbox.create("rushed-nextjs-template");
  await sandbox.setTimeout(SANDBOX_TIMEOUT_IN_MS); // 30 minutes
  return sandbox.sandboxId;
});
```

**What Happens:**
- E2B spins up a fresh Docker container
- Pre-configured Next.js 15.3.3 environment loads
- All Shadcn components and dependencies ready
- Development server auto-starts on port 3000

#### Step 2.2: **Context Loading**

```typescript
const previousMessages = await step.run("get-previous-messages", async () => {
  const messages = await prisma.message.findMany({
    where: { projectId: event.data.projectId },
    orderBy: { createdAt: "desc" },
    take: 5, // Last 5 messages for context
  });
  
  return messages.reverse().map(msg => ({
    type: "text",
    role: msg.role === "ASSISTANT" ? "assistant" : "user",
    content: msg.content,
  }));
});
```

**What Happens:**
- Fetches last 5 messages from conversation history
- Provides AI with context about previous requests/changes
- Enables iterative development ("add a dark mode toggle to the dashboard")

#### Step 2.3: **AI Agent Initialization**

```typescript
const codeAgent = createAgent<AgentState>({
  name: "rushed-agent",
  description: "An expert coding agent",
  system: PROMPT, // Comprehensive system prompt
  model: anthropic({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
  }),
  tools: [terminal, createOrUpdateFiles, readFiles],
});
```

**Agent State:**
```typescript
{
  summary: "", // Populated when task completes
  files: {}, // All generated/modified files
}
```

---

### Phase 3: **AI Agent Execution**

**Location:** Claude Sonnet 4 via Inngest Agent Kit

The AI agent has three primary tools at its disposal:

#### Tool 1: **Terminal** 
```typescript
terminal({
  command: "npm install react-chartjs-2 --yes"
})
```

**Purpose:**
- Install npm packages
- Run build commands (NOT dev/build/start - server already running)
- Execute validation scripts

**Example Usage:**
```bash
npm install lucide-react --yes
npm install date-fns --yes
```

#### Tool 2: **createOrUpdateFiles**
```typescript
createOrUpdateFiles({
  files: [
    {
      path: "app/page.tsx",
      content: `"use client"\nimport { Button } from "@/components/ui/button"...`
    },
    {
      path: "app/dashboard/stats-card.tsx",
      content: `export const StatsCard = ({ title, value }) => {...}`
    }
  ]
})
```

**Purpose:**
- Create new components
- Update existing files
- Writes directly to sandbox filesystem
- Triggers hot-reload on changes

**Critical Rules:**
- All paths are relative (no `/home/user/` prefix)
- Always add `"use client"` to files using React hooks
- Never create CSS files (Tailwind only)
- Use `@/components/ui/*` for Shadcn imports

#### Tool 3: **readFiles**
```typescript
readFiles({
  files: ["/home/user/components/ui/button.tsx"]
})
```

**Purpose:**
- Inspect existing component APIs
- Verify Shadcn component props/variants
- Read current file contents before updating

**Note:** Uses absolute paths (`/home/user/...`) unlike createOrUpdateFiles

---

### Phase 4: **Agent Workflow**

#### Step 4.1: **Planning**
Agent analyzes the request:
- "User wants a dashboard with charts and user stats"
- Identifies required components: layout, charts, stat cards
- Determines dependencies: react-chartjs-2, lucide-react

#### Step 4.2: **Dependency Installation**
```typescript
await terminal({ command: "npm install react-chartjs-2 --yes" });
await terminal({ command: "npm install chart.js --yes" });
```

#### Step 4.3: **Component Creation**
Agent creates modular, production-quality components:

**File 1:** `app/page.tsx`
```tsx
"use client"
import { StatsCard } from "./stats-card"
import { ChartComponent } from "./chart"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Full dashboard layout */}
    </div>
  )
}
```

**File 2:** `app/stats-card.tsx`
```tsx
import { Card } from "@/components/ui/card"

export const StatsCard = ({ title, value, icon }) => {
  // Reusable stat card component
}
```

**File 3:** `app/chart.tsx`
```tsx
"use client"
import { Line } from "react-chartjs-2"

export const ChartComponent = () => {
  // Chart.js implementation
}
```

#### Step 4.4: **Verification**
- Files written trigger hot-reload
- Sandbox automatically recompiles
- Agent can use `terminal` to check build errors

#### Step 4.5: **Task Completion**
Agent outputs completion signal:
```xml
<task_summary>
Created a comprehensive dashboard with user statistics cards showing active users, revenue, and growth metrics, plus an interactive line chart tracking monthly data. Implemented using Shadcn UI components and Chart.js.
</task_summary>
```

**Network Router Logic:**
```typescript
router: async ({ network }) => {
  const summary = network.state.data.summary;
  
  if (summary) {
    return; // Stop execution - task complete
  }
  
  return codeAgent; // Continue execution
}
```

---

### Phase 5: **Response Generation**

**Location:** `src/inngest/functions.ts` (lines 220-250)

After the main agent completes, two specialized agents generate metadata:

#### Agent 1: **Fragment Title Generator**
```typescript
const fragmentTitleGenerator = createAgent({
  system: FRAGMENT_TITLE_PROMPT,
  model: anthropic({ model: "claude-sonnet-4-20250514" }),
});

const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
  result.state.data.summary
);
```

**Input:** 
```
Created a comprehensive dashboard with user statistics...
```

**Output:**
```
Dashboard UI
```

**Rules:**
- Max 3 words
- Title case
- No punctuation
- Describes what was built

#### Agent 2: **Response Generator**
```typescript
const responseGenerator = createAgent({
  system: RESPONSE_PROMPT,
  model: anthropic({ model: "claude-sonnet-4-20250514" }),
});

const { output: responseOutput } = await responseGenerator.run(
  result.state.data.summary
);
```

**Input:**
```
Created a comprehensive dashboard with user statistics...
```

**Output:**
```
I've built you a dashboard with real-time stats cards and an interactive chart showing your growth over time. Everything's styled with modern UI components and fully responsive.
```

**Rules:**
- 1-3 sentences
- Casual, friendly tone
- Explains what was built
- No code or technical details

---

### Phase 6: **Database Persistence**

**Location:** `src/inngest/functions.ts` (lines 262-289)

#### Step 6.1: **Get Live Preview URL**
```typescript
const sandboxUrl = await step.run("get-sandbox-url", async () => {
  const sandbox = await getSandbox(sandboxId);
  const host = sandbox.getHost(3000); // Next.js dev server port
  return `https://${host}`;
});
```

**Example URL:** `https://abc123-3000.e2b.dev`

#### Step 6.2: **Save Complete Result**
```typescript
await prisma.message.create({
  data: {
    projectId: event.data.projectId,
    content: "I've built you a dashboard...", // Friendly response
    role: "ASSISTANT",
    type: "RESULT",
    fragment: {
      create: {
        sandboxUrl: "https://abc123-3000.e2b.dev",
        title: "Dashboard UI",
        files: {
          "app/page.tsx": "...",
          "app/stats-card.tsx": "...",
          "app/chart.tsx": "..."
        }
      }
    }
  }
});
```

**Database State After Save:**
```
Message {
  id: "msg-xyz"
  content: "I've built you a dashboard..."
  role: ASSISTANT
  type: RESULT
  fragment: {
    sandboxUrl: "https://abc123-3000.e2b.dev"
    title: "Dashboard UI"
    files: { /* all code */ }
  }
}
```

---

### Phase 7: **Frontend Display**

**Location:** `src/modules/projects/ui/` (project detail page)

#### Step 7.1: **Real-Time Updates**
- Frontend polls via tRPC subscription or refetches messages
- New assistant message detected

#### Step 7.2: **Message Rendering**
```tsx
{messages.map(message => (
  <div key={message.id}>
    {message.role === "USER" ? (
      <UserMessage content={message.content} />
    ) : (
      <AssistantMessage 
        content={message.content}
        fragment={message.fragment}
      />
    )}
  </div>
))}
```

#### Step 7.3: **Fragment Display**
```tsx
<AssistantMessage>
  <p>{message.content}</p>
  
  {message.fragment && (
    <div className="fragment-preview">
      <h3>{message.fragment.title}</h3>
      
      {/* Live Preview */}
      <iframe 
        src={message.fragment.sandboxUrl}
        className="w-full h-96"
      />
      
      {/* Code Viewer */}
      <CodeView files={message.fragment.files} />
    </div>
  )}
</AssistantMessage>
```

**User Sees:**
1. AI's friendly response text
2. **Live Preview:** Embedded iframe showing the running dashboard
3. **Code Viewer:** Tabbed interface with all generated files
4. **Action Buttons:** "Open in New Tab", "Download Code", "Iterate"

---

## Example: Complete Flow Timeline

**Request:** _"Build me a landing page with a hero section, features grid, and pricing table"_

### Timeline Breakdown

| **Time** | **Phase** | **Action** | **Details** |
|----------|-----------|------------|-------------|
| 0ms | User Input | User types request | Frontend captures input |
| 50ms | API Call | tRPC mutation `messages.create` | Validates auth, creates user message in DB |
| 100ms | Job Dispatch | Inngest event sent | `rushed-agent/run` queued |
| 150ms | Frontend | UI shows "Building..." | User sees loading state |
| 500ms | Sandbox | E2B creates container | Next.js 15.3.3 environment ready |
| 1s | Context | Load last 5 messages | AI receives conversation history |
| 2s | Agent Init | Claude Sonnet 4 starts | Receives system prompt + tools |
| 5s | Planning | AI analyzes request | Identifies components needed |
| 8s | Dependencies | `npm install framer-motion --yes` | Installs animation library |
| 12s | File Creation | Creates `app/page.tsx` | Hero section implementation |
| 15s | File Creation | Creates `app/features.tsx` | Features grid component |
| 18s | File Creation | Creates `app/pricing.tsx` | Pricing table component |
| 20s | File Update | Updates `app/page.tsx` | Integrates all components |
| 22s | Hot Reload | Sandbox recompiles | Next.js rebuilds app |
| 23s | Verification | Agent checks build | No errors detected |
| 24s | Completion | `<task_summary>` output | Agent signals done |
| 26s | Title Gen | "Landing Page" | Fragment title created |
| 28s | Response Gen | Friendly message | "I've built you a modern landing page..." |
| 30s | URL Gen | `https://xyz-3000.e2b.dev` | Live preview URL obtained |
| 32s | DB Save | Message + Fragment stored | Complete result persisted |
| 34s | Frontend | UI updates | Live preview + code displayed |

**Total Time:** ~34 seconds (varies based on complexity)

---

## Iterative Development

Users can continue the conversation to modify the build:

**Follow-up Request:** _"Add a dark mode toggle to the navbar"_

### What Happens:

1. **New Message Created:**
   - User message saved to DB
   - Inngest job triggered with same `projectId`

2. **Context Awareness:**
   - AI receives last 5 messages (including original request)
   - Knows previous files that were created

3. **Incremental Changes:**
   ```typescript
   await readFiles({ 
     files: ["/home/user/app/page.tsx"] 
   });
   
   await createOrUpdateFiles({
     files: [
       {
         path: "app/page.tsx",
         content: "... updated with dark mode toggle ..."
       },
       {
         path: "app/theme-toggle.tsx",
         content: "... new component ..."
       }
     ]
   });
   ```

4. **Same Sandbox:**
   - **Important:** Each iteration uses a NEW sandbox
   - Previous files are NOT automatically carried over
   - Agent must recreate/update files as needed

5. **Result:**
   - New message with updated Fragment
   - Live preview shows dark mode toggle
   - Code viewer shows modified files

---

## Key System Behaviors

### 1. **Sandbox Lifecycle**
- **Creation:** Fresh sandbox per Inngest job execution
- **Timeout:** 30 minutes of inactivity
- **Cleanup:** Automatic after job completes
- **State:** Sandboxes are ephemeral (no persistence between jobs)

### 2. **File Management**
- **Relative Paths:** Always use `app/page.tsx` (not `/home/user/app/page.tsx`)
- **Hot Reload:** Automatic on file changes
- **State Tracking:** `network.state.data.files` tracks all modifications

### 3. **Error Handling**
```typescript
const isError = 
  !result.state.data.summary ||
  Object.keys(result.state.data.files || {}).length === 0;

if (isError) {
  await prisma.message.create({
    data: {
      projectId: event.data.projectId,
      content: "Something went wrong. Please try again.",
      role: "ASSISTANT",
      type: "ERROR",
    },
  });
}
```

**Error Conditions:**
- No `<task_summary>` produced (agent failed)
- No files created (agent got stuck)
- Timeout (30 minutes exceeded)
- Sandbox connection issues

### 4. **Agent Constraints**

**What the AI CAN do:**
- Install npm packages
- Create/update any files in `/home/user/`
- Read existing files
- Run terminal commands
- Access Shadcn UI components
- Use Tailwind CSS

**What the AI CANNOT do:**
- Run `npm run dev/build/start` (server already running)
- Create CSS files (Tailwind only)
- Access external APIs
- Modify `package.json` directly (must use `npm install`)
- Use absolute paths in `createOrUpdateFiles`

### 5. **Best Practices Enforced**

**Code Quality:**
- TypeScript required
- Named exports for components
- `"use client"` directive when using hooks
- Modular component architecture
- No TODOs or placeholders

**Styling:**
- Tailwind CSS exclusively
- Shadcn UI components
- Lucide React icons
- No external images (emojis + colored divs)
- Responsive by default

**File Conventions:**
- PascalCase component names
- kebab-case file names
- `.tsx` for components
- `.ts` for utilities

---

## System Prompts

### Main Agent Prompt (`PROMPT`)
**Location:** `src/prompt.ts` (lines 21-134)

**Key Sections:**
1. **Environment Description:** Sandbox setup, pre-installed tools
2. **File Safety Rules:** `"use client"` usage, path conventions
3. **Runtime Execution:** Never run dev/build commands
4. **Instructions:** Feature completeness, tool usage, Shadcn API compliance
5. **Styling Guidelines:** Tailwind only, no CSS files
6. **Output Format:** `<task_summary>` requirement

### Fragment Title Prompt
**Location:** `src/prompt.ts` (lines 10-19)

**Goal:** Generate 3-word title in title case
**Example Input:** _"Created a comprehensive dashboard..."_
**Example Output:** `Dashboard UI`

### Response Prompt
**Location:** `src/prompt.ts` (lines 1-8)

**Goal:** Friendly 1-3 sentence summary
**Example Input:** _"Created a comprehensive dashboard..."_
**Example Output:** `I've built you a dashboard with real-time stats and interactive charts.`

---

## Technology Deep Dive

### Inngest Agent Kit
**Purpose:** Orchestrates multi-agent AI workflows

**Key Concepts:**
- **Agents:** AI models with specific roles and tools
- **State:** Shared data structure across agents
- **Network:** Routes between agents based on conditions
- **Tools:** Functions agents can call (terminal, file ops)
- **Lifecycle Hooks:** `onResponse` for state updates

**Why Used:**
- Reliable background job execution
- Built-in retry logic
- Step-by-step execution tracking
- Multi-agent coordination
- State management

### E2B Sandbox
**Purpose:** Isolated, secure code execution environment

**Architecture:**
- Docker containers on-demand
- Pre-built Next.js templates
- Network access for npm installs
- Live preview via unique URLs
- Automatic cleanup

**Security:**
- User code runs in isolation
- No access to host system
- Rate limiting on API calls
- Timeout enforcement

### tRPC
**Purpose:** Type-safe API layer

**Benefits:**
- End-to-end TypeScript
- No code generation needed
- Real-time subscriptions
- Automatic error handling
- Clerk auth integration

---

## Common User Flows

### Flow 1: **Brand New UI**
1. User: _"Build a todo app"_
2. System creates fresh sandbox
3. AI builds complete todo app
4. User sees live preview + code

### Flow 2: **Iterative Refinement**
1. User: _"Add dark mode"_
2. System loads previous messages for context
3. AI updates existing components
4. User sees updated preview

### Flow 3: **Feature Addition**
1. User: _"Add user authentication"_
2. AI installs required packages
3. Creates auth components
4. Integrates with existing app

### Flow 4: **Bug Fix**
1. User: _"The button isn't working"_
2. AI reads current file contents
3. Identifies and fixes issue
4. Updates files

---

## Performance Characteristics

### Speed Factors

**Fast Builds (5-15 seconds):**
- Simple components
- No external dependencies
- Minimal file operations

**Medium Builds (15-45 seconds):**
- Multi-component layouts
- 1-2 npm packages
- Moderate complexity

**Slow Builds (45-120 seconds):**
- Full applications
- Multiple dependencies
- Complex state management
- Many file operations

### Optimization Strategies

1. **Sandbox Caching:**
   - Pre-built Next.js template reduces init time
   - Shadcn components pre-installed

2. **Parallel Execution:**
   - File writes batched when possible
   - Multiple `createOrUpdateFiles` calls

3. **Context Limiting:**
   - Only last 5 messages loaded
   - Reduces token usage

4. **Streaming Responses:**
   - Frontend can show progress
   - User sees "Building..." state

---

## Monitoring & Debugging

### Database Queries
```typescript
// Get all messages for a project
const messages = await prisma.message.findMany({
  where: { projectId },
  include: { fragment: true },
  orderBy: { createdAt: 'asc' }
});
```

### Inngest Dashboard
- View job execution history
- See step-by-step progress
- Debug failed runs
- Monitor performance

### Sandbox Logs
```typescript
// Terminal output captured
const result = await sandbox.commands.run(command, {
  onStdout: (data) => console.log(data),
  onStderr: (data) => console.error(data),
});
```

---

## Future Enhancements

### Potential Improvements

1. **Sandbox Persistence:**
   - Reuse same sandbox for project iterations
   - Faster subsequent builds

2. **Real-Time Streaming:**
   - Stream agent tool calls to frontend
   - Show live progress

3. **Multi-Language Support:**
   - Python/FastAPI templates
   - Vue/React/Svelte options

4. **Collaborative Editing:**
   - Multiple users on same project
   - Real-time code sync

5. **Version Control:**
   - Git integration
   - Rollback to previous builds

---

## Conclusion

The SPACE platform provides a seamless workflow from natural language to production-quality UI:

1. **User submits request** → tRPC mutation
2. **Background job triggered** → Inngest
3. **Sandbox created** → E2B
4. **AI builds application** → Claude Sonnet 4
5. **Response generated** → Specialized agents
6. **Result saved** → PostgreSQL
7. **Live preview displayed** → Frontend iframe

The entire process typically completes in **15-60 seconds**, delivering:
- ✅ Fully functional Next.js application
- ✅ Live preview URL
- ✅ Complete source code
- ✅ Friendly explanation
- ✅ Ability to iterate

This architecture enables rapid prototyping, iterative development, and production-quality code generation through natural language interaction.

