# n8n-nodes-guardrails: Architecture and Engineering Master Plan

Official community node package for n8n in TypeScript providing bidirectional PII masking, prompt injection defense, and LLM budget circuit breaking.

---

## 1. Executive Summary

### 1.1 Problems in Production n8n AI Workflows
Organizations connecting customer chat, internal webhooks, or CRM systems to Large Language Models (LLMs) through n8n face three operational risks:
1. PII Exposure: Customer names, payment cards, bank account identifiers, and national identification numbers are transmitted in plaintext to third-party model providers, violating GDPR, HIPAA, and PCI-DSS compliance regulations.
2. Prompt Injection and Jailbreaks: Malicious inbound payloads attempt to override system instructions, extract confidential system prompts, or hijack tool calling capabilities.
3. Runaway Execution Loops and Unbounded Costs: Recursive agent workflows or autonomous tool call loops can spin indefinitely, accumulating significant API charges in minutes without human oversight.

### 1.2 The Guardrails Solution
`n8n-nodes-guardrails` provides a self-contained security node for n8n workflows:
- Bidirectional PII Masking: Detects sensitive entities in text or JSON objects, replaces them with reversible synthetic tokens or redacted values, and stores mapping data in an AES-256-GCM encrypted state vault.
- Outbound Rehydration: Restores synthetic tokens in model responses back to their original values after generation completes.
- Adversarial Injection Scanner: Evaluates inputs for known jailbreak heuristics, system prompt extraction, roleplay overrides, delimiter breakouts, and encoded payloads with configurable sensitivity.
- Spend and Loop Circuit Breaker: Tracks cumulative token counts and estimated costs across major model providers (OpenAI, Anthropic, Google Gemini), enforcing per-execution budgets and maximum loop depths.

---

## 2. High-Level Flow

```
Inbound Payload (Webhook / DB / Chat)
             │
             ▼
  ┌────────────────────────────────────────┐
  │ n8n Node: AI Guardrails                │
  │ Operation: Mask PII & Check Safety     │
  │ - Detects cards (Luhn), IBAN, email,   │
  │   phone, SSN/CNP, IPs, secrets         │
  │ - Replaces with {{TOKEN_N}}            │
  │ - Encrypts vault with AES-256-GCM      │
  │ - Evaluates prompt injection risk      │
  └────────────────────────────────────────┘
             │
             ├── Safe ─────────────► [ Main LLM Node (OpenAI / Claude / Gemini) ]
             │                                        │
             │                                        ▼
             │                       [ Output: "Hello {{NAME_1}}..." ]
             │                                        │
             │                                        ▼
             │                       ┌────────────────────────────────────────┐
             │                       │ n8n Node: AI Guardrails                │
             │                       │ Operation: Rehydrate PII               │
             │                       │ - Decrypts ephemeral vault token       │
             │                       │ - Replaces {{NAME_1}} with real name   │
             │                       └────────────────────────────────────────┘
             │                                        │
             │                                        ▼
             │                       Safe Payload to Customer / Webhook
             │
             └── Blocked / Alert ──► [ Security Alert Branch (Slack / Log) ]
```

---

## 3. Detailed Operations Specification

### 3.1 Operation: `sanitize` (Mask PII and Scan Injection)
- Mode: Single text field or deep JSON object traversal.
- Detectors:
  - Credit Cards: Regex match combined with the Luhn checksum algorithm.
  - IBAN: International bank account format with Modulo 97 verification.
  - Email: RFC 5322 compliant regex.
  - Phone: International E.164 and North American format regex.
  - National IDs: US SSN validation and Romanian CNP checksum validation.
  - IP Addresses: IPv4 and IPv6 patterns.
  - Secrets and API Keys: High-entropy tokens, AWS keys, OpenAI keys, GitHub tokens, Bearer strings.
  - Custom Regex: User-provided regular expressions and token labels.
- Masking Strategies:
  - Synthetic Token: `{{EMAIL_1}}`, `{{CREDIT_CARD_1}}` (reversible).
  - Redaction: `[REDACTED_EMAIL]`, `[REDACTED_CARD]`.
  - Partial: `j***n@example.com`, `****-****-****-1234`.
  - Hash: Salted SHA-256 hex digest.
- Ephemeral Vault: AES-256-GCM encrypted payload containing IV, authentication tag, entity metadata, and original text mappings.
- Injection Evaluation:
  - Normalization: NFKC unicode normalization, zero-width character removal, leetspeak normalization.
  - Attack Types: Direct instruction overrides, system prompt extraction, delimiter breakouts (`</system>`, `[INST]`), roleplay hijacking, base64 payloads.
  - Sensitivity: Low, Medium, High.
- Outputs:
  - Output 0 (Safe Output): `sanitizedText` or `sanitizedJson`, `piiVault`, `detectedPiiCount`, `entities`.
  - Output 1 (Blocked / Alert): `status`, `reason`, `category`, `riskScore`, `rawInput`.

