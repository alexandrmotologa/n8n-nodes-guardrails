# n8n-nodes-guardrails

Official n8n community node providing bidirectional PII masking, adversarial prompt injection defense, compliance auditing, and execution budget circuit breaking for AI workflows.

---

## Overview

Deploying Large Language Models in n8n workflows exposes automation pipelines to data privacy risks, injection attacks, and runaway execution costs. `n8n-nodes-guardrails` acts as a security boundary directly before and after model nodes:

- Inbound PII Sanitization: Identifies payment cards, bank accounts, emails, phone numbers, national IDs, and credentials, replacing them with reversible placeholders.
- Deterministic Entity Mapping: Reuses identical synthetic placeholders for duplicate values to preserve semantic context for the model.
- Outbound Rehydration: Reconstructs real entity values in model outputs using an ephemeral AES-256-GCM encrypted mapping vault.
- Adversarial Injection Scanner: Evaluates inputs for jailbreak signatures, system prompt leaks, roleplay overrides, delimiter breakouts, and multilingual attacks in Romanian, Spanish, French, and German.
- Side-Channel Exfiltration Defense: Detects markdown image exfiltration payloads and tracks ephemeral canary tokens to detect outbound context leaks.
- Spend and Loop Circuit Breaker: Tracks cumulative token counts, prompt cache hits, reasoning tokens, and estimated costs across major model providers (OpenAI, Anthropic, Google Gemini, DeepSeek).
- Compliance Auditing: Inspects text and JSON structures to generate GDPR and PCI-DSS readiness reports without altering payload data.
- Defensive Prompt Wrapper: Wraps untrusted user submissions in defensive structural boundaries with sandwich defense instructions.

---

## Installation

### Community Nodes (Recommended)
1. In your n8n instance, navigate to **Settings > Community Nodes**.
2. Select **Install a community node**.
3. Enter `n8n-nodes-guardrails` and confirm installation.

### Manual Installation (Self-Hosted / Docker)
Inside your n8n custom directory (usually `~/.n8n/custom`):
```bash
npm install n8n-nodes-guardrails
```
Restart your n8n container to register the node.

---

## Operations Reference

### 1. Mask PII & Check Safety (`sanitize`)
Processes incoming text strings or nested JSON structures before they reach model nodes.

- Input Source: Text string or full JSON object / array.
- Masking Strategies:
  - Synthetic Tokens (`tokens`): Generates unique reversible placeholders.
  - Redaction (`redaction`): Replaces entities with static labels like `[REDACTED_EMAIL]`.
  - Partial Mask (`partial`): Preserves outer characters for human verification (e.g. `jo***n@domain.com`).
  - Salted Hash (`hash`): Produces consistent SHA-256 digests for analytics.
- Token Formats:
  - Mustache: `{{EMAIL_1}}` (default)
  - XML Tag: `<PII_EMAIL_1/>` (recommended for Claude and Gemini)
  - Bracket: `[PII_EMAIL_1]`
- Checksum Validators:
  - Credit Cards: Luhn algorithm check on numbers between 13 and 19 digits.
  - IBAN: Modulo 97 validation according to ISO 7064.
  - Romanian CNP: Control digit verification against 12-digit key.
  - US SSN: Area, group, and serial number formatting validation.
- Advanced Privacy Controls:
  - Deterministic Tokenization: Identical sensitive values share the same token.
  - Entity Allowlist: Comma-separated safe domains, emails, or IP prefixes to exclude from masking.
  - JSON Path Filtering: Include or exclude specific object paths using dot notation and wildcards.
  - Canary Injection: Injects an ephemeral secret token to detect outbound model leaks.
- Output Routing:
  - Output 0 (Safe Output): Contains sanitized text or JSON, entity counts, and `piiVault` token.
  - Output 1 (Blocked / Alert): Receives inputs flagged by the injection scanner.

### 2. Rehydrate PII (`rehydrate`)
Restores synthetic placeholders in model responses back to their original values.

- Inputs: Model generated text or JSON response, along with the `piiVault` string from the sanitize step.
- Cryptographic Vault: Decrypts AES-256-GCM state payload and replaces all matched tokens.
- Canary Verification: Checks whether the model leaked the ephemeral canary token. If leaked, routes to Output 1 with a high-severity alert.
- Output: `restoredText` or `restoredJson` with restored values.

