# Rushed

**Rushed** is an AI-powered web application builder that transforms natural language into functional code. Designed for creators and teams who want to build modern web apps fast—without the friction.

## 🛠️ Built For

- Developers seeking rapid prototyping
- Designers refining UI components
- Startups building MVPs with speed and precision
- Anyone who wants to turn ideas into code—fast

## ⚙️ AI Model Configuration

Rushed supports two AI model providers:

### OpenRouter (Recommended)

Access to multiple AI models through a single API:

1. Sign up at [OpenRouter.ai](https://openrouter.ai)
2. Generate an API key from your dashboard
3. Go to Settings in the app and configure your OpenRouter API key
4. Choose from models like Claude 3.5 Sonnet, GPT-4o, Gemini Pro, and more

### Local Model

Run your own AI models locally:

1. Set up a local model server (LM Studio, Ollama, or similar)
2. Ensure the server provides an OpenAI-compatible API
3. Go to Settings and enter your local endpoint URL (e.g., `http://localhost:1234/v1`)
4. Specify your model name

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Set up your environment variables (see `.env.example`)
4. Run database migrations: `pnpm prisma migrate dev`
5. Start the development server: `pnpm dev`
6. Configure your AI model in the Settings page at `/settings`

