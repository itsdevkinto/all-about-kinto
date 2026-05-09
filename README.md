# Link Tree App

A modern link tree application built with TanStack Start, React, and Cloudflare Workers.

## Tech Stack

- **Framework**: TanStack Start (React-based full-stack framework)
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Cloudflare Workers
- **Build Tool**: Vite
- **Deployment**: Cloudflare Workers/Pages
- **AI Integration**: Google Gemini API, OpenRouter API

## Live View

- Preview the deployed site: https://tanstack-start-app.yo-kinto-x.workers.dev

## Features

- Responsive link tree interface
- AI-powered chat functionality
- Modern UI with Radix UI components
- Server-side rendering
- Type-safe development

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun
- Cloudflare account (for deployment)

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd link-tree
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building

Build for production:

```bash
npm run build
```

### Deployment

1. Install Wrangler CLI:

```bash
npm install -g wrangler
```

2. Login to Cloudflare:

```bash
npx wrangler login
```

3. Set up secrets (don't commit API keys):

```bash
npx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
```

4. Deploy:

```bash
npx wrangler deploy
```

## Project Structure

```
src/
├── api/          # API routes
├── assets/       # Static assets
├── components/   # React components
│   ├── ui/       # Reusable UI components
│   └── ...
├── hooks/        # Custom React hooks
├── lib/          # Utilities and helpers
├── routes/       # Page routes
├── server.ts     # Server entry point
└── ...
```

## Environment Variables

| Variable                       | Description           | Required |
| ------------------------------ | --------------------- | -------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API key | Yes      |
| `OPENROUTER_API_KEY`           | OpenRouter API key    | Yes      |

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License
