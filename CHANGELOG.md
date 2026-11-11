# Changelog

All notable changes to `n8n-nodes-guardrails` will be documented in this file.

## [1.1.0] - 2026-11-11

### Added
- Deterministic tokenization reusing identical synthetic placeholders for duplicate sensitive entities.
- Safe entity allowlist for company domains, internal subnets, and test records.
- Configurable token formats supporting Mustache (`{{...}}`), XML tags (`<PII_.../>`), and Bracket tags (`[...]`).
- Deep JSON path filtering supporting dot notation and wildcards for targeted field masking.
- Side-channel markdown image exfiltration scanner detecting data smuggling in URL query parameters.
- Ephemeral canary token injection and outbound leak detection in rehydration steps.
- Multilingual prompt injection heuristics for Romanian, Spanish, French, and German attack patterns.
- Extended 2026 model pricing matrix supporting Claude 3.7 Sonnet (Hybrid), Gemini 2.0 Flash/Pro, DeepSeek R1/V3, o3-mini, and GPT-4.5 Preview.
- Prompt cache discount calculation and reasoning/thinking token metering.
- New operation `audit` for zero-mutation PII audits and GDPR/PCI-DSS risk assessment reports.
- New operation `wrap_prompt` implementing defensive XML/Markdown boundaries and sandwich defense.
- Expanded test suite to 64 unit and integration tests covering 100% of execution paths.

## [1.0.0] - 2026-11-11

### Added
- Inbound PII detection and masking with support for text and nested JSON structures.
- Mathematical validation engines for payment cards (Luhn) and bank accounts (Modulo 97 IBAN).
- National ID verification for US SSN and Romanian CNP formats.
- Ephemeral state vault using authenticated AES-256-GCM encryption with tamper detection.
- Reversible token rehydration for model responses.
- Adversarial prompt injection scanner with Unicode normalization and leetspeak decoding.
- Financial budget and execution loop circuit breaker supporting major model providers.
- Dual-branch execution routing for safe outputs and security alerts.
- Initial Vitest test suite.
