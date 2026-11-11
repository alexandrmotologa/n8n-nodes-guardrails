# n8n-nodes-guardrails

Official n8n community node providing bidirectional PII masking, adversarial prompt injection defense, and execution budget circuit breaking for AI workflows.

---

## Overview

Deploying Large Language Models in n8n workflows exposes automation pipelines to data privacy risks, injection attacks, and runaway execution costs. `n8n-nodes-guardrails` acts as a security boundary directly before and after model nodes:

- Inbound PII Sanitization: Identifies payment cards, bank accounts, emails, phone numbers, national IDs, and credentials, replacing them with reversible placeholders.
- Outbound Rehydration: Reconstructs real entity values in model outputs using an ephemeral AES-256-GCM encrypted mapping vault.
- Adversarial Injection Scanner: Evaluates inputs for jailbreak signatures, system prompt leaks, roleplay overrides, and delimiter breakouts.
- Spend and Loop Circuit Breaker: Tracks cumulative token counts and estimated costs across major model providers, halting workflows that exceed defined thresholds.

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
  - Synthetic Tokens (`tokens`): Generates unique reversible placeholders like `{{EMAIL_1}}` and `{{CREDIT_CARD_1}}`.
  - Redaction (`redaction`): Replaces entities with static labels like `[REDACTED_EMAIL]`.
  - Partial Mask (`partial`): Preserves outer characters for human verification (e.g. `jo***n@domain.com`).
  - Salted Hash (`hash`): Produces consistent SHA-256 digests for analytics.
- Checksum Validators:
  - Credit Cards: Luhn algorithm check on numbers between 13 and 19 digits.
  - IBAN: Modulo 97 validation according to ISO 7064.
  - Romanian CNP: Control digit verification against 12-digit key.
  - US SSN: Area, group, and serial number formatting validation.
- Output Routing:
  - Output 0 (Safe Output): Contains sanitized text or JSON, entity counts, and `piiVault` token.
  - Output 1 (Blocked / Alert): Receives inputs flagged by the injection scanner.

### 2. Rehydrate PII (`rehydrate`)
Restores synthetic placeholders in model responses back to their original values.

- Inputs: Model generated text or JSON response, along with the `piiVault` string from the sanitize step.
- Cryptographic Vault: Decrypts AES-256-GCM state payload and replaces all matched tokens.
- Output: `restoredText` or `restoredJson` with restored values.

### 3. Scan Prompt Injection (`injection_check`)
Standalone injection scanner for screening user submissions.

- Sensitivity Options: Low (score >= 0.8), Medium (score >= 0.5), High (score >= 0.3).
- Attack Vectors Covered: Direct instruction overrides, system prompt extraction, jailbreak personas (DAN, developer mode), delimiter breaks (`</system>`, `[INST]`), and base64 encoded payloads.
- Normalization: Resolves zero-width characters, invisible codepoints, and leetspeak substitutions before pattern evaluation.

### 4. Enforce Cost & Loop Limit (`circuit_breaker`)
Monitors token spend and agent loop depths to prevent unexpected billing spikes.

- Supported Model Pricing:
  - OpenAI: GPT-4o, GPT-4o Mini, GPT-4 Turbo, o1, o1-mini.
  - Anthropic: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus.
  - Google: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0 Flash.
  - Custom: Configurable input and output rates per 1M tokens.
- Thresholds: Maximum cost in USD and maximum loop iteration count.
- Action on Limit Breach: Routes item to Output 1 (Blocked / Alert) or halts execution with a controlled error.

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

# Run Vitest test suite
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
