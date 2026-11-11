import { describe, it, expect } from 'vitest';
import { Guardrails } from '../nodes/Guardrails/Guardrails.node';
import { IExecuteFunctions, INodeExecutionData, INode } from 'n8n-workflow';

function createMockExecuteFunctions(
  items: INodeExecutionData[],
  params: Record<string, unknown>,
): IExecuteFunctions {
  const mockNode: INode = {
    id: '1',
    name: 'AI Guardrails',
    type: 'guardrails',
    typeVersion: 1,
    position: [0, 0],
    parameters: params,
  };

  return {
    getInputData: () => items,
    getNodeParameter: (paramName: string, itemIndex: number, defaultValue?: unknown) => {
      if (params[paramName] !== undefined) {
        return params[paramName];
      }
      return defaultValue;
    },
    getNode: () => mockNode,
    continueOnFail: () => false,
  } as unknown as IExecuteFunctions;
}

describe('Guardrails n8n Node Extended Operations', () => {
  const node = new Guardrails();

  it('executes audit operation producing compliance report without mutating payload', async () => {
    const rawText = 'Customer email alice@corp.com and card 4532 0151 1283 0366';
    const mockCtx = createMockExecuteFunctions([{ json: {} }], {
      operation: 'audit',
      inputSource: 'text',
      inputText: rawText,
      allowlist: '',
      detectCreditCards: true,
      detectIban: true,
      detectEmail: true,
      detectPhone: true,
      detectNationalId: true,
      detectIpAddress: true,
      detectSecrets: true,
      customPatterns: {},
    });

    const [returnData, alertData] = await node.execute.call(mockCtx);
    expect(alertData.length).toBe(0);
    expect(returnData.length).toBe(1);

    const report = returnData[0].json;
    expect(report.totalEntities).toBe(2);
    expect(report.pciDssImpact).toBe(true);
    expect(report.gdprRiskLevel).toBe('HIGH');
    expect(report.rawInput).toBe(rawText);
  });

  it('executes wrap_prompt operation applying defensive XML boundaries', async () => {
    const prompt = 'Tell me a story about space exploration';
    const mockCtx = createMockExecuteFunctions([{ json: {} }], {
      operation: 'wrap_prompt',
      wrapPromptText: prompt,
      framingStyle: 'xml_boundary',
      customTagName: 'user_data_untrusted',
      enforceSandwichDefense: true,
    });

    const [returnData, alertData] = await node.execute.call(mockCtx);
    expect(alertData.length).toBe(0);
    expect(returnData.length).toBe(1);

    const result = returnData[0].json;
    expect(result.wrappedPrompt).toContain('<user_data_untrusted>');
    expect(result.wrappedPrompt).toContain(prompt);
    expect(result.wrappedPrompt).toContain('Important Security Instruction:');
    expect(result.framingStyle).toBe('xml_boundary');
  });

  it('routes to alert connector when a canary leak is detected during rehydration', async () => {
    // 1. Sanitize with canary injection
    const sanitizeCtx = createMockExecuteFunctions([{ json: {} }], {
      operation: 'sanitize',
      inputSource: 'text',
      inputText: 'Private database query',
      strategy: 'tokens',
      checkInjection: false,
      injectCanary: true,
      detectEmail: false,
    });

    const [sanitized] = await node.execute.call(sanitizeCtx);
    const vault = sanitized[0].json.piiVault as string;
    const canary = sanitized[0].json.canaryToken as string;

    // 2. Rehydrate with response containing the leaked canary
    const rehydrateCtx = createMockExecuteFunctions([{ json: {} }], {
      operation: 'rehydrate',
      rehydrateInputSource: 'text',
      maskedText: `Compromised LLM response leaking secret: ${canary}`,
      piiVault: vault,
    });

    const [returnData, alertData] = await node.execute.call(rehydrateCtx);
    expect(returnData.length).toBe(1);
    expect(returnData[0].json.canaryLeaked).toBe(true);

    // Alert branch should catch the data leak alert
    expect(alertData.length).toBe(1);
    expect(alertData[0].json.status).toBe('DATA_LEAK_ALERT');
    expect(alertData[0].json.canaryLeaked).toBe(true);
  });
});
