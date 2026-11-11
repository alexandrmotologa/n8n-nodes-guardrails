# Contributing to n8n-nodes-guardrails

Thank you for your interest in improving `n8n-nodes-guardrails`.

## Development Setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/alexandrmotologa/n8n-nodes-guardrails.git
   cd n8n-nodes-guardrails
   npm install
   ```

2. Run the test suite:
   ```bash
   npm test
   ```

3. Compile TypeScript:
   ```bash
   npm run build
   ```

## Linking in Local n8n

To test with a local n8n instance:
```bash
npm link
cd ~/.n8n/custom
npm link n8n-nodes-guardrails
```

## Pull Request Guidelines

- Ensure all new features or bug fixes include corresponding unit tests in `test/`.
- Verify that `npm run typecheck` and `npm test` pass with zero errors.
- Follow Conventional Commits format (`feat:`, `fix:`, `docs:`, `test:`).
