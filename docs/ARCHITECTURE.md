# Architecture and Internal Design

`n8n-nodes-guardrails` is an official community node package for n8n designed to safeguard LLM workflows against PII leaks, adversarial prompt injection attacks, and unbounded API costs.

---

## 1. Core Subsystems

The package is partitioned into four decoupled subsystems:
1. PII Detection Engine (`nodes/Guardrails/utils/pii_patterns.ts`): Rule based and algorithmic entity detection.
2. Ephemeral Vault (`nodes/Guardrails/utils/crypto.ts`): Authenticated symmetric encryption for state preservation.
3. Injection Heuristics (`nodes/Guardrails/utils/injection_patterns.ts`): Adversarial pattern matcher with normalization.
4. Circuit Breaker (`nodes/Guardrails/utils/pricing_table.ts`): Dynamic token cost calculation and recursion depth gate.

---

## 2. PII Detection and Algorithmic Checksums

Many PII scanners rely purely on naive regular expressions, causing excessive false positives on order numbers, IDs, and timestamps. `n8n-nodes-guardrails` pairs candidate regex matching with strict mathematical verification:

### 2.1 Credit Card Verification (Luhn Algorithm)
Candidate digit sequences between 13 and 19 characters are tested against the Modulo 10 Luhn algorithm. Starting from the rightmost digit, every second number is doubled. If the doubled value exceeds 9, 9 is subtracted. The candidate is only classified as a payment card when the sum modulo 10 equals 0.

### 2.2 International Bank Account Number (ISO 7064 Modulo 97)
IBAN strings are validated by transposing the country code and check digits to the end of the string, converting letters to numeric equivalents (A = 10 through Z = 35), and calculating chunked Modulo 97 division. A remainder of 1 confirms a valid IBAN.

### 2.3 Romanian CNP (Cod Numeric Personal)
Romanian national identification numbers (13 digits) are validated by multiplying each of the first 12 digits against the control key `[2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9]`. The sum modulo 11 yields the check digit, which must match the 13th digit.

### 2.4 Deep JSON Traversal
When the input source is set to JSON, the engine traverses the data structure recursively. All string values are processed, while object keys, numbers, booleans, and arrays retain their original schema.

---

## 3. Cryptographic Ephemeral Vault

To allow outbound model responses to be restored with real data without storing sensitive information in plaintext across node memory, the sanitize operation outputs an encrypted vault string.

### 3.1 Encryption Architecture
- Algorithm: AES-256-GCM (Galois/Counter Mode).
- Initialization Vector: 12 bytes generated per operation using `crypto.randomBytes(12)`.
- Authentication Tag: 16 bytes verifying payload integrity.
- Key Derivation: SHA-256 hash over an optional custom user passphrase or a generated execution seed.
- Token Format: `v1.<iv_base64url>.<tag_base64url>.<ciphertext_base64url>`.

Any tampering with the ciphertext, IV, or authentication tag causes immediate decryption failure.

---

## 4. Adversarial Injection Detection Pipeline

Adversarial prompts often use Unicode homoglyphs, zero-width characters, or leetspeak to bypass naive keyword filters. The injection scanner runs a multi-stage pipeline:

1. Text Normalization:
   - Unicode NFKC normalization converts compatibility characters into standard forms.
   - Zero-width codepoints (`\u200B`, `\u200C`, `\u200D`, `\uFEFF`) and invisible directional markers are stripped.
   - Common leetspeak substitutions are resolved (`0` to `o`, `3` to `e`, `1` to `i`, `@` to `a`, `$` to `s`, `7` to `t`).
2. Encoded Payload Inspection:
   - Base64 candidate strings of 24 characters or longer are decoded and evaluated for embedded injection directives.
3. Rule Evaluation:
   - Matches against categorized heuristic sets: direct instruction overrides, system prompt extraction, jailbreak personas, roleplay bypasses, and chat markup breakouts.
4. Risk Scoring:
   - Evaluates weighted matches against sensitivity thresholds (low: 0.8, medium: 0.5, high: 0.3).
   - Routes unsafe inputs to the secondary alert output connector.

---

## 5. Circuit Breaker and Cost Calculation

Autonomous agents and feedback loops in n8n can enter runaway execution loops. The circuit breaker checks two criteria:
1. Financial Budget: Calculates token spend against an internal price table covering current model rates (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5/2.0, or custom rates).
2. Iteration Depth: Evaluates the current loop count against a user-defined ceiling.

When a limit is reached, the node directs the item to Output 1 (Blocked / Alert) or throws a controlled `NodeOperationError` based on user configuration.
