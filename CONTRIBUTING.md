# Contributing to viberank

First off, thank you for considering contributing to viberank! It's people like you that make viberank such a great tool for the Claude Code community.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots if possible**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code follows the existing code style
6. Issue that pull request!

## Development Setup

1. Fork and clone the repo:
   ```bash
   git clone https://github.com/yourusername/viberank.git
   cd viberank
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up your environment:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. Start Convex:
   ```bash
   npx convex dev
   ```

5. Run the development server:
   ```bash
   pnpm dev
   ```

## Project Structure

```
viberank/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── api/         # API routes
│   │   └── page.tsx     # Main page component
│   ├── components/       # React components
│   │   ├── FileUpload.tsx
│   │   ├── Leaderboard.tsx
│   │   └── ShareCard.tsx
│   ├── lib/             # Utilities and helpers
│   │   ├── env.ts       # Environment validation
│   │   └── utils.ts     # Common utilities
│   └── types/           # TypeScript definitions
├── convex/              # Backend functions
│   ├── schema.ts        # Database schema
│   └── submissions.ts   # Submission handlers
└── public/              # Static assets
```

## Coding Standards

### TypeScript

- Always use TypeScript, avoid `any` types
- Define interfaces for all props and data structures
- Use proper type imports: `import type { ... }`

### React

- Use functional components with hooks
- Keep components small and focused
- Use proper prop destructuring
- Implement proper error boundaries

### Styling

- Use Tailwind CSS classes
- Follow the existing design system
- Keep styles consistent with Claude's color scheme
- Ensure responsive design works on all devices

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Examples:
```
feat: Add time range filtering to leaderboard
fix: Correct GitHub avatar URL construction
docs: Update README with deployment instructions
style: Format code with prettier
refactor: Extract common utilities to lib folder
```

## Testing

Before submitting a PR:

1. Run the linter:
   ```bash
   pnpm lint
   ```

2. Run type checking:
   ```bash
   pnpm type-check
   ```

3. Test your changes thoroughly:
   - Sign in/out flow works
   - File upload works correctly
   - Leaderboard displays properly
   - Filters work as expected
   - Mobile responsiveness is maintained

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing! 🧡