# Changelog

All notable changes to `n8n-nodes-guardrails` will be documented in this file.

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
- Complete Vitest test suite with 100% test pass rate.
