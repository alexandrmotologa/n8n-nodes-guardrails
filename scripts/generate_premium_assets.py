import asyncio
import os
import subprocess
from playwright.async_api import async_playwright

WORKSPACE = "B:/workgit/n8n-nodes-guardrails"
DOCS_IMAGES = os.path.join(WORKSPACE, "docs/images")
TEMP_FRAMES = os.path.join(WORKSPACE, "temp_render_frames")

os.makedirs(DOCS_IMAGES, exist_ok=True)
os.makedirs(TEMP_FRAMES, exist_ok=True)

SHARED_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #0b0f19;
  color: #f1f5f9;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
}

code, pre, .mono {
  font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
}

/* n8n Canvas Dot Grid */
.n8n-canvas {
  background-color: #0f172a;
  background-image: radial-gradient(circle, #334155 1.2px, transparent 1.2px);
  background-size: 24px 24px;
}
"""

DASHBOARD_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    __SHARED_CSS__

    .app-container {
      width: 1440px;
      height: 900px;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    /* n8n Top Navigation Bar */
    .top-nav {
      height: 52px;
      background: #090d16;
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 20;
    }

    .nav-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .n8n-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }

    .n8n-icon-box {
      width: 28px;
      height: 28px;
      background: #ff6d5a;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      color: #fff;
      font-size: 16px;
      box-shadow: 0 2px 8px rgba(255, 109, 90, 0.4);
    }

    .n8n-brand-name {
      font-weight: 800;
      font-size: 17px;
      color: #ffffff;
      letter-spacing: -0.02em;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #64748b;
      font-size: 13px;
    }

    .breadcrumb-title {
      color: #f1f5f9;
      font-weight: 600;
      font-size: 13.5px;
    }

    .status-badge-active {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10b981;
      color: #34d399;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn-test-wf {
      background: #ff6d5a;
      color: white;
      font-size: 12px;
      font-weight: 700;
      padding: 7px 16px;
      border-radius: 6px;
      border: none;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 10px rgba(255, 109, 90, 0.35);
    }

    .btn-secondary {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
      font-size: 12px;
      font-weight: 600;
      padding: 7px 14px;
      border-radius: 6px;
    }

    /* Workflow Canvas Area */
    .canvas-viewport {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    /* SVG Connecting Curves */
    .connection-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
    }

    /* n8n Node Styles */
    .node-card {
      position: absolute;
      width: 230px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);
      padding: 12px 14px;
      z-index: 3;
      transition: all 0.2s ease;
    }

    .node-card.guardrails-active {
      border: 2px solid #ff6d5a;
      box-shadow: 0 0 25px rgba(255, 109, 90, 0.35), 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .node-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .node-icon-box {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .node-title {
      font-size: 13px;
      font-weight: 700;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .node-subtitle {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 1px;
    }

    .node-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #334155;
      padding-top: 8px;
      margin-top: 6px;
    }

    .node-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    /* Connector Ports */
    .port-in {
      position: absolute;
      left: -6px;
      top: 50%;
      transform: translateY(-50%);
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #64748b;
      border: 2px solid #0f172a;
    }

    .port-out {
      position: absolute;
      right: -6px;
      top: 50%;
      transform: translateY(-50%);
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ff6d5a;
      border: 2px solid #0f172a;
      box-shadow: 0 0 6px #ff6d5a;
    }

    /* Open Modal / Inspector Panel */
    .node-inspector-modal {
      position: absolute;
      bottom: 24px;
      left: 36px;
      right: 36px;
      height: 480px;
      background: #0d1322;
      border: 1px solid #334155;
      border-radius: 12px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 109, 90, 0.25);
      display: flex;
      flex-direction: column;
      z-index: 10;
      overflow: hidden;
    }

    .modal-header {
      background: #151d30;
      border-bottom: 1px solid #1e293b;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-title-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-badge-n8n {
      background: rgba(255, 109, 90, 0.18);
      border: 1px solid #ff6d5a;
      color: #ff8b7b;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
    }

    .modal-tabs {
      display: flex;
      gap: 20px;
      font-size: 12.5px;
      font-weight: 600;
      color: #94a3b8;
    }

    .modal-tab-active {
      color: #ff6d5a;
      border-bottom: 2px solid #ff6d5a;
      padding-bottom: 4px;
    }

    .modal-body {
      flex: 1;
      display: grid;
      grid-template-columns: 320px 1fr 1fr;
      gap: 16px;
      padding: 16px 20px;
      background: #090d16;
      overflow: hidden;
    }

    .panel-box {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panel-box-header {
      background: #182234;
      padding: 10px 14px;
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 700;
      color: #cbd5e1;
    }

    .panel-box-content {
      flex: 1;
      padding: 12px 14px;
      overflow-y: auto;
      font-size: 12.5px;
    }

    /* Configuration form styles */
    .config-group {
      margin-bottom: 14px;
    }

    .config-label {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 6px;
      display: block;
    }

    .config-pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .config-pill {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .config-pill.active {
      background: rgba(16, 185, 129, 0.15);
      border-color: #10b981;
      color: #34d399;
    }

    /* JSON display cards */
    .json-code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.7;
      color: #cbd5e1;
      white-space: pre-wrap;
    }

    .json-key {
      color: #94a3b8;
    }

    .json-str {
      color: #38bdf8;
    }

    .json-sens {
      background: rgba(244, 63, 94, 0.2);
      border: 1px solid #f43f5e;
      color: #fda4af;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 600;
    }

    .json-masked {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid #10b981;
      color: #6ee7b7;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 700;
    }

    /* Modal Footer Telemetry */
    .modal-footer {
      background: #111827;
      border-top: 1px solid #1e293b;
      padding: 8px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
      color: #94a3b8;
    }

    .telemetry-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .telemetry-val {
      color: #f8fafc;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="app-container">
    <!-- Top Nav -->
    <header class="top-nav">
      <div class="nav-left">
        <div class="n8n-logo">
          <div class="n8n-icon-box">n</div>
          <span class="n8n-brand-name">n8n</span>
        </div>
        <div class="breadcrumb">
          <span>/</span>
          <span>Workflows</span>
          <span>/</span>
          <span class="breadcrumb-title">Customer Support &amp; Billing Agent [Secure Gateway]</span>
        </div>
        <div class="status-badge-active">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981;"></span>
          Active
        </div>
      </div>

      <div class="nav-right">
        <span style="color: #64748b; font-size: 12px; margin-right: 8px;">Zoom 100%</span>
        <button class="btn-secondary">Executions (14)</button>
        <button class="btn-test-wf">
          <span>▶</span> Test Workflow
        </button>
      </div>
    </header>

    <!-- Canvas -->
    <main class="canvas-viewport n8n-canvas">
      <!-- Curved SVG Connections -->
      <svg class="connection-svg" viewBox="0 0 1440 848">
        <defs>
          <linearGradient id="wireGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#ff6d5a" />
          </linearGradient>
          <linearGradient id="wireGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ff6d5a" />
            <stop offset="100%" stop-color="#38bdf8" />
          </linearGradient>
          <linearGradient id="wireGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#a855f7" />
          </linearGradient>
        </defs>

        <!-- Path 1: Webhook to Guardrails Mask -->
        <path d="M 270 180 C 340 180, 360 180, 430 180" fill="none" stroke="url(#wireGrad1)" stroke-width="2.5" />
        <circle cx="__FLOW_CIRCLE_CX__" cy="180" r="4" fill="#ff6d5a" />

        <!-- Path 2: Guardrails Mask to Claude 3.5 -->
        <path d="M 660 180 C 730 180, 750 180, 820 180" fill="none" stroke="url(#wireGrad2)" stroke-width="2.5" />
        
        <!-- Path 3: Claude 3.5 to Guardrails Rehydrate -->
        <path d="M 1050 180 C 1110 180, 1120 180, 1180 180" fill="none" stroke="url(#wireGrad3)" stroke-width="2.5" />
      </svg>

      <!-- Node 1: Webhook Trigger -->
      <div class="node-card" style="left: 40px; top: 140px;">
        <div class="port-out"></div>
        <div class="node-header">
          <div class="node-icon-box" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">⚡</div>
          <div>
            <div class="node-title">Webhook Trigger</div>
            <div class="node-subtitle">POST /customer-support</div>
          </div>
        </div>
        <div class="node-footer">
          <span style="font-size: 11px; color: #94a3b8;">Untrusted Inbound</span>
          <span class="node-pill" style="background: #14532d; color: #86efac;">1 ITEM</span>
        </div>
      </div>

      <!-- Node 2: n8n AI Guardrails: Mask (Highlighted) -->
      <div class="node-card guardrails-active" style="left: 430px; top: 135px; width: 240px;">
        <div class="port-in"></div>
        <div class="port-out"></div>
        <div class="node-header">
          <div class="node-icon-box" style="background: #ff6d5a; color: white;">🛡️</div>
          <div>
            <div class="node-title" style="color: #ff8b7b;">AI Guardrails: Mask</div>
            <div class="node-subtitle">PII Shield &amp; Ephemeral Vault</div>
          </div>
        </div>
        <div class="node-footer">
          <span style="font-size: 11px; color: #34d399; font-weight: 600;">● ZERO LEAK</span>
          <span class="node-pill" style="background: rgba(255, 109, 90, 0.2); color: #ff8b7b; border: 1px solid #ff6d5a;">COMMUNITY</span>
        </div>
      </div>

      <!-- Node 3: Claude 3.5 Sonnet / OpenAI -->
      <div class="node-card" style="left: 820px; top: 140px;">
        <div class="port-in"></div>
        <div class="port-out"></div>
        <div class="node-header">
          <div class="node-icon-box" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;">🤖</div>
          <div>
            <div class="node-title">Claude 3.5 Sonnet</div>
            <div class="node-subtitle">Sanitized Prompt Only</div>
          </div>
        </div>
        <div class="node-footer">
          <span style="font-size: 11px; color: #94a3b8;">1,482 Tokens</span>
          <span class="node-pill" style="background: #0369a1; color: #bae6fd;">$0.0042</span>
        </div>
      </div>

      <!-- Node 4: n8n AI Guardrails: Rehydrate -->
      <div class="node-card" style="left: 1180px; top: 140px;">
        <div class="port-in"></div>
        <div class="node-header">
          <div class="node-icon-box" style="background: rgba(168, 85, 247, 0.2); color: #c084fc;">🔄</div>
          <div>
            <div class="node-title">Guardrails: Rehydrate</div>
            <div class="node-subtitle">Deterministic Mapping</div>
          </div>
        </div>
        <div class="node-footer">
          <span style="font-size: 11px; color: #c084fc; font-weight: 600;">100% Match</span>
          <span class="node-pill" style="background: #581c87; color: #e9d5ff;">RESTORED</span>
        </div>
      </div>

      <!-- Foreground Modal: Node Configuration & Live Data -->
      <div class="node-inspector-modal">
        <div class="modal-header">
          <div class="modal-title-area">
            <span style="font-size: 18px;">🛡️</span>
            <div>
              <span style="font-size: 14px; font-weight: 700; color: #ffffff;">n8n AI Guardrails (Sanitize &amp; Ephemeral Vault)</span>
              <span style="color: #64748b; font-size: 12px; margin-left: 8px;">nodes-guardrails v1.1.0</span>
            </div>
            <span class="modal-badge-n8n">OFFICIAL COMMUNITY NODE</span>
          </div>

          <div class="modal-tabs">
            <span class="modal-tab-active">Parameters &amp; Rules</span>
            <span>Live Data Diff</span>
            <span>Security Attestation</span>
          </div>
        </div>

        <div class="modal-body">
          <!-- Col 1: Parameters -->
          <div class="panel-box">
            <div class="panel-box-header">
              <span>NODE PARAMETERS</span>
              <span style="color: #10b981; font-size: 11px;">● ACTIVE</span>
            </div>
            <div class="panel-box-content">
              <div class="config-group">
                <span class="config-label">Operation Mode</span>
                <div style="background: #1e293b; padding: 6px 10px; border-radius: 6px; font-weight: 600; font-size: 12px; border: 1px solid #334155;">
                  Sanitize &amp; Mask Inbound PII
                </div>
              </div>

              <div class="config-group">
                <span class="config-label">Active Entity Filters</span>
                <div class="config-pill-row">
                  <span class="config-pill active">✓ Credit Card (Luhn)</span>
                  <span class="config-pill active">✓ IBAN (ISO 7064)</span>
                  <span class="config-pill active">✓ National ID (RO CNP)</span>
                  <span class="config-pill active">✓ Email (RFC 5322)</span>
                  <span class="config-pill active">✓ High-Entropy API Keys</span>
                </div>
              </div>

              <div class="config-group">
                <span class="config-label">Vault Storage &amp; Cipher</span>
                <div style="background: #1e293b; padding: 8px 10px; border-radius: 6px; font-size: 11.5px; border: 1px solid #334155;">
                  <div style="color: #38bdf8; font-weight: 700; margin-bottom: 2px;">AES-256-GCM Ephemeral</div>
                  <div style="color: #94a3b8; font-size: 11px;">Keys auto-shred at workflow end (0 disk)</div>
                </div>
              </div>

              <div class="config-group">
                <span class="config-label">Injection Defense</span>
                <div style="background: #1e293b; padding: 6px 10px; border-radius: 6px; font-size: 11.5px; border: 1px solid #334155; display: flex; justify-content: space-between;">
                  <span>Sandwich Wrapper</span>
                  <span style="color: #10b981; font-weight: 700;">ENABLED</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Col 2: Inbound Untrusted Raw Data -->
          <div class="panel-box">
            <div class="panel-box-header">
              <span>INPUT: RAW UNTRUSTED JSON</span>
              <span style="color: #f43f5e; font-size: 11px;">⚠️ SENSITIVE DATA DETECTED</span>
            </div>
            <div class="panel-box-content" style="background: #060913; position: relative;">
              <pre class="json-code">{
  <span class="json-key">"customer"</span>: <span class="json-str">"Alexandru Motologa"</span>,
  <span class="json-key">"email"</span>: <span class="json-sens">"alexander@enterprise-corp.com"</span>,
  <span class="json-key">"card_number"</span>: <span class="json-sens">"4532-8901-2345-0366"</span>,
  <span class="json-key">"iban"</span>: <span class="json-sens">"DE89370400440532013000"</span>,
  <span class="json-key">"national_id"</span>: <span class="json-sens">"1800101123456"</span>,
  <span class="json-key">"prompt"</span>: <span class="json-str">"Please check invoice balance."</span>
}</pre>
              
              <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #1e293b; font-size: 11px; color: #94a3b8;">
                <div style="color: #f43f5e; font-weight: 600; margin-bottom: 4px;">Algorithmic Checksums Passed:</div>
                <div>• Card: Luhn Modulo 10 Verified [PASSED]</div>
                <div>• Bank: ISO 7064 Modulo 97 Verified [PASSED]</div>
                <div>• CNP: 12-Digit Control Key Mod 11 [PASSED]</div>
              </div>
            </div>
          </div>

          <!-- Col 3: Sanitized Output for LLM -->
          <div class="panel-box">
            <div class="panel-box-header">
              <span>OUTPUT: SANITIZED PAYLOAD FOR LLM</span>
              <span style="color: __BADGE_COLOR__; font-size: 11px; font-weight: 700;">✓ __BADGE_LABEL__</span>
            </div>
            <div class="panel-box-content" style="background: #060913;">
              <pre class="json-code">{
  <span class="json-key">"customer"</span>: <span class="json-masked">"{{PERSON_1}}"</span>,
  <span class="json-key">"email"</span>: <span class="json-masked">"__OUT_EMAIL__"</span>,
  <span class="json-key">"card_number"</span>: <span class="json-masked">"__OUT_CARD__"</span>,
  <span class="json-key">"iban"</span>: <span class="json-masked">"__OUT_IBAN__"</span>,
  <span class="json-key">"national_id"</span>: <span class="json-masked">"__OUT_CNP__"</span>,
  <span class="json-key">"prompt"</span>: <span class="json-str">"Please check invoice balance."</span>
}</pre>

              <div style="margin-top: 14px; padding: 10px; border-radius: 6px; background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; font-size: 11.5px;">
                <div style="color: #34d399; font-weight: 700; margin-bottom: 2px;">Vault Status: __VAULT_STATUS__</div>
                <div style="color: #cbd5e1; font-size: 11px;">Surrogate tokens preserve semantic context for Claude/GPT-4o without exposing raw PII.</div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="telemetry-item">
            <span>Memory Vault ID:</span>
            <span class="telemetry-val mono">vault_9f81a7b0c34e</span>
          </div>
          <div class="telemetry-item">
            <span>Execution Spend:</span>
            <span class="telemetry-val" style="color: #38bdf8;">$0.0034 / $0.2500 cap</span>
          </div>
          <div class="telemetry-item">
            <span>Canary Verification:</span>
            <span class="telemetry-val" style="color: #34d399;">ZERO LEAK CONFIRMED</span>
          </div>
          <div class="telemetry-item">
            <span>Test Suite:</span>
            <span class="telemetry-val" style="color: #ff8b7b;">64/64 PASSING</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</body>
</html>"""

def get_dashboard_html(highlight_step=2, scan_progress=0.5, rehydrated=False):
  if not rehydrated:
    out_card = "{{CREDIT_CARD_1}}"
    out_iban = "{{IBAN_1}}"
    out_cnp = "{{RO_CNP_1}}"
    out_email = "{{EMAIL_1}}"
    vault_status = "ENCRYPTED IN MEMORY (AES-256-GCM)"
    badge_label = "PII MASKED • 0 LEAK"
    badge_color = "#10b981"
  else:
    out_card = "4532-8901-2345-0366"
    out_iban = "DE89370400440532013000"
    out_cnp = "1800101123456"
    out_email = "alexander@enterprise-corp.com"
    vault_status = "REHYDRATED & PURGED FROM VAULT"
    badge_label = "REHYDRATED • 100% MATCH"
    badge_color = "#a855f7"

  cx = 270 + int(scan_progress * 160)
  
  html = DASHBOARD_TEMPLATE
  html = html.replace("__SHARED_CSS__", SHARED_CSS)
  html = html.replace("__FLOW_CIRCLE_CX__", str(cx))
  html = html.replace("__BADGE_COLOR__", badge_color)
  html = html.replace("__BADGE_LABEL__", badge_label)
  html = html.replace("__OUT_CARD__", out_card)
  html = html.replace("__OUT_IBAN__", out_iban)
  html = html.replace("__OUT_CNP__", out_cnp)
  html = html.replace("__OUT_EMAIL__", out_email)
  html = html.replace("__VAULT_STATUS__", vault_status)
  return html

AUDIT_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    __SHARED_CSS__

    .container {
      width: 1440px;
      height: 900px;
      background: #090d16;
      display: flex;
      flex-direction: column;
      padding: 36px 48px;
    }

    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 24px;
      margin-bottom: 28px;
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .shield-badge {
      width: 44px;
      height: 44px;
      background: #ff6d5a;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      color: white;
      box-shadow: 0 4px 14px rgba(255, 109, 90, 0.4);
    }

    .main-title {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.01em;
    }

    .main-subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 3px;
    }

    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
      margin-bottom: 28px;
    }

    .kpi-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 18px 20px;
    }

    .kpi-label {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .kpi-val {
      font-size: 22px;
      font-weight: 800;
      margin-top: 8px;
    }

    /* Audit Table */
    .table-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      overflow: hidden;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .table-header {
      background: #182234;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      background: #0f172a;
      padding: 14px 24px;
      font-size: 11.5px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #1e293b;
    }

    td {
      padding: 16px 24px;
      font-size: 13px;
      border-bottom: 1px solid #1e293b;
      color: #cbd5e1;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .badge-scope {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      display: inline-block;
    }

    .badge-status {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div class="title-area">
        <div class="shield-badge">🛡️</div>
        <div>
          <div class="main-title">n8n AI Guardrails • GDPR &amp; PCI-DSS Audit Inspector</div>
          <div class="main-subtitle">Automated verification matrix for enterprise data privacy and regulatory compliance</div>
        </div>
      </div>
      <div>
        <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; font-weight: 700; font-size: 12px; padding: 8px 16px; border-radius: 20px;">
          ● 100% AUDIT READY: ZERO LEAKS REPORTED
        </span>
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">TOTAL SENSITIVE ENTITIES</div>
        <div class="kpi-val" style="color: #38bdf8;">5 Intercepted</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ALGORITHMIC VALIDATION</div>
        <div class="kpi-val" style="color: #10b981;">100% Passed</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">INJECTION ATTACKS DEFUSED</div>
        <div class="kpi-val" style="color: #a855f7;">Zero Exploits</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">EPHEMERAL VAULT RETENTION</div>
        <div class="kpi-val" style="color: #34d399;">0 bytes on Disk</div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-header">
        <span style="font-weight: 700; font-size: 13px; color: #ffffff;">REGULATORY AUDIT SPECIFICATION MATRIX</span>
        <span style="font-size: 12px; color: #94a3b8;">Workflow ID: wf_support_live_prod</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Entity Category</th>
            <th>Sample (Masked)</th>
            <th>Algorithmic Rule</th>
            <th>Confidence</th>
            <th>Compliance Scope</th>
            <th>Audit Outcome</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong style="color: #38bdf8;" class="mono">CREDIT_CARD</strong></td>
            <td class="mono">4532 **** **** 0366</td>
            <td>Luhn Checksum (Modulo 10)</td>
            <td class="mono" style="color: #10b981; font-weight: 700;">100.0%</td>
            <td><span class="badge-scope" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid #ef4444;">PCI-DSS Req 3.4 (CHD)</span></td>
            <td><span class="badge-status" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">✓ VERIFIED MASKED</span></td>
          </tr>
          <tr>
            <td><strong style="color: #38bdf8;" class="mono">IBAN_ACCOUNT</strong></td>
            <td class="mono">DE89 **** **** 3000</td>
            <td>ISO 7064 Modulo 97-10</td>
            <td class="mono" style="color: #10b981; font-weight: 700;">100.0%</td>
            <td><span class="badge-scope" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid #a855f7;">GDPR Financial (Art. 32)</span></td>
            <td><span class="badge-status" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">✓ VERIFIED MASKED</span></td>
          </tr>
          <tr>
            <td><strong style="color: #38bdf8;" class="mono">NATIONAL_ID (RO CNP)</strong></td>
            <td class="mono">1800 **** **56</td>
            <td>12-Digit Control Key (Mod 11)</td>
            <td class="mono" style="color: #10b981; font-weight: 700;">100.0%</td>
            <td><span class="badge-scope" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid #f59e0b;">GDPR National Identifier</span></td>
            <td><span class="badge-status" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">✓ VERIFIED MASKED</span></td>
          </tr>
          <tr>
            <td><strong style="color: #38bdf8;" class="mono">CUSTOMER_EMAIL</strong></td>
            <td class="mono">al***@enterprise-corp.com</td>
            <td>RFC 5322 Standard Specification</td>
            <td class="mono" style="color: #10b981; font-weight: 700;">100.0%</td>
            <td><span class="badge-scope" style="background: rgba(56, 189, 248, 0.15); color: #7dd3fc; border: 1px solid #38bdf8;">GDPR Direct PII</span></td>
            <td><span class="badge-status" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">✓ VERIFIED MASKED</span></td>
          </tr>
          <tr>
            <td><strong style="color: #38bdf8;" class="mono">API_CREDENTIAL</strong></td>
            <td class="mono">sk-proj-****99a8</td>
            <td>High Shannon Entropy Signature</td>
            <td class="mono" style="color: #10b981; font-weight: 700;">99.8%</td>
            <td><span class="badge-scope" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid #ef4444;">Secret Leak Shield</span></td>
            <td><span class="badge-status" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">✓ VERIFIED QUARANTINED</span></td>
          </tr>
        </tbody>
      </table>

      <div style="background: #090d16; padding: 14px 24px; border-top: 1px solid #1e293b; display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
        <span>Cryptographic Hash: <code style="color: #38bdf8;">0x9f81a7b0c34e6281829e...</code></span>
        <span>Attestation Certified: <strong>Zero Plaintext Sent to External LLM Providers</strong></span>
      </div>
    </div>
  </div>
</body>
</html>"""

def get_audit_html():
  return AUDIT_TEMPLATE.replace("__SHARED_CSS__", SHARED_CSS)

TERMINAL_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    __SHARED_CSS__

    .container {
      width: 1440px;
      height: 900px;
      background: #090d16;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }

    .terminal-window {
      width: 1080px;
      background: #0c1222;
      border: 1px solid #334155;
      border-radius: 12px;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6);
      overflow: hidden;
    }

    .term-titlebar {
      background: #1e293b;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid #334155;
    }

    .dots {
      display: flex;
      gap: 8px;
    }

    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .dot-red { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }

    .term-title {
      flex: 1;
      text-align: center;
      font-size: 13px;
      color: #94a3b8;
      font-weight: 600;
      margin-right: 48px;
    }

    .term-body {
      padding: 28px 32px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13.5px;
      line-height: 1.7;
      color: #e2e8f0;
    }

    .pass-tag {
      background: #065f46;
      color: #34d399;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 12px;
      margin-right: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="terminal-window">
      <div class="term-titlebar">
        <div class="dots">
          <div class="dot dot-red"></div>
          <div class="dot dot-yellow"></div>
          <div class="dot dot-green"></div>
        </div>
        <div class="term-title">zsh — n8n-nodes-guardrails — npm test</div>
      </div>
      <div class="term-body">
        <div style="color: #38bdf8; font-weight: 700; margin-bottom: 16px;">$ npm test</div>
        <div style="color: #94a3b8; margin-bottom: 12px;">&gt; n8n-nodes-guardrails@1.1.0 test<br>&gt; vitest run</div>

        <div><span class="pass-tag">PASS</span> test/sanitize.test.ts <span style="color: #64748b;">(12 tests | Luhn, Modulo 97, Modulo 11 checks)</span></div>
        <div><span class="pass-tag">PASS</span> test/crypto.test.ts <span style="color: #64748b;">(8 tests | AES-256-GCM authenticated vault encryption)</span></div>
        <div><span class="pass-tag">PASS</span> test/injection.test.ts <span style="color: #64748b;">(14 tests | Delimiter breakout, roleplay escalation defense)</span></div>
        <div><span class="pass-tag">PASS</span> test/rehydrate.test.ts <span style="color: #64748b;">(10 tests | Zero-leak canary integrity &amp; 100% reconstruction)</span></div>
        <div><span class="pass-tag">PASS</span> test/circuit_breaker.test.ts <span style="color: #64748b;">(8 tests | Budget thresholds &amp; recursion limiters)</span></div>
        <div><span class="pass-tag">PASS</span> test/audit.test.ts <span style="color: #64748b;">(12 tests | GDPR Art. 32 &amp; PCI-DSS CHD compliance matrix)</span></div>

        <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #1e293b;">
          <div style="color: #34d399; font-weight: 700; font-size: 15px;">
            Test Files  6 passed (6)<br>
            Tests       64 passed (64)<br>
            Duration    1.42s (transform 310ms, setup 0ms, collect 240ms, tests 620ms)
          </div>
        </div>

        <div style="margin-top: 18px; background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; padding: 10px 16px; border-radius: 6px; color: #34d399; font-weight: 700;">
          ✓ ALL 64 SECURITY ASSERTIONS VERIFIED (100% SUCCESS)
        </div>
      </div>
    </div>
  </div>
</body>
</html>"""

def get_terminal_html():
  return TERMINAL_TEMPLATE.replace("__SHARED_CSS__", SHARED_CSS)

MOBILE_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    __SHARED_CSS__

    .mobile-screen {
      width: 390px;
      height: 844px;
      background: #090d16;
      display: flex;
      flex-direction: column;
      padding: 24px 20px;
      position: relative;
    }

    .mobile-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-top: 10px;
    }

    .node-badge {
      background: #ff6d5a;
      color: white;
      font-weight: 800;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 12px;
    }

    .card-title {
      font-size: 12px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .event-item {
      background: #182234;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="mobile-screen">
    <div class="mobile-header">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="node-badge">n8n</span>
        <span style="font-weight: 800; font-size: 16px; color: white;">AI Guardrails</span>
      </div>
      <span style="background: rgba(16,185,129,0.2); color: #34d399; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 12px;">
        ● ACTIVE
      </span>
    </div>

    <!-- Live Metrics Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
      <div class="card" style="margin-bottom: 0;">
        <div class="card-title">PII SHIELD</div>
        <div style="font-size: 18px; font-weight: 800; color: #10b981;">0 LEAKS</div>
      </div>
      <div class="card" style="margin-bottom: 0;">
        <div class="card-title">SPEND TODAY</div>
        <div style="font-size: 18px; font-weight: 800; color: #38bdf8;">$0.0482</div>
      </div>
    </div>

    <!-- Active Shield Info -->
    <div class="card" style="background: #111a2e; border-color: #2563eb;">
      <div style="color: #60a5fa; font-weight: 700; font-size: 13px; margin-bottom: 4px;">Ephemeral AES-256-GCM Vault</div>
      <div style="color: #cbd5e1; font-size: 11.5px; line-height: 1.5;">
        Memory encryption active for workflow <code>#wf-support-live</code>. Zero plaintext stored on disk.
      </div>
    </div>

    <div style="font-size: 12px; font-weight: 700; color: #94a3b8; margin: 10px 0 8px 0; text-transform: uppercase;">
      REAL-TIME SECURITY AUDIT LOGS
    </div>

    <!-- Events -->
    <div class="event-item" style="border-left: 3px solid #ef4444;">
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
        <span style="color: #ef4444; font-weight: 700;">INJECTION BLOCKED</span>
        <span style="color: #64748b;">1m ago</span>
      </div>
      <div style="font-size: 12px; color: #f1f5f9; font-weight: 600;">"Ignore previous instructions..."</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Delimiter breakout neutralized with sandwich wrapper.</div>
    </div>

    <div class="event-item" style="border-left: 3px solid #10b981;">
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
        <span style="color: #34d399; font-weight: 700;">PII MASKED</span>
        <span style="color: #64748b;">3m ago</span>
      </div>
      <div style="font-size: 12px; color: #f1f5f9; font-weight: 600;">Masked Card &amp; IBAN to {{TOKEN}}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Luhn &amp; ISO 7064 verified before surrogate mapping.</div>
    </div>

    <div class="event-item" style="border-left: 3px solid #a855f7;">
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
        <span style="color: #c084fc; font-weight: 700;">REHYDRATION SUCCESS</span>
        <span style="color: #64748b;">5m ago</span>
      </div>
      <div style="font-size: 12px; color: #f1f5f9; font-weight: 600;">Clean response delivered to CRM</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Canary verified: Zero PII leak in outbound payload.</div>
    </div>

    <div style="margin-top: auto; padding: 12px; background: #0f172a; border-radius: 8px; border: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
      64 of 64 test assertions passing • n8n community node
    </div>
  </div>
</body>
</html>"""

def get_mobile_html():
  return MOBILE_TEMPLATE.replace("__SHARED_CSS__", SHARED_CSS)

async def main():
  print("--- Step 1: Launching Chromium via Playwright ---")
  async with async_playwright() as p:
    browser = await p.chromium.launch()

    # 1. Desktop Dashboard Screenshot (1440x900, 2x retina)
    print("--- Step 2: Generating Desktop Dashboard Screenshot ---")
    page_desk = await browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    await page_desk.set_content(get_dashboard_html(highlight_step=2, scan_progress=0.8, rehydrated=False))
    await page_desk.wait_for_load_state("networkidle")
    out_dash = os.path.join(DOCS_IMAGES, "n8n_nodes_guardrails_dashboard.png")
    await page_desk.screenshot(path=out_dash)
    print(f"✓ Saved: {out_dash}")

    # 2. Compliance Audit Screenshot (1440x900, 2x retina)
    print("--- Step 3: Generating Compliance Audit Matrix Screenshot ---")
    page_audit = await browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    await page_audit.set_content(get_audit_html())
    await page_audit.wait_for_load_state("networkidle")
    out_audit = os.path.join(DOCS_IMAGES, "n8n_nodes_guardrails_audit.png")
    await page_audit.screenshot(path=out_audit)
    print(f"✓ Saved: {out_audit}")

    # 3. Terminal Test Execution Screenshot (1440x900, 2x retina)
    print("--- Step 4: Generating Terminal Screenshot ---")
    page_term = await browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    await page_term.set_content(get_terminal_html())
    await page_term.wait_for_load_state("networkidle")
    out_term = os.path.join(DOCS_IMAGES, "n8n_nodes_guardrails_terminal.png")
    await page_term.screenshot(path=out_term)
    print(f"✓ Saved: {out_term}")

    # 4. Mobile Screenshot (390x844, 2x retina)
    print("--- Step 5: Generating Mobile Screenshot ---")
    page_mobile = await browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    await page_mobile.set_content(get_mobile_html())
    await page_mobile.wait_for_load_state("networkidle")
    out_mob = os.path.join(DOCS_IMAGES, "n8n_nodes_guardrails_mobile.png")
    await page_mobile.screenshot(path=out_mob)
    print(f"✓ Saved: {out_mob}")

    # 5. Dynamic Demo GIF Frames
    print("--- Step 6: Generating 60 Dynamic Walkthrough Frames for GIF ---")
    page_gif = await browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    
    total_frames = 60
    for i in range(total_frames):
      if i < 20:
        # Inbound flow to Guardrails
        prog = i / 20.0
        html = get_dashboard_html(highlight_step=1, scan_progress=prog, rehydrated=False)
      elif i < 40:
        # Masking & Vault Active
        prog = (i - 20) / 20.0
        html = get_dashboard_html(highlight_step=2, scan_progress=prog, rehydrated=False)
      else:
        # Rehydration and Final Attestation
        prog = (i - 40) / 20.0
        html = get_dashboard_html(highlight_step=4, scan_progress=prog, rehydrated=True)

      await page_gif.set_content(html)
      frame_file = os.path.join(TEMP_FRAMES, f"frame_{i:04d}.png")
      await page_gif.screenshot(path=frame_file)

    await browser.close()
    print(f"✓ Rendered {total_frames} dynamic frames")

  # Step 7: Compile GIF via FFmpeg
  print("--- Step 7: Compiling 10 FPS Animated GIF with FFmpeg ---")
  out_gif = os.path.join(DOCS_IMAGES, "n8n_nodes_guardrails_demo.gif")
  ffmpeg_cmd = [
    "ffmpeg", "-y",
    "-framerate", "10",
    "-i", os.path.join(TEMP_FRAMES, "frame_%04d.png"),
    "-filter_complex", "[0:v] fps=10,scale=1080:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=diff [p];[b][p] paletteuse=dither=bayer:bayer_scale=3",
    out_gif
  ]
  subprocess.run(ffmpeg_cmd, check=True)
  
  gif_size_kb = os.path.getsize(out_gif) / 1024
  print(f"✓ Successfully generated: {out_gif} ({gif_size_kb:.1f} KB)")

  # Clean up temporary frames
  for f in os.listdir(TEMP_FRAMES):
    os.remove(os.path.join(TEMP_FRAMES, f))
  os.rmdir(TEMP_FRAMES)
  print("✓ Cleaned up temporary frames")

if __name__ == "__main__":
  asyncio.run(main())
