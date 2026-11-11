# Sample Workflows and Integration Guide

This guide describes how to integrate `n8n-nodes-guardrails` into your n8n workflows.

---

## Pattern 1: Bidirectional PII Sanitization and Rehydration

In this pattern, raw customer data is sanitized before passing to an OpenAI model, and the model's response is rehydrated with original data before reaching the customer.

```
[ Inbound Webhook ]
        │
        ▼
[ AI Guardrails: Sanitize ] ──── (Blocked) ───► [ Slack / Security Alert ]
        │
      (Safe)
        │
        ▼
[ OpenAI Model / LangChain ]
        │
        ▼
[ AI Guardrails: Rehydrate ]
        │
        ▼
[ Respond to Webhook ]
```

### Configuration Steps
1. Place the **AI Guardrails** node immediately after your webhook or trigger.
2. Set **Operation** to `Mask PII & Check Safety`.
3. Set **Input Text** to `={{ $json.body.message }}`.
4. Set **Masking Strategy** to `Synthetic Tokens (Reversible, e.g. {{EMAIL_1}})`.
5. Connect Output 0 (Safe Output) to your LLM node (OpenAI, Anthropic, or Gemini).
6. Connect Output 1 (Blocked / Alert) to an alert channel (Slack, Telegram, or audit logger).
7. In your LLM node, pass the `{{ $json.sanitizedText }}` field as prompt input.
8. Add a second **AI Guardrails** node after the LLM.
9. Set **Operation** to `Rehydrate PII`.
10. Set **Masked Text** to `={{ $json.text }}` (or LLM output field).
11. Set **PII Vault Token** to `={{ $('Sanitize').item.json.piiVault }}`.
12. Output now contains `restoredText` with all synthetic tokens replaced by real values.

---

## Pattern 2: Agent Loop Spend Guard

When building autonomous agents with loop cycles, place the Circuit Breaker inside the loop.

### Configuration Steps
1. Insert **AI Guardrails** at the start of your loop iteration.
2. Set **Operation** to `Enforce Cost & Loop Limit`.
3. Set **Model** to your LLM (e.g. `GPT-4o`).
4. Set **Prompt Tokens** and **Completion Tokens** from previous step outputs.
5. Set **Current Iteration Count** to `={{ $runIndex + 1 }}`.
6. Set **Max Cost Limit ($ USD)** to your budget (e.g. `0.25`).
7. Set **Max Iteration Depth** to `5`.
8. Connect Output 0 to the next agent tool step, and Output 1 to a graceful exit node.
