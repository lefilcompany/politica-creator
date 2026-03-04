/**
 * Shared Gemini API client for edge functions.
 * Converts OpenAI-style parameters to Gemini's native REST API.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Model mapping from OpenAI-style names to Gemini model IDs
const MODEL_MAP: Record<string, string> = {
  'google/gemini-2.5-pro': 'gemini-2.5-pro',
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.5-flash-lite': 'gemini-2.5-flash-lite-preview-06-17',
  'google/gemini-3-flash-preview': 'gemini-2.5-flash',
  'google/gemini-3-pro-image-preview': 'gemini-2.0-flash-exp',
  'google/gemini-2.5-flash-image': 'gemini-2.0-flash-exp',
};

function resolveModel(model: string): string {
  return MODEL_MAP[model] || model.replace('google/', '');
}

interface GeminiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

interface GeminiToolChoice {
  type: 'function';
  function: { name: string };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface GeminiChatOptions {
  model: string;
  messages: ChatMessage[];
  tools?: GeminiTool[];
  tool_choice?: GeminiToolChoice;
  temperature?: number;
  maxOutputTokens?: number;
  modalities?: string[];
  response_format?: { type: string };
}

interface GeminiResponse {
  ok: boolean;
  status: number;
  content?: string;
  toolCall?: { name: string; args: any };
  images?: Array<{ data: string; mimeType: string }>;
  raw?: any;
}

function getApiKey(): string {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  return key;
}

function convertMessages(messages: ChatMessage[]): { systemInstruction?: any; contents: any[] } {
  let systemInstruction: any = undefined;
  const contents: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }] };
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts: any[] = [];

    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (item.type === 'text' && item.text) {
          parts.push({ text: item.text });
        } else if (item.type === 'image_url' && item.image_url?.url) {
          const url = item.image_url.url;
          if (url.startsWith('data:')) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            }
          } else {
            parts.push({ text: `[Image URL: ${url}]` });
          }
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return { systemInstruction, contents };
}

function convertTools(tools?: GeminiTool[]): any[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  const functionDeclarations = tools
    .filter(t => t.type === 'function')
    .map(t => {
      // Clean parameters - remove additionalProperties which Gemini doesn't support well
      const params = JSON.parse(JSON.stringify(t.function.parameters));
      cleanParams(params);
      return {
        name: t.function.name,
        description: t.function.description,
        parameters: params,
      };
    });

  return [{ functionDeclarations }];
}

function cleanParams(obj: any) {
  if (!obj || typeof obj !== 'object') return;
  delete obj.additionalProperties;
  if (obj.properties) {
    for (const key of Object.keys(obj.properties)) {
      cleanParams(obj.properties[key]);
    }
  }
  if (obj.items) cleanParams(obj.items);
}

function convertToolChoice(toolChoice?: GeminiToolChoice): any {
  if (!toolChoice) return undefined;
  return {
    functionCallingConfig: {
      mode: 'ANY',
      allowedFunctionNames: [toolChoice.function.name],
    },
  };
}

export async function callGemini(options: GeminiChatOptions): Promise<GeminiResponse> {
  const apiKey = getApiKey();
  const modelId = resolveModel(options.model);
  const { systemInstruction, contents } = convertMessages(options.messages);

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  const geminiTools = convertTools(options.tools);
  if (geminiTools) {
    requestBody.tools = geminiTools;
  }

  const toolConfig = convertToolChoice(options.tool_choice);
  if (toolConfig) {
    requestBody.toolConfig = toolConfig;
  }

  if (options.modalities?.includes('image')) {
    requestBody.generationConfig.responseModalities = ['TEXT', 'IMAGE'];
  }

  if (options.response_format?.type === 'json_object') {
    requestBody.generationConfig.responseMimeType = 'application/json';
  }

  const url = `${GEMINI_BASE}/${modelId}:generateContent?key=${apiKey}`;
  
  console.log(`🔄 Calling Gemini API (model: ${modelId})...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`❌ Gemini API error (${response.status}):`, errText);
    return { ok: false, status: response.status, raw: errText };
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  
  if (!candidate?.content?.parts) {
    return { ok: true, status: 200, content: '', raw: data };
  }

  const parts = candidate.content.parts;
  let textContent = '';
  const images: Array<{ data: string; mimeType: string }> = [];
  let toolCall: { name: string; args: any } | undefined;

  for (const part of parts) {
    if (part.text) {
      textContent += part.text;
    }
    if (part.functionCall) {
      toolCall = { name: part.functionCall.name, args: part.functionCall.args };
    }
    if (part.inlineData) {
      images.push({ data: part.inlineData.data, mimeType: part.inlineData.mimeType });
    }
  }

  return { ok: true, status: 200, content: textContent, toolCall, images, raw: data };
}

/**
 * Helper to convert a GeminiResponse to the OpenAI-compatible format
 * that existing edge function code expects.
 */
export function toOpenAIFormat(result: GeminiResponse): any {
  if (!result.ok) {
    return { error: true, status: result.status };
  }

  const message: any = { role: 'assistant', content: result.content || '' };

  if (result.toolCall) {
    message.tool_calls = [{
      function: {
        name: result.toolCall.name,
        arguments: JSON.stringify(result.toolCall.args),
      },
    }];
  }

  if (result.images && result.images.length > 0) {
    message.images = result.images.map(img => ({
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    }));
  }

  return {
    choices: [{ message }],
  };
}
