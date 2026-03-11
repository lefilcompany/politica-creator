/**
 * Shared Gemini API client that converts OpenAI-compatible parameters
 * to the Gemini REST API format, supporting text, tool calling, and image generation.
 */

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Model mapping from OpenAI-style names to Gemini model IDs
const MODEL_MAP: Record<string, string> = {
  'google/gemini-2.5-pro': 'gemini-2.5-pro',
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.5-flash-lite': 'gemini-2.5-flash',
  'google/gemini-3-flash-preview': 'gemini-2.5-flash',
  'google/gemini-3-pro-image-preview': 'gemini-3-pro-image-preview',
  'google/gemini-2.5-flash-image': 'gemini-2.5-flash-image-preview',
};

function resolveModel(model?: string): string {
  if (!model) return 'gemini-2.5-flash';
  return MODEL_MAP[model] || model.replace('google/', '');
}

interface OpenAIMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface OpenAITool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

interface GeminiCallOptions {
  model?: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  tool_choice?: any;
  temperature?: number;
  maxOutputTokens?: number;
  modalities?: string[];
  response_format?: any;
}

interface GeminiResult {
  content: string | null;
  toolCall: { name: string; args: any } | null;
  images: Array<{ type: string; image_url: { url: string } }>;
  raw: any;
}

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch image URL (${response.status}): ${url.substring(0, 100)}`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const contentType = response.headers.get('content-type') || 'image/png';
    const mimeType = contentType.split(';')[0].trim();
    return { mimeType, data: base64 };
  } catch (err) {
    console.error(`Error fetching image URL: ${url.substring(0, 100)}`, err);
    return null;
  }
}

async function convertMessagesToGemini(messages: OpenAIMessage[]): Promise<{ contents: any[]; systemInstruction?: any }> {
  let systemInstruction: any = undefined;
  const contents: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: typeof msg.content === 'string' ? msg.content : '' }] };
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
            const match = url.match(/^data:([\w/]+);base64,(.+)$/);
            if (match) {
              parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            }
          } else {
            // Fetch external URL and convert to inline base64
            const imageData = await fetchImageAsBase64(url);
            if (imageData) {
              parts.push({ inlineData: imageData });
            } else {
              console.warn(`⚠️ Skipping image URL (fetch failed): ${url.substring(0, 100)}`);
            }
          }
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return { contents, systemInstruction };
}

function convertToolsToGemini(tools?: OpenAITool[]): any[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  const functionDeclarations = tools
    .filter(t => t.type === 'function')
    .map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: cleanParameters(t.function.parameters),
    }));

  return functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined;
}

// Remove 'additionalProperties' which Gemini doesn't support
function cleanParameters(params: any): any {
  if (!params || typeof params !== 'object') return params;
  const cleaned = { ...params };
  delete cleaned.additionalProperties;
  if (cleaned.properties) {
    const newProps: any = {};
    for (const [key, val] of Object.entries(cleaned.properties)) {
      newProps[key] = cleanParameters(val);
    }
    cleaned.properties = newProps;
  }
  if (cleaned.items) {
    cleaned.items = cleanParameters(cleaned.items);
  }
  return cleaned;
}

function getToolConfig(toolChoice: any): any | undefined {
  if (!toolChoice) return undefined;
  if (toolChoice.type === 'function' && toolChoice.function?.name) {
    return {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [toolChoice.function.name],
      },
    };
  }
  return undefined;
}

export async function callGemini(apiKey: string, options: GeminiCallOptions): Promise<GeminiResult> {
  const model = resolveModel(options.model);
  const { contents, systemInstruction } = await convertMessagesToGemini(options.messages);
  const geminiTools = convertToolsToGemini(options.tools);
  const toolConfig = getToolConfig(options.tool_choice);

  const useImageGen = options.modalities?.includes('image');

  const body: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  };

  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (geminiTools) body.tools = geminiTools;
  if (toolConfig) body.toolConfig = toolConfig;

  if (useImageGen) {
    body.generationConfig.responseModalities = ['TEXT', 'IMAGE'];
  }

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Gemini API error (${response.status}):`, errText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let content: string | null = null;
  let toolCall: { name: string; args: any } | null = null;
  const images: Array<{ type: string; image_url: { url: string } }> = [];

  for (const part of parts) {
    if (part.text) {
      content = (content || '') + part.text;
    }
    if (part.functionCall) {
      toolCall = { name: part.functionCall.name, args: part.functionCall.args };
    }
    if (part.inlineData) {
      images.push({
        type: 'image_url',
        image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` },
      });
    }
  }

  return { content, toolCall, images, raw: data };
}

/**
 * Helper to extract structured JSON from text content (strips markdown code blocks)
 */
export function extractJSON(text: string | null): any | null {
  if (!text) return null;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