### 3.2 Operation: `rehydrate` (Restore PII)
- Inputs: Masked text or JSON object, and `piiVault` token from the sanitize step.
- Processing:
  - Decrypts and verifies the vault integrity using AES-256-GCM.
  - Identifies all synthetic tokens in the input text or nested JSON values.
  - Replaces tokens with corresponding original values.
- Outputs: `restoredText` or `restoredJson`, `restoredCount`.

### 3.3 Operation: `circuitBreaker` (Budget and Loop Guard)
- Inputs:
  - `model`: Target LLM model for cost calculation (GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet, Claude 3.5 Haiku, Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0 Flash, Custom).
  - `promptTokens`: Number of input tokens in current execution.
  - `completionTokens`: Number of generated tokens in current execution.
  - `iterationCount`: Current loop or agent iteration index.
  - `maxCostUsd`: Maximum allowed dollar spend per execution (e.g., 0.25).
  - `maxIterations`: Maximum allowed iterations before halting (e.g., 10).
- Processing:
  - Computes exact cost using token pricing table.
  - Compares cost against `maxCostUsd`.
  - Compares `iterationCount` against `maxIterations`.
- Outputs:
  - Output 0 (Within Limits): `estimatedCostUsd`, `currentIteration`, `isWithinBudget: true`.
  - Output 1 (Limit Exceeded): `reason`, `estimatedCostUsd`, `currentIteration`, `thresholdExceeded`.

---

## 4. Package and Directory Layout

```
n8n-nodes-guardrails/
├── .github/
│   └── workflows/
│       ├── test.yml
│       └── publish.yml
├── nodes/
│   └── Guardrails/
│       ├── Guardrails.node.ts
│       ├── Guardrails.node.json
│       ├── Guardrails.svg
│       ├── operations/
│       │   ├── sanitize.ts
│       │   ├── rehydrate.ts
│       │   ├── injection_check.ts
│       │   └── circuit_breaker.ts
│       └── utils/
│           ├── pii_patterns.ts
│           ├── injection_patterns.ts
│           ├── pricing_table.ts
│           └── crypto.ts
├── test/
│   ├── sanitize.test.ts
│   ├── rehydrate.test.ts
│   ├── injection.test.ts
│   ├── circuit_breaker.test.ts
│   └── node.test.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   └── SAMPLE_WORKFLOWS.md
├── index.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── LICENSE
├── CHANGELOG.md
└── README.md
```

---

## 5. Implementation Plan

### Phase 1: Repository Scaffolding and Node Package Setup
1. Configure `package.json` following n8n community node specifications.
2. Setup TypeScript configuration (`tsconfig.json`) and Vitest (`vitest.config.ts`).
3. Author the custom vector icon `Guardrails.svg` and `Guardrails.node.json`.
4. Create the root `index.ts` export file.

### Phase 2: PII Detection, Masking, and Cryptographic Vault
1. Implement Luhn checksum algorithm for credit cards.
2. Implement ISO 13616 Modulo 97 verification for IBANs.
3. Implement Romanian CNP control checksum and US SSN validation.
4. Implement regex detectors for Email, Phone, IP addresses, and API keys.
5. Build the AES-256-GCM vault serializer with authentication tags and IV handling.
6. Support deep traversal for nested JSON inputs.
7. Support masking modes: Tokenization, Redaction, Partial, Hash.

### Phase 3: Adversarial Injection Scanner
1. Build text normalization pipeline (NFKC unicode, zero-width, leetspeak).
2. Implement heuristic detectors for jailbreaks, system prompt extraction, roleplay hijacking, delimiter breaks, and encoded strings.
3. Implement configurable sensitivity thresholds (Low, Medium, High).
4. Integrate detection into both standalone scanning and inline sanitize flows.

### Phase 4: Spend and Loop Circuit Breaker
1. Establish pricing matrix for OpenAI, Anthropic, and Google Gemini models.
2. Build budget evaluator calculating exact USD spend from token inputs.
3. Build iteration evaluator checking recursive agent loops.
4. Add secondary output routing for breached budgets.

### Phase 5: Main n8n Node Integration
1. Implement `Guardrails.node.ts` implementing `INodeType`.
2. Configure UI parameters, options, defaults, and documentation tooltips.
3. Configure dual-branch outputs (`Safe Output` vs `Blocked / Alert`).
4. Support multi-item processing loop adhering to n8n execution standards.

### Phase 6: Verification, Test Suite, and Documentation
1. Author Vitest unit test suite covering every detector, edge case, and execution path.
2. Ensure 100% test pass rate with strict assertions.
3. Author comprehensive documentation (`README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `SAMPLE_WORKFLOWS.md`).
4. Ensure compliance with humanizer guidelines (no em dashes, no superlatives, clear technical prose).
5. Configure GitHub Actions CI workflow for test automation and npm publishing.