### 3. Scan Prompt Injection (`injection_check`)
Standalone injection scanner for screening user submissions.

- Sensitivity Options: Low (score >= 0.8), Medium (score >= 0.5), High (score >= 0.3).
- Attack Vectors Covered:
  - Direct instruction overrides and system prompt dumps.
  - Jailbreak personas (DAN, Developer Mode, ChaosGPT).
  - Delimiter breakouts (`</system>`, `[INST]`, `### System:`).
  - Obfuscated base64 commands and leetspeak substitutions.
  - Markdown image side-channel exfiltration attacks.
  - Multilingual overrides in Romanian, Spanish, French, and German.
- Normalization: Resolves zero-width characters, invisible codepoints, and leetspeak substitutions before pattern evaluation.

### 4. Enforce Cost & Loop Limit (`circuit_breaker`)
Monitors token spend, prompt caching, reasoning tokens, and agent loop depths to prevent unexpected billing spikes.

- Supported Model Pricing:
  - OpenAI: GPT-4o, GPT-4o Mini, GPT-4 Turbo, o1, o1-mini, o3-mini, GPT-4.5 Preview.
  - Anthropic: Claude 3.7 Sonnet (Hybrid Reasoning), Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus.
  - Google: Gemini 2.0 Flash, Gemini 2.0 Pro, Gemini 1.5 Pro, Gemini 1.5 Flash.
  - DeepSeek: DeepSeek-V3 (`deepseek-chat`), DeepSeek-R1 (`deepseek-reasoner`).
  - Custom: Configurable input and output rates per 1M tokens.
- Extended Token Metering:
  - `cachedPromptTokens`: Applies provider-specific cache discounts.
  - `reasoningTokens`: Tracks internal thinking tokens consumed during reasoning phases.
- Thresholds: Maximum cost in USD and maximum loop iteration count.
- Action on Limit Breach: Routes item to Output 1 (Blocked / Alert) or halts execution with a controlled error.

### 5. Audit PII & Compliance Report (`audit`)
Inspects inbound text or structured JSON payloads and compiles a compliance report without modifying the underlying data.

- Outputs: Total entity counts, type distribution breakdown, GDPR risk classification (`NONE`, `LOW`, `MEDIUM`, `HIGH`), PCI-DSS impact flag, and safe preview masks.
- Use Cases: Data classification pipelines, database migrations, and GDPR audits.

### 6. Defensive Prompt Wrapper (`wrap_prompt`)
Wraps untrusted user submissions in defensive structural boundaries.

- Framing Styles: XML boundaries, Markdown boundaries, or JSON schema envelopes.
- Breakout Prevention: Automatically escapes closing tags inside user text to prevent delimiter breakouts.
- Sandwich Defense: Appends reinforcing trailing instructions directing the model to treat content strictly as passive data.

---

## Example Architecture

```
Inbound Webhook / Chat
          │
          ▼
┌─────────────────────────────────────────┐
│ AI Guardrails (Sanitize)                │
│ - Masks PII to {{TOKEN_N}}              │
│ - Evaluates prompt injection risk       │
│ - Injects ephemeral canary token        │
└─────────────────────────────────────────┘
          │
          ├── Safe ─────────────► [ OpenAI / Claude Model Node ]
          │                                     │
          │                                     ▼
          │                            [ Output with Tokens ]
          │                                     │
          │                                     ▼
          │                       ┌───────────────────────────┐
          │                       │ AI Guardrails (Rehydrate) │
          │                       │ - Restores real values    │
          │                       │ - Verifies zero leaks     │
          │                       └───────────────────────────┘
          │                                     │
          │                                     ▼
          │                              Clean Response
          │
          └── Blocked / Alert ──► [ Security Log / Slack Node ]
```

An importable n8n workflow file is available in [`workflows/guardrails_example.json`](workflows/guardrails_example.json).

---

## Development and Testing

```bash
# Install dependencies
npm install

# Run Vitest test suite (64 unit & integration tests)
npm test

# Build production bundle
npm run build
```

---

## Documentation

- [Internal Architecture](docs/ARCHITECTURE.md)
- [Security Model & Disclosure](docs/SECURITY.md)
- [Sample Workflows](docs/SAMPLE_WORKFLOWS.md)

---

## License

MIT (c) 2026 Alexandr Motologa
