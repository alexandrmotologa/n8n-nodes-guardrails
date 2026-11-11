import {
  INodeType,
  INodeTypeDescription,
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
  IDataObject,
} from 'n8n-workflow';
import { sanitize, MaskingStrategy, SanitizeOptions } from './operations/sanitize';
import { rehydrate, RehydrateOptions } from './operations/rehydrate';
import { checkInjection, InjectionSensitivity } from './operations/injection_check';
import { evaluateCircuitBreaker, CircuitBreakerOptions } from './operations/circuit_breaker';
import { CustomPattern } from './utils/pii_patterns';

export class Guardrails implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'AI Guardrails',
    name: 'guardrails',
    icon: 'file:Guardrails.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Zero-leak PII masking, prompt injection defense, and budget circuit breaking for AI workflows',
    defaults: {
      name: 'AI Guardrails',
    },
    inputs: ['main'],
    outputs: ['main', 'main'],
    outputNames: ['Safe Output', 'Blocked / Alert'],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Mask PII & Check Safety', value: 'sanitize' },
          { name: 'Rehydrate PII', value: 'rehydrate' },
          { name: 'Scan Prompt Injection', value: 'injection_check' },
          { name: 'Enforce Cost & Loop Limit', value: 'circuit_breaker' },
        ],
        default: 'sanitize',
        description: 'The security action to perform on inbound or outbound AI payloads',
      },

      // -----------------------------------------------------------
      // OPERATION: sanitize
      // -----------------------------------------------------------
      {
        displayName: 'Input Source',
        name: 'inputSource',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['sanitize', 'injection_check'],
          },
        },
        options: [
          { name: 'Text String', value: 'text' },
          { name: 'JSON Object / Array', value: 'json' },
        ],
        default: 'text',
        description: 'Whether to sanitize a single text string or deep-scan a JSON structure',
      },
      {
        displayName: 'Input Text',
        name: 'inputText',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['sanitize', 'injection_check'],
            inputSource: ['text'],
          },
        },
        placeholder: 'e.g. Please wire funds to John Doe at DE89370400440532013000',
        description: 'The raw text to scan and sanitize before passing to an LLM',
      },
      {
        displayName: 'Input JSON',
        name: 'inputJson',
        type: 'json',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['sanitize', 'injection_check'],
            inputSource: ['json'],
          },
        },
        description: 'The JSON structure whose string values will be recursively masked and scanned',
      },
      {
        displayName: 'Masking Strategy',
        name: 'strategy',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['sanitize'],
          },
        },
        options: [
          {
            name: 'Synthetic Tokens (Reversible, e.g. {{EMAIL_1}})',
            value: 'tokens',
            description: 'Reversible placeholders restored later with the Rehydrate operation',
          },
          {
            name: 'Redaction (e.g. [REDACTED_EMAIL])',
            value: 'redaction',
            description: 'Permanently replace sensitive values with entity badges',
          },
          {
            name: 'Partial Mask (e.g. j***n@domain.com)',
            value: 'partial',
            description: 'Preserve partial context for human-in-the-loop review',
          },
          {
            name: 'Salted SHA-256 Hash',
            value: 'hash',
            description: 'Consistent pseudo-anonymized hashes suitable for analytics',
          },
        ],
        default: 'tokens',
        description: 'How detected sensitive entities should be transformed',
      },
      {
        displayName: 'Check Prompt Injection',
        name: 'checkInjection',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            operation: ['sanitize'],
          },
        },
        description: 'Whether to scan for prompt injection attacks while masking PII',
      },
      {
        displayName: 'Injection Sensitivity',
        name: 'sensitivity',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['sanitize', 'injection_check'],
          },
        },
        options: [
          { name: 'Low (High Confidence Attacks Only)', value: 'low' },
          { name: 'Medium (Balanced Protection)', value: 'medium' },
          { name: 'High (Strict Zero Trust)', value: 'high' },
        ],
        default: 'medium',
        description: 'Sensitivity threshold for adversarial signature matching',
      },
      {
        displayName: 'Action on Injection Detected',
        name: 'actionOnInjection',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['sanitize', 'injection_check'],
          },
        },
        options: [
          {
            name: 'Route to Blocked / Alert Output',
            value: 'routeToAlert',
            description: 'Safely redirect execution to output connector 1 without halting workflow',
          },
          {
            name: 'Halt Workflow with Error',
            value: 'throwError',
            description: 'Throw a controlled error halting the workflow immediately',
          },
        ],
        default: 'routeToAlert',
        description: 'How to handle detected prompt injection attempts',
      },
      {
        displayName: 'Vault Secret (Optional)',
        name: 'vaultSecret',
        type: 'string',
        typeOptions: {
          password: true,
        },
        default: '',
        displayOptions: {
          show: {
            operation: ['sanitize', 'rehydrate'],
          },
        },
        description: 'Custom passphrase for AES-256-GCM vault encryption. If empty, a built-in ephemeral key is used.',
      },
      {
        displayName: 'Detect Credit Cards',
        name: 'detectCreditCards',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            operation: ['sanitize'],
          },
        },
        description: 'Whether to detect and validate credit card numbers using the Luhn algorithm',
      },
      {
        displayName: 'Detect IBANs',
        name: 'detectIban',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            operation: ['sanitize'],
          },
        },
        description: 'Whether to detect international bank account numbers using Modulo 97 verification',
      },
      {
        displayName: 'Detect Emails',
        name: 'detectEmail',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            operation: ['sanitize'],
          },
        },
        description: 'Whether to detect email addresses',
      },
      {
        displayName: 'Detect Phone Numbers',
        name: 'detectPhone',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            operation: ['sanitize'],
          },
        },
        description: 'Whether to detect international and local phone numbers',
      },
      {
        displayName: 'Detect National IDs (SSN / CNP)',
        name: 'detectNationalId',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            operation: ['sanitize'],
          },
        },
        description: 'Whether to detect US Social Security numbers and Romanian CNP identifiers with checksum validation',
      },
      {
        displayName: 'Detect IP Addresses',
        name: 'detectIpAddress',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            operation: ['sanitize'],
          },
        },
        description: 'Whether to detect IPv4 and IPv6 network addresses',
      },
      {
        displayName: 'Detect API Keys & Secrets',
        name: 'detectSecrets',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            operation: ['sanitize'],
          },
        },
        description: 'Whether to detect OpenAI keys, AWS access keys, GitHub tokens, and private keys',
      },
      {
        displayName: 'Custom Patterns',
        name: 'customPatterns',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        placeholder: 'Add Custom Regex Pattern',
        default: {},
        displayOptions: {
          show: {
            operation: ['sanitize'],
          },
        },
        options: [
          {
            name: 'patterns',
            displayName: 'Patterns',
            values: [
              {
                displayName: 'Label',
                name: 'name',
                type: 'string',
                default: 'CUSTOM_ID',
                description: 'Label used in synthetic tokens (e.g. {{CUSTOM_ID_1}})',
              },
              {
                displayName: 'Regular Expression',
                name: 'regex',
                type: 'string',
                default: '',
                description: 'Regular expression to match and mask',
              },
            ],
          },
        ],
      },

      // -----------------------------------------------------------
      // OPERATION: rehydrate
      // -----------------------------------------------------------
      {
        displayName: 'Input Source',
        name: 'rehydrateInputSource',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['rehydrate'],
          },
        },
        options: [
          { name: 'Text String', value: 'text' },
          { name: 'JSON Object / Array', value: 'json' },
        ],
        default: 'text',
        description: 'Whether to restore tokens in a text string or structured JSON response',
      },
      {
        displayName: 'Masked Text',
        name: 'maskedText',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['rehydrate'],
            rehydrateInputSource: ['text'],
          },
        },
        description: 'The LLM response text containing synthetic tokens like {{EMAIL_1}}',
      },
      {
        displayName: 'Masked JSON',
        name: 'maskedJson',
        type: 'json',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['rehydrate'],
            rehydrateInputSource: ['json'],
          },
        },
        description: 'The JSON structure containing synthetic tokens to restore',
      },
      {
        displayName: 'PII Vault Token',
        name: 'piiVault',
        type: 'string',
        default: '={{ $json.piiVault }}',
        required: true,
        displayOptions: {
          show: {
            operation: ['rehydrate'],
          },
        },
        description: 'The encrypted vault string generated during the sanitize step',
      },

      // -----------------------------------------------------------
      // OPERATION: circuit_breaker
      // -----------------------------------------------------------
      {
        displayName: 'Model',
        name: 'model',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['circuit_breaker'],
          },
        },
        options: [
          { name: 'OpenAI - GPT-4o', value: 'gpt-4o' },
          { name: 'OpenAI - GPT-4o Mini', value: 'gpt-4o-mini' },
          { name: 'OpenAI - GPT-4 Turbo', value: 'gpt-4-turbo' },
          { name: 'OpenAI - o1', value: 'o1' },
          { name: 'OpenAI - o1-mini', value: 'o1-mini' },
          { name: 'Anthropic - Claude 3.5 Sonnet', value: 'claude-3-5-sonnet' },
          { name: 'Anthropic - Claude 3.5 Haiku', value: 'claude-3-5-haiku' },
          { name: 'Anthropic - Claude 3 Opus', value: 'claude-3-opus' },
          { name: 'Google - Gemini 1.5 Pro', value: 'gemini-1-5-pro' },
          { name: 'Google - Gemini 1.5 Flash', value: 'gemini-1-5-flash' },
          { name: 'Google - Gemini 2.0 Flash', value: 'gemini-2-0-flash' },
          { name: 'Custom Pricing', value: 'custom' },
        ],
        default: 'gpt-4o',
        description: 'Target model for calculating USD token expenditure',
      },
      {
        displayName: 'Custom Input Rate ($ / 1M Tokens)',
        name: 'customInputRate',
        type: 'number',
        default: 2.5,
        displayOptions: {
          show: {
            operation: ['circuit_breaker'],
            model: ['custom'],
          },
        },
        description: 'Cost per 1 Million input / prompt tokens in USD',
      },
      {
        displayName: 'Custom Output Rate ($ / 1M Tokens)',
        name: 'customOutputRate',
        type: 'number',
        default: 10.0,
        displayOptions: {
          show: {
            operation: ['circuit_breaker'],
            model: ['custom'],
          },
        },
        description: 'Cost per 1 Million output / completion tokens in USD',
      },
      {
        displayName: 'Prompt Tokens',
        name: 'promptTokens',
        type: 'number',
        default: 0,
        displayOptions: {
          show: {
            operation: ['circuit_breaker'],
          },
        },
        description: 'Cumulative prompt tokens consumed in this workflow execution',
      },
      {
        displayName: 'Completion Tokens',
        name: 'completionTokens',
        type: 'number',
        default: 0,
        displayOptions: {
          show: {
            operation: ['circuit_breaker'],
          },
        },
        description: 'Cumulative generated tokens consumed in this workflow execution',
      },
      {
        displayName: 'Current Iteration Count',
        name: 'iterationCount',
        type: 'number',
        default: 1,
        displayOptions: {
          show: {
            operation: ['circuit_breaker'],
          },
        },
        description: 'Current loop iteration index within an autonomous agent cycle',
      },
      {
        displayName: 'Max Cost Limit ($ USD)',
        name: 'maxCostUsd',
        type: 'number',
        default: 0.25,
        displayOptions: {
          show: {
            operation: ['circuit_breaker'],
          },
        },
        description: 'Dollar budget limit per execution (e.g. 0.25). Set to 0 to disable.',
      },
      {
        displayName: 'Max Iteration Depth',
        name: 'maxIterations',
        type: 'number',
        default: 10,
        displayOptions: {
          show: {
            operation: ['circuit_breaker'],
          },
        },
        description: 'Maximum permitted loop iterations before halting runaway loops. Set to 0 to disable.',
      },
      {
        displayName: 'Action on Limit Breach',
        name: 'actionOnBreach',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['circuit_breaker'],
          },
        },
        options: [
          {
            name: 'Route to Blocked / Alert Output',
            value: 'routeToAlert',
            description: 'Route item to output connector 1 for alert logging without throwing error',
          },
          {
            name: 'Halt Workflow with Error',
            value: 'throwError',
            description: 'Throw a controlled error halting the workflow execution immediately',
          },
        ],
        default: 'routeToAlert',
        description: 'How to handle budget or loop depth breaches',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const alertData: INodeExecutionData[] = [];

    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        if (operation === 'sanitize') {
          const inputSource = this.getNodeParameter('inputSource', i, 'text') as string;
          let rawInput: string | Record<string, unknown> | unknown[];

          if (inputSource === 'text') {
            rawInput = this.getNodeParameter('inputText', i, '') as string;
          } else {
            const jsonParam = this.getNodeParameter('inputJson', i, {}) as unknown;
            if (typeof jsonParam === 'string') {
              try {
                rawInput = JSON.parse(jsonParam);
              } catch {
                rawInput = jsonParam;
              }
            } else {
              rawInput = jsonParam as Record<string, unknown>;
            }
          }

          // 1. Check prompt injection if enabled
          const checkInj = this.getNodeParameter('checkInjection', i, true) as boolean;
          if (checkInj) {
            const sensitivity = this.getNodeParameter('sensitivity', i, 'medium') as InjectionSensitivity;
            const actionOnInjection = this.getNodeParameter('actionOnInjection', i, 'routeToAlert') as string;
            const injectionResult = checkInjection(rawInput, { sensitivity });

            if (injectionResult.isUnsafe) {
              if (actionOnInjection === 'throwError') {
                throw new NodeOperationError(
                  this.getNode(),
                  `Prompt injection attack detected: ${injectionResult.reason}`,
                  { itemIndex: i },
                );
              }

              alertData.push({
                json: {
                  status: 'BLOCKED',
                  category: injectionResult.category,
                  riskScore: injectionResult.riskScore,
                  reason: injectionResult.reason,
                  matchedRules: injectionResult.matchedRules,
                  rawInput,
                },
                pairedItem: { item: i },
              });
              continue;
            }
          }

          // 2. Perform PII sanitization
          const strategy = this.getNodeParameter('strategy', i, 'tokens') as MaskingStrategy;
          const vaultSecret = this.getNodeParameter('vaultSecret', i, '') as string;
          const detectCreditCards = this.getNodeParameter('detectCreditCards', i, true) as boolean;
          const detectIban = this.getNodeParameter('detectIban', i, true) as boolean;
          const detectEmail = this.getNodeParameter('detectEmail', i, true) as boolean;
          const detectPhone = this.getNodeParameter('detectPhone', i, true) as boolean;
          const detectNationalId = this.getNodeParameter('detectNationalId', i, true) as boolean;
          const detectIpAddress = this.getNodeParameter('detectIpAddress', i, true) as boolean;
          const detectSecrets = this.getNodeParameter('detectSecrets', i, true) as boolean;

          const customPatternsRaw = this.getNodeParameter('customPatterns', i, {}) as {
            patterns?: Array<{ name: string; regex: string }>;
          };
          const customPatterns: CustomPattern[] = customPatternsRaw.patterns || [];

          const sanitizeOpts: SanitizeOptions = {
            strategy,
            vaultSecret: vaultSecret || undefined,
            detectCreditCards,
            detectIban,
            detectEmail,
            detectPhone,
            detectNationalId,
            detectIpAddress,
            detectSecrets,
            customPatterns,
          };

          const sanitizeResult = sanitize(rawInput, sanitizeOpts);

          const outputJson: IDataObject = {
            piiVault: sanitizeResult.piiVault,
            detectedPiiCount: sanitizeResult.detectedPiiCount,
            entities: sanitizeResult.entities as unknown as IDataObject[],
          };

          if (sanitizeResult.sanitizedText !== undefined) {
            outputJson.sanitizedText = sanitizeResult.sanitizedText;
          }
          if (sanitizeResult.sanitizedJson !== undefined) {
            outputJson.sanitizedJson = sanitizeResult.sanitizedJson as IDataObject;
          }

          returnData.push({
            json: outputJson,
            pairedItem: { item: i },
          });
        } else if (operation === 'rehydrate') {
          const inputSource = this.getNodeParameter('rehydrateInputSource', i, 'text') as string;
          const piiVault = this.getNodeParameter('piiVault', i) as string;
          const vaultSecret = this.getNodeParameter('vaultSecret', i, '') as string;

          let targetInput: string | Record<string, unknown> | unknown[];
          if (inputSource === 'text') {
            targetInput = this.getNodeParameter('maskedText', i, '') as string;
          } else {
            const jsonParam = this.getNodeParameter('maskedJson', i, {}) as unknown;
            if (typeof jsonParam === 'string') {
              try {
                targetInput = JSON.parse(jsonParam);
              } catch {
                targetInput = jsonParam;
              }
            } else {
              targetInput = jsonParam as Record<string, unknown>;
            }
          }

          const rehydrateOpts: RehydrateOptions = {
            vaultSecret: vaultSecret || undefined,
          };

          const result = rehydrate(targetInput, piiVault, rehydrateOpts);

          const outputJson: IDataObject = {
            restoredCount: result.restoredCount,
          };
          if (result.restoredText !== undefined) {
            outputJson.restoredText = result.restoredText;
          }
          if (result.restoredJson !== undefined) {
            outputJson.restoredJson = result.restoredJson as IDataObject;
          }

          returnData.push({
            json: outputJson,
            pairedItem: { item: i },
          });
        } else if (operation === 'injection_check') {
          const inputSource = this.getNodeParameter('inputSource', i, 'text') as string;
          let rawInput: string | Record<string, unknown> | unknown[];

          if (inputSource === 'text') {
            rawInput = this.getNodeParameter('inputText', i, '') as string;
          } else {
            const jsonParam = this.getNodeParameter('inputJson', i, {}) as unknown;
            if (typeof jsonParam === 'string') {
              try {
                rawInput = JSON.parse(jsonParam);
              } catch {
                rawInput = jsonParam;
              }
            } else {
              rawInput = jsonParam as Record<string, unknown>;
            }
          }

          const sensitivity = this.getNodeParameter('sensitivity', i, 'medium') as InjectionSensitivity;
          const actionOnMatch = this.getNodeParameter('actionOnMatch', i, 'routeToAlert') as string;
          const result = checkInjection(rawInput, { sensitivity });

          if (result.isUnsafe) {
            if (actionOnMatch === 'throwError') {
              throw new NodeOperationError(
                this.getNode(),
                `Prompt injection attack detected: ${result.reason}`,
                { itemIndex: i },
              );
            }

            alertData.push({
              json: {
                status: 'BLOCKED',
                category: result.category,
                riskScore: result.riskScore,
                reason: result.reason,
                matchedRules: result.matchedRules,
                rawInput,
              },
              pairedItem: { item: i },
            });
          } else {
            returnData.push({
              json: {
                status: 'SAFE',
                riskScore: result.riskScore,
                input: rawInput,
              },
              pairedItem: { item: i },
            });
          }
        } else if (operation === 'circuit_breaker') {
          const model = this.getNodeParameter('model', i, 'gpt-4o') as string;
          const promptTokens = this.getNodeParameter('promptTokens', i, 0) as number;
          const completionTokens = this.getNodeParameter('completionTokens', i, 0) as number;
          const iterationCount = this.getNodeParameter('iterationCount', i, 1) as number;
          const maxCostUsd = this.getNodeParameter('maxCostUsd', i, 0.25) as number;
          const maxIterations = this.getNodeParameter('maxIterations', i, 10) as number;
          const customInputRate = this.getNodeParameter('customInputRate', i, 2.5) as number;
          const customOutputRate = this.getNodeParameter('customOutputRate', i, 10.0) as number;
          const actionOnBreach = this.getNodeParameter('actionOnBreach', i, 'routeToAlert') as string;

          const breakerOpts: CircuitBreakerOptions = {
            model,
            promptTokens,
            completionTokens,
            iterationCount,
            maxCostUsd,
            maxIterations,
            customInputRate,
            customOutputRate,
          };

          const result = evaluateCircuitBreaker(breakerOpts);

          if (result.isBreached) {
            if (actionOnBreach === 'throwError') {
              throw new NodeOperationError(
                this.getNode(),
                `Circuit breaker tripped: ${result.breachedReasons.join('; ')}`,
                { itemIndex: i },
              );
            }

            alertData.push({
              json: {
                status: result.status,
                isBreached: result.isBreached,
                estimatedCostUsd: result.estimatedCostUsd,
                currentIteration: result.currentIteration,
                totalTokens: result.totalTokens,
                breachedReasons: result.breachedReasons,
                limits: result.limits,
              },
              pairedItem: { item: i },
            });
          } else {
            returnData.push({
              json: {
                status: result.status,
                isBreached: result.isBreached,
                estimatedCostUsd: result.estimatedCostUsd,
                currentIteration: result.currentIteration,
                totalTokens: result.totalTokens,
                limits: result.limits,
              },
              pairedItem: { item: i },
            });
          }
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: (error as Error).message,
            },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData, alertData];
  }
}
