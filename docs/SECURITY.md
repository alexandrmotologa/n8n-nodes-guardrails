# Security Policy

## Supported Versions

Security updates are provided for the following releases:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | Yes                |

---

## Threat Model and Security Considerations

### 1. Inbound PII Masking
The node strips sensitive identifiers before data reaches third-party LLM providers. However, guardrails should be part of a defense-in-depth approach. Users should ensure TLS is enforced on all webhook endpoints and database connections.

### 2. Vault Token Confidentiality
The `piiVault` string contains encrypted entity mappings. While AES-256-GCM protects the contents against unauthorized decryption and tampering, the token string should not be logged to public observability systems. When working with regulated data (GDPR, HIPAA, PCI-DSS), specify a strong passphrase in the `vaultSecret` parameter.

### 3. Prompt Injection Defense
Heuristic injection scanning detects known adversarial patterns, jailbreak frameworks, and encoding tricks. Adversaries continuously invent new prompt variations. For high-privilege tool execution, combine this node with human-in-the-loop approvals.

---

## Reporting a Vulnerability

If you discover a security vulnerability within `n8n-nodes-guardrails`:
1. Do not open a public issue on GitHub.
2. Email the maintainer directly at `security@motologa.com` or open a private security advisory through GitHub.
3. Include details of the vulnerability, reproduction steps, and impact assessment.

Security reports receive an initial response within 48 hours, followed by coordinated disclosure once a patch is released.
