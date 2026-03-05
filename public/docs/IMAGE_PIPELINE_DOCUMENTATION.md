# Pipeline Completo de Geração e Revisão de Imagens — Documentação Técnica

## Visão Geral da Arquitetura

O sistema possui **4 Edge Functions** principais:

| Função | Descrição | Modelo IA | Custo (créditos) |
|---|---|---|---|
| `generate-image` | Geração de imagem política | Gemini 3 Pro Image Preview | 6 |
| `edit-image` | Edição/correção de imagem existente | Gemini 2.5 Flash Image | 1 |
| `review-image` | Revisão analítica de imagem | GPT-4o-mini (OpenAI) | 2 |
| `review-text-for-image` | Revisão de texto/copy para imagem | GPT-4o-mini (OpenAI) | 2 |

---

## 1. GERAÇÃO DE IMAGEM (`generate-image`)

### Pipeline de 3 Etapas

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  STEP 1: LLM Refiner│────▶│ STEP 2: Master Prompt│────▶│ STEP 3: Image Gen   │
│  (Gemini Flash)      │     │ (Build Director)     │     │ (Gemini 3 Pro Image)│
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

### 1.1 Dados de Entrada (Frontend → Backend)

O frontend consolida os campos do formulário via `buildImagePromptString()`:

```typescript
interface PromptFormFields {
  // Seleções de entidade (IDs para busca no banco)
  brandId: string;
  brandName: string;
  themeId: string;
  themeName: string;
  personaId: string;
  personaName: string;

  // Campos do formulário
  objective: string;        // Ex: "Aumentar engajamento", "Gerar leads"
  description: string;      // Descrição visual bruta do usuário
  platform: string;         // feed, stories, reels, linkedin, twitter, etc.
  contentType: 'organic' | 'ads';
  tones: string[];          // Tons de voz selecionados
  additionalInfo: string;   // Informações extras do usuário

  // Estilos visuais
  vibeStyle: string;        // minimalist, pop_neon, cinematic, etc.
  fontStyle: string;        // elegant, modern, fun, impactful
  politicalTone: string;    // combativo, didatico, emocional, institucional

  // Texto na imagem
  includeText: boolean;
  textContent: string;      // Texto a renderizar na imagem
  textPosition: string;     // top, center, bottom, top-left, etc.

  // Avançado (opcionais)
  negativePrompt?: string;
  colorPalette?: string;
  lighting?: string;
  composition?: string;
  cameraAngle?: string;
  detailLevel?: number;     // 1-10
  mood?: string;

  // Contadores de imagem
  brandImagesCount: number;
  userImagesCount: number;
}
```

O `promptContext` é gerado como Markdown estruturado com seções:

```typescript
function buildImagePromptString(fields: PromptFormFields): string {
  const sections: string[] = [];

  // === SEÇÃO 1: IDENTIDADE (peso: alto) ===
  // Marca | Pauta | Persona
  if (identityParts.length > 0) {
    sections.push(`### IDENTIDADE\n${identityParts.join(' | ')}`);
  }

  // === SEÇÃO 2: OBJETIVO E CONTEXTO (peso: alto) ===
  // Objetivo | Plataforma | Tipo (Orgânico/Ads) | Tom de voz
  if (contextParts.length > 0) {
    sections.push(`### OBJETIVO E CONTEXTO\n${contextParts.join('\n')}`);
  }

  // === SEÇÃO 3: DESCRIÇÃO VISUAL (peso: crítico) ===
  if (fields.description) {
    sections.push(`### DESCRIÇÃO VISUAL\n${fields.description}`);
  }

  // === SEÇÃO 4: ESTILO VISUAL (peso: alto) ===
  // Vibe + Tom político com instruções visuais
  if (styleParts.length > 0) {
    sections.push(`### ESTILO VISUAL\n${styleParts.join('\n')}`);
  }

  // === SEÇÃO 5: TIPOGRAFIA (peso: médio, condicional) ===
  // Texto, posição e estilo de fonte (apenas se includeText=true)
  if (fields.includeText && fields.textContent) {
    sections.push(`### TEXTO NA IMAGEM\n${typoParts.join('\n')}`);
  }

  // === SEÇÃO 6: PARÂMETROS AVANÇADOS (peso: baixo) ===
  // negativePrompt, colorPalette, lighting, composition, etc.
  if (advancedParts.length > 0) {
    sections.push(`### PARÂMETROS AVANÇADOS\n${advancedParts.join('\n')}`);
  }

  // === SEÇÃO 7: INFO ADICIONAL (peso: baixo) ===
  if (fields.additionalInfo) {
    sections.push(`### INFORMAÇÕES ADICIONAIS\n${fields.additionalInfo}`);
  }

  // === SEÇÃO 8: REFERÊNCIAS VISUAIS (peso: contexto) ===
  if (fields.brandImagesCount > 0 || fields.userImagesCount > 0) {
    sections.push(`### REFERÊNCIAS VISUAIS\n...`);
  }

  return sections.join('\n\n');
}
```

O payload final enviado ao backend:

```typescript
function buildRequestPayload(fields: PromptFormFields, extras: {
  preserveImages: string[];       // URLs base64 de imagens da marca
  styleReferenceImages: string[]; // URLs base64 de imagens do usuário
  teamId: string;
  width?: string;
  height?: string;
}) {
  const promptContext = buildImagePromptString(fields);

  return {
    // IDs para busca completa no banco
    brandId: fields.brandId,
    themeId: fields.themeId,
    personaId: fields.personaId,

    // Nomes (fallback/display)
    brand: fields.brandName,
    theme: fields.themeName,
    persona: fields.personaName,

    // Prompt consolidado em Markdown
    promptContext,

    // Campos individuais
    objective: fields.objective,
    description: fields.description,
    tone: fields.tones,
    platform: fields.platform,
    contentType: fields.contentType,
    visualStyle: fields.vibeStyle,
    vibeStyle: fields.vibeStyle,
    fontStyle: fields.fontStyle,
    politicalTone: fields.politicalTone,
    additionalInfo: fields.additionalInfo,
    includeText: fields.includeText,
    textContent: fields.textContent,
    textPosition: fields.textPosition,
    negativePrompt: fields.negativePrompt,
    colorPalette: fields.colorPalette,
    lighting: fields.lighting,
    composition: fields.composition,
    cameraAngle: fields.cameraAngle,
    detailLevel: fields.detailLevel,
    mood: fields.mood,

    // Imagens de referência
    preserveImages: extras.preserveImages,
    styleReferenceImages: extras.styleReferenceImages,
    brandImagesCount: extras.preserveImages.length,
    userImagesCount: extras.styleReferenceImages.length,

    // Dimensões e equipe
    width: extras.width,
    height: extras.height,
    teamId: extras.teamId,
  };
}
```

---

### 1.2 Backend — Busca de Dados Completos no Banco

O backend **nunca confia nos nomes do frontend**. Busca dados completos via IDs:

```typescript
// Busca paralela de marca, pauta, persona e perfil político
const [brandData, themeData, personaData] = await Promise.all([
  formData.brandId ? fetchBrandData(supabase, formData.brandId) : null,
  formData.themeId ? fetchThemeData(supabase, formData.themeId) : null,
  formData.personaId ? fetchPersonaData(supabase, formData.personaId) : null,
]);

// Perfil político já buscado na autenticação
const politicalProfile = await fetchPoliticalProfile(supabase, userId);
```

**Dados da Marca (brands):**

```sql
SELECT name, segment, values, keywords, color_palette, brand_color,
       goals, promise, restrictions, logo, moodboard, reference_image
FROM brands WHERE id = $brandId
```

**Dados da Pauta Estratégica (strategic_themes):**

```sql
SELECT title, description, tone_of_voice, platforms, target_audience,
       objectives, macro_themes, objective_type, color_palette, hashtags,
       expected_action, best_formats
FROM strategic_themes WHERE id = $themeId
```

**Dados da Persona (personas):**

```sql
SELECT name, age, gender, location, professional_context,
       preferred_tone_of_voice, challenges, main_goal,
       beliefs_and_interests, interest_triggers, purchase_journey_stage
FROM personas WHERE id = $personaId
```

**Perfil Político (profiles):**

```sql
SELECT political_role, political_party, political_experience,
       political_level, focus_areas, main_social_networks,
       target_audience_description, mandate_stage, biography,
       tone_of_voice, red_lines, evidence_history
FROM profiles WHERE id = $userId
```

---

### 1.3 STEP 1 — LLM Refiner (Gemini Flash)

Transforma a descrição visual bruta do usuário num briefing visual cinematográfico completo.

**Modelo:** `google/gemini-3-flash-preview`
**Endpoint:** `https://ai.gateway.lovable.dev/v1/chat/completions`

#### Mapeamento de Tom Político → Parâmetros Visuais

```typescript
const TONE_VISUAL_MAP: Record<string, {
  contrast: string;
  lighting: string;
  style: string;
  composition: string;
  focus: string;
  description: string;
  fontHint: string;
  colorHint: string;
}> = {
  combativo: {
    contrast: "Alto — contrastes fortes, sombras intensas",
    lighting: "Dramática, low-key, sombras fortes, contra-luz",
    style: "Bold, impactante, alto contraste, cores intensas",
    composition: "Dinâmica, assimétrica, composição de tensão e urgência",
    focus: "Poder, urgência, força, determinação",
    description: "Gera urgência e força. Cores intensas, tipografia impactante, contrastes fortes.",
    fontHint: "Sans-serif robusta, condensada e impactante",
    colorHint: "Vermelho intenso, preto, branco alto contraste",
  },
  didatico: {
    contrast: "Médio — contraste equilibrado e legível",
    lighting: "Uniforme, limpa, studio brilhante e neutro",
    style: "Clean/Grid, elementos infográficos, dados visuais",
    composition: "Organizada, grid-based, hierarquia clara, espaço para dados",
    focus: "Compreensão de dados, clareza, confiança, transparência",
    description: "Facilita a compreensão de dados. Layout limpo, elementos infográficos, tons neutros.",
    fontHint: "Sans-serif moderna, geométrica, alta legibilidade",
    colorHint: "Azul institucional, verde confiança, tons neutros",
  },
  emocional: {
    contrast: "Baixo-Médio — tons suaves e acolhedores",
    lighting: "Quente/Golden Hour, luz natural suave, amanhecer/pôr-do-sol",
    style: "Quente, centrado no humano, empático, acolhedor",
    composition: "Close-ups, foco humano, enquadramento íntimo, olhar direto",
    focus: "Pessoas/Expressões, conexão humana, empatia, pertencimento",
    description: "Gera conexão humana e empatia. Iluminação quente, foco em pessoas e expressões.",
    fontHint: "Serifada elegante ou script acolhedora, transmitindo humanidade",
    colorHint: "Tons quentes, âmbar, dourado, cores da terra",
  },
  institucional: {
    contrast: "Baixo — composição estável e formal",
    lighting: "Limpa, balanceada, studio profissional",
    style: "Minimalista, formal, autoritário, governamental",
    composition: "Simétrica, centrada, estável, bandeiras e símbolos",
    focus: "Ordem, estabilidade, governança, competência",
    description: "Transmite estabilidade e ordem. Estilo minimalista, composição simétrica.",
    fontHint: "Serifada clássica, autoritária, transmitindo seriedade",
    colorHint: "Azul escuro, dourado, branco, cores nacionais",
  },
};
```

#### System Prompt Completo do Refiner

```
Você é um Estrategista de Marketing Político Sênior. Sua tarefa é transformar
dados brutos de um formulário em um BRIEFING VISUAL detalhado para um gerador
de imagens de IA (Nano Banana Pro).

DADOS DO FORMULÁRIO:
- Cargo/Local: ${cargo} em ${estado}
- Objetivo: ${objetivo}
- Mensagem Central: "${mensagemCentral}"
- Descrição Visual Bruta: (será fornecida pelo usuário)
- Tom/Combatividade: ${tom} / ${grau}
- Público-Alvo: ${publicoAlvo}

## DADOS CONTEXTUAIS COMPLETOS:
${contextParts.join('\n')}
${politicalContext}

## PARÂMETROS VISUAIS DO TOM "${tom.toUpperCase()}":
- Iluminação: ${toneParams.lighting}
- Composição: ${toneParams.composition}
- Contraste: ${toneParams.contrast}
- Foco visual: ${toneParams.focus}
- Estilo: ${toneParams.style}
- Hint tipográfico: ${fontStyleHint}
- ${toneParams.description}

SUA MISSÃO (3 etapas obrigatórias):

1. **EXPANDIR A CENA**: Transforme a "Descrição Visual Bruta" numa cena
   cinematográfica. Descreva:
   - Lente da câmera (ex: 35mm para contexto ambiental, 85mm para retrato)
   - Iluminação específica (baseada no grau de combatividade)
   - Cores dominantes alinhadas à paleta da marca
   - Expressão facial e linguagem corporal do político alinhados ao tom
   - Elementos regionais sutis do estado (arquitetura, vegetação, cultura)
   - Profundidade de campo, texturas e materiais

2. **DEFINIR O LAYOUT DO TEXTO**: Se houver mensagem central, defina:
   - Posição exata para impacto máximo
   - Estilo tipográfico alinhado ao tom
   - Hierarquia visual adequada ao público
   - Garantia de legibilidade absoluta (contraste texto/fundo)

3. **AJUSTAR O CLIMA**: Adapte toda a atmosfera ao tom político:
   - Combativo: Sombras profundas, cores fortes e saturadas, energia de urgência
   - Emocional: Luz quente dourada, foco em expressões, empatia e conexão
   - Didático/Institucional: Luz solar suave, tons abertos e limpos, estabilidade

## VALIDAÇÃO ÉTICA (pré-verificação):
- Se houver menção a "inimigo" ou "adversário", transforme em "crítica política legítima"
- Nunca gerar conteúdo que viole dignidade humana ou incite ódio
- Respeitar regulamentações eleitorais (TSE)

## FORMATO DE RESPOSTA (JSON estrito):
{
  "briefing_visual": "Uma fotografia cinematográfica de [CENA DETALHADA].
    Lente [LENTE]. Iluminação [DETALHES]. O clima deve ser [ATMOSFERA].
    Cores [PALETA]. O político demonstra [EXPRESSÃO/POSTURA].
    Elementos de ${estado} incluem [DETALHES REGIONAIS].
    O texto '[TEXTO]' deve ser renderizado com fonte ${fontStyleHint}
    na posição [POSIÇÃO IDEAL], garantindo legibilidade absoluta.",
  "headline": "texto principal sugerido (máx 10 palavras)",
  "subtexto": "CTA ou texto secundário (máx 15 palavras)"
}

REGRAS:
- Máximo 300 palavras no briefing_visual
- Sempre em português
- Seja EXTREMAMENTE específico e visual, nunca genérico
- Cada elemento deve ter uma razão estratégica ligada ao objetivo
```

#### Chamada ao Refiner

```typescript
const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-3-flash-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Transforme esta Descrição Visual Bruta num Briefing Visual
          cinematográfico completo:\n\n"${rawDescription}"\n\n
          ${promptContext ? `CONTEXTO CONSOLIDADO DO FORMULÁRIO:\n${promptContext}` : ''}`
      },
    ],
  }),
});

// Parse da resposta JSON
const data = await response.json();
const enriched = data.choices?.[0]?.message?.content?.trim();
const jsonMatch = enriched.match(/\{[\s\S]*\}/);
const parsed = JSON.parse(jsonMatch[0]);

// Resultado:
// parsed.briefing_visual → descrição enriquecida
// parsed.headline → texto principal sugerido
// parsed.subtexto → CTA sugerido
```

---

### 1.4 STEP 2 — Master Prompt Estruturado (`buildDirectorPrompt`)

Monta o prompt final em **6 seções** usando todos os dados coletados:

```typescript
function buildDirectorPrompt(params: {
  userName: string;
  description: string;
  enrichedDescription: string;   // Saída do Step 1
  brandData: any;
  themeData: any;
  personaData: any;
  politicalContext: string;
  politicalProfile: any;
  politicalTone: string;
  vibeStyle: string;
  fontStyle: string;
  includeText: boolean;
  textContent: string;
  textPosition: string;
  contentType: string;
  platform: string;
  objective: string;
  tones: string[];
  additionalInfo: string;
  preserveImagesCount: number;
  styleReferenceImagesCount: number;
  headline: string;             // Saída do Step 1
  subtexto: string;             // Saída do Step 1
}): string {
  const sections: string[] = [];
  const toneParams = TONE_VISUAL_MAP[params.politicalTone] || TONE_VISUAL_MAP['institucional'];
```

#### Seção ROLE

```
Atue como um Consultor de Marketing Político e Designer de Campanha de Alto
Nível. O seu objetivo é criar uma peça visual impecável, esteticamente perfeita
e com design inteligente para ${userName}, respeitando rigorosamente a
identidade visual e os dados fornecidos abaixo.
```

#### Seção 1: CONTEXTO DO UTILIZADOR E MARCA

```
### 1. CONTEXTO DO UTILIZADOR E MARCA (Dados Dinâmicos)
- **Cargo/Função:** ${political_role} em ${state}
- **Partido:** ${political_party}
- **Fase da Campanha/Mandato:** ${mandate_stage}
- **Áreas de Foco:** ${focus_areas.join(', ')}
- **Marca:** ${brandData.name}
- **Setor/Nicho:** ${brandData.segment}
- **Valores:** ${brandData.values}
- **Keywords:** ${brandData.keywords}
- **Promessa da Marca:** ${brandData.promise}
- **Objetivos:** ${brandData.goals}
- **Paleta de Cores Obrigatória:** ${cores.join(', ')}. Se imagens de
  referência forem fornecidas, extraia a paleta exata delas.
- **Restrições:** ${brandData.restrictions}
- **Público-Alvo:** ${personaData.name}
- **Perfil da Audiência:** ${idade}, ${gênero}, ${localização}, ${contexto}
- **Desafios da Audiência:** ${personaData.challenges}
- **Objetivo da Audiência:** ${personaData.main_goal}
- **Crenças e Interesses:** ${personaData.beliefs_and_interests}
- **Gatilhos de Interesse:** ${personaData.interest_triggers}
- **Tom de Voz da Marca:** ${toneStr}
```

#### Seção 2: DIRETRIZES ESTRATÉGICAS

```
### 2. DIRETRIZES ESTRATÉGICAS
- **Fase:** ${mandate_stage} — Adaptar o semblante e maturidade visual.
- **Objetivo do Post:** ${objective}
- **Público-Alvo:** ${personaData.name} — O design deve ressoar com este grupo.
- **Grau de Combatividade:** ${grau}
  → [Instruções visuais específicas para o tom selecionado]
- **Tema Estratégico:** ${themeData.title}
- **Objetivos da Pauta:** ${themeData.objectives}
- **Macro-temas:** ${themeData.macro_themes}
- **Público da Pauta:** ${themeData.target_audience}
- **Ação Esperada:** ${themeData.expected_action}
- **Hashtags:** ${themeData.hashtags}
```

#### Seção 3: COMPOSIÇÃO DA IMAGEM

```
### 3. COMPOSIÇÃO DA IMAGEM (NANO BANANA PRO)
- **Cena:** ${enrichedDescription}. O político deve demonstrar um semblante
  ${toneStr} através da linguagem corporal e expressão facial.
- **Identidade:** Aplique as cores ${cores.join(', ')} na composição.
- **Estilo Visual:** ${VIBE_STYLES[vibeStyle]}
- **Iluminação:** ${toneParams.lighting}
- **Composição:** ${toneParams.composition}
- **Contraste:** ${toneParams.contrast}
- **Foco Visual:** ${toneParams.focus}
- **Plataforma:** ${platform}
- **Tipo:** ${contentType === 'ads' ? 'ANÚNCIO PAGO — foco em conversão'
    : 'ORGÂNICO — foco em engajamento'}
- **Regionalismo:** Adapte sutilmente o fundo (arquitetura, vegetação,
  elementos culturais) para remeter a ${state}.
- **Qualidade:** Fotorealismo 4K, profundidade de campo profissional,
  estilo de fotografia de campanha de alta verba.
```

#### Seção 4: TEXTO E DESIGN

**Com texto:**

```
### 4. TEXTO E DESIGN
- **Headline:** Renderize PERFEITAMENTE o texto: "${textContent}"
- **Tipografia:** ${FONT_STYLES[fontStyle]}. Adaptar ao tom: ${toneParams.fontHint}.
- **Cor da tipografia:** Em harmonia com a paleta da marca.
- **Posição do Texto:** ${posição}. O texto NÃO deve obstruir o rosto.
- **Legibilidade e Contraste:** O texto DEVE ser o foco principal e 100% legível.
  Utilize espaço negativo, sobreposições de gradiente sutil ou caixas de texto limpas.
- **Design Inteligente:** Organize os elementos visuais de acordo com o Tom.
```

**Sem texto:**

```
- **SEM TEXTO:** CRÍTICO: NÃO inclua NENHUM texto, palavras, letras, números
  ou símbolos visíveis na imagem. A imagem deve ser puramente visual.
```

**Com headline sugerida pelo Refiner (Step 1):**

```
- **Headline Sugerida:** "${headline}"
- **Subtexto/CTA Sugerido:** "${subtexto}"
- **NOTA:** Renderize o texto apenas se fizer sentido para o layout.
```

#### Seção 5: USO DE REFERÊNCIAS VISUAIS

```
### 5. USO DE REFERÊNCIAS VISUAIS
${preserveImagesCount} imagem(ns) da IDENTIDADE DA MARCA foram fornecidas.
Use como REFERÊNCIA DE ESTILO (Style Reference): extraia a atmosfera,
iluminação, paleta de cores e sentimento geral. A nova imagem DEVE parecer
parte do mesmo conjunto visual.

${styleReferenceImagesCount} imagem(ns) de REFERÊNCIA DO USUÁRIO foram
fornecidas. Use como inspiração adicional de composição e estética.
```

#### Seção 6: ESPECIFICAÇÕES TÉCNICAS E COMPLIANCE

```
### 6. ESPECIFICAÇÕES TÉCNICAS E COMPLIANCE
- **Formato:** Otimizado para ${platform}
- **Resolução:** 4K, PNG para tipografia nítida
- **Geração de Pessoas:** Permitida — campanha política requer representação

COMPLIANCE ÉTICO E LEGAL (CONAR/CDC/TSE):
- HONESTIDADE: A imagem NÃO pode induzir ao erro ou criar falsas representações
- DIGNIDADE: PROIBIDO qualquer forma de discriminação ou discurso de ódio
- REGULAMENTAÇÃO ELEITORAL: Respeitar legislação vigente
- ACESSIBILIDADE: Garantir contraste mínimo WCAG AA para textos
```

#### Seções Adicionais Injetadas

```
### CONTEXTO POLÍTICO COMPLETO
[Gerado por buildPoliticalContext() — inclui base de conhecimento + perfil]

### TEMAS SENSÍVEIS (RESTRIÇÕES ABSOLUTAS)
${red_lines}
ATENÇÃO: Os temas sensíveis acima são PROIBIÇÕES. O conteúdo NUNCA deve
violar essas restrições.

### INFORMAÇÕES ADICIONAIS DO USUÁRIO
${additionalInfo}
```

---

### 1.5 STEP 3 — Geração da Imagem (Gemini 3 Pro)

**Modelo:** `google/gemini-3-pro-image-preview`
**Endpoint:** `https://ai.gateway.lovable.dev/v1/chat/completions`

```typescript
// Montar conteúdo da mensagem com texto + imagens de referência
const messageContent: any[] = [
  { type: 'text', text: enhancedPrompt }  // Master Prompt do Step 2
];

// Adicionar imagens da marca como referência de estilo
preserveImages.forEach((img: string) => {
  messageContent.push({
    type: 'image_url',
    image_url: { url: img }  // URL base64 ou HTTP
  });
});

// Adicionar imagens do usuário como referência adicional
styleReferenceImages.forEach((img: string) => {
  messageContent.push({
    type: 'image_url',
    image_url: { url: img }
  });
});

// Chamada à API
const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-3-pro-image-preview',
    messages: [{ role: 'user', content: messageContent }],
    modalities: ['image', 'text'],
  }),
});
```

#### Extração da Imagem (3 Formatos Suportados)

```typescript
const data = await response.json();
const message = data.choices?.[0]?.message;
let imageUrl: string | null = null;

// Formato 1: message.images[] (Lovable AI Gateway)
if (message?.images?.length > 0) {
  imageUrl = message.images[0].image_url?.url;
}

// Formato 2: message.content[] (array de partes)
if (!imageUrl && Array.isArray(message?.content)) {
  for (const part of message.content) {
    if (part.type === 'image_url' && part.image_url?.url) {
      imageUrl = part.image_url.url;
      break;
    }
  }
}

// Formato 3: candidates[].content.parts[].inlineData (Gemini nativo)
if (!imageUrl && data.candidates?.[0]?.content?.parts) {
  for (const part of data.candidates[0].content.parts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
      break;
    }
  }
}
```

#### Retry Logic

```typescript
const MAX_RETRIES = 3;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    // ... chamada à API ...
    if (!response.ok) {
      if (response.status === 429) return errorResponse('Rate limit');
      if (response.status === 402) return errorResponse('Créditos esgotados');
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      throw new Error(`Gateway error: ${response.status}`);
    }
    // ... extração da imagem ...
    break; // Sucesso
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
```

---

### 1.6 Pós-Geração

```typescript
// 1. Upload para Storage
const fileName = `content-images/${teamId || userId}/${timestamp}.png`;

let binaryData: Uint8Array;
if (imageUrl.startsWith('data:')) {
  const base64Data = imageUrl.split(',')[1];
  binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
} else {
  const imgResp = await fetch(imageUrl);
  binaryData = new Uint8Array(await imgResp.arrayBuffer());
}

await supabase.storage.from('content-images').upload(fileName, binaryData, {
  contentType: 'image/png',
  upsert: false
});

const { data: { publicUrl } } = supabase.storage
  .from('content-images')
  .getPublicUrl(fileName);

// 2. Deduzir créditos
const deductResult = await deductUserCredits(supabase, userId, 6); // COMPLETE_IMAGE

// 3. Registrar no histórico
await recordUserCreditUsage(supabase, {
  userId,
  teamId,
  actionType: 'COMPLETE_IMAGE',
  creditsUsed: 6,
  creditsBefore,
  creditsAfter: deductResult.newCredits,
  description: 'Geração de imagem (Pipeline Político Premium)',
  metadata: {
    platform, vibeStyle, fontStyle, politicalTone,
    model: 'gemini-3-pro-image-preview',
    enriched: enrichedDescription !== formData.description,
    hasHeadline: !!headline,
  }
});

// 4. Salvar ação no banco
await supabase.from('actions').insert({
  type: 'CRIAR_CONTEUDO',
  user_id: userId,
  team_id: teamId,
  brand_id: formData.brandId || null,
  status: 'Aprovado',
  approved: true,
  asset_path: fileName,
  thumb_path: fileName,
  details: {
    description: formData.description,
    brandId: formData.brandId,
    themeId: formData.themeId,
    personaId: formData.personaId,
    platform: formData.platform,
    vibeStyle: formData.vibeStyle,
    fontStyle: formData.fontStyle,
    politicalTone: formData.politicalTone,
    contentType: formData.contentType,
    preserveImagesCount: preserveImages.length,
    styleReferenceImagesCount: styleReferenceImages.length,
    pipeline: 'political_premium_v3',
  },
  result: {
    imageUrl: publicUrl,
    description,
    headline: headline || null,
    subtexto: subtexto || null,
  }
});

// 5. Resposta ao frontend
return {
  imageUrl: publicUrl,
  description,
  headline: headline || null,
  subtexto: subtexto || null,
  actionId: actionData?.id,
  success: true
};
```

---

## 2. EDIÇÃO DE IMAGEM (`edit-image`)

Permite edições iterativas sobre uma imagem já gerada.

**Modelo:** `google/gemini-2.5-flash-image`
**Custo:** 1 crédito

### Prompt de Edição Estruturado

```typescript
function buildRevisionPrompt(
  adjustment: string,
  brandData: any | null,
  themeData: any | null,
  hasLogo: boolean,
  platform?: string,
  aspectRatio?: string
): string {
  let promptParts: string[] = [
    "🎨 VOCÊ É UM EDITOR DE IMAGENS ESPECIALIZADO.",
    "SUA MISSÃO: APLICAR EXATAMENTE O QUE O USUÁRIO SOLICITOU.",
    "",
    "🎯 INSTRUÇÃO DO USUÁRIO (EXECUTE ISTO COM PRECISÃO):",
    `"${cleanInput(adjustment)}"`,
    "",
    "⚠️ REGRAS CRÍTICAS:",
    "1. VOCÊ DEVE aplicar modificações VISÍVEIS e SIGNIFICATIVAS",
    "2. Se pedir para mudar COR, altere de forma CLARA",
    "3. Se pedir para adicionar/remover OBJETOS, faça CLARAMENTE",
    "4. Se pedir para mudar TAMANHO/POSIÇÃO, execute EXATAMENTE",
    "5. NUNCA retorne a imagem original sem modificações",
    "6. Mantenha qualidade profissional e realismo",
    "7. Se a instrução não for clara, interprete da forma mais lógica",
  ];

  // Contexto de plataforma
  if (platform) promptParts.push(`- Plataforma: ${platform}`);
  if (aspectRatio) promptParts.push(`- Proporção: ${aspectRatio}`);

  // Logo da marca
  if (hasLogo) {
    promptParts.push("🏷️ LOGO DA MARCA:");
    promptParts.push("- Reserve espaço apropriado para o logo");
    promptParts.push("- Garanta que a estética se alinhe com a identidade visual");
  }

  // Identidade da marca
  if (brandData) {
    promptParts.push("🎯 IDENTIDADE DA MARCA:");
    if (brandData.name) promptParts.push(`📌 Nome: ${brandData.name}`);
    if (brandData.segment) promptParts.push(`🏢 Segmento: ${brandData.segment}`);
    if (brandData.values) promptParts.push(`💎 Valores: ${brandData.values}`);
    if (brandData.promise) promptParts.push(`✨ Promessa: ${brandData.promise}`);
    if (brandData.color_palette) promptParts.push(`🎨 Paleta: ${JSON.stringify(brandData.color_palette)}`);
    if (brandData.restrictions) promptParts.push(`🚫 NÃO FAZER: ${brandData.restrictions}`);
    if (brandData.keywords) promptParts.push(`🔑 Palavras-chave: ${brandData.keywords}`);
    if (brandData.goals) promptParts.push(`🎯 Metas: ${brandData.goals}`);
  }

  // Tema estratégico
  if (themeData) {
    promptParts.push("🎭 TEMA ESTRATÉGICO:");
    if (themeData.title) promptParts.push(`📋 Título: ${themeData.title}`);
    if (themeData.description) promptParts.push(`📝 Descrição: ${themeData.description}`);
    if (themeData.tone_of_voice) promptParts.push(`🗣️ Tom de Voz: ${themeData.tone_of_voice}`);
    if (themeData.objectives) promptParts.push(`🎯 Objetivos: ${themeData.objectives}`);
    if (themeData.target_audience) promptParts.push(`👥 Público: ${themeData.target_audience}`);
    if (themeData.expected_action) promptParts.push(`⚡ Ação Esperada: ${themeData.expected_action}`);
    if (themeData.color_palette) promptParts.push(`🎨 Paleta do Tema: ${themeData.color_palette}`);
  }

  promptParts.push("✅ RESULTADO ESPERADO:");
  promptParts.push("- Imagem editada com ALTA QUALIDADE e REALISMO PROFISSIONAL");
  promptParts.push("- Ajuste solicitado aplicado de forma VISÍVEL e EFETIVA");
  promptParts.push("- Alinhamento perfeito com identidade de marca e tema");

  return promptParts.join('\n');
}
```

### Chamada à API de Edição

```typescript
// Preparar imagem (URL ou base64)
let imageDataUrl: string;

if (imageUrl.startsWith('data:')) {
  imageDataUrl = imageUrl;
} else {
  // Baixar e converter para base64
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const bytes = new Uint8Array(imageBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  const contentType = imageResponse.headers.get('content-type') || 'image/png';
  imageDataUrl = `data:${contentType};base64,${btoa(binary)}`;
}

// Chamada ao gateway
const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash-image',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: detailedPrompt },
        { type: 'image_url', image_url: { url: imageDataUrl } }
      ]
    }],
    modalities: ['image', 'text']
  })
});

// Extração: message.images[0].image_url.url
const editedImageDataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
```

---

## 3. REVISÃO DE IMAGEM (`review-image`)

Análise visual completa de uma imagem gerada.

**Modelo:** `gpt-4o-mini` (OpenAI)
**Custo:** 2 créditos

### System Prompt

```
Você é um especialista em análise visual, design gráfico, acessibilidade
digital, UX/UI e estratégia de conteúdo visual para redes sociais.
Analise imagens considerando composição, hierarquia visual, cores, contraste,
legibilidade, acessibilidade, alinhamento com identidade de marca, adequação
para plataformas digitais e melhores práticas de design.
Forneça análise estruturada, educacional e acionável com score visual,
análise técnica de acessibilidade e recomendações específicas por plataforma.
```

### Estrutura de Resposta Obrigatória (Markdown)

```markdown
## 📊 Análise Visual
**Score de Qualidade Visual**: [1-10]/10
**Justificativa do Score**: [breve explicação]

---

### ✅ Pontos Fortes
- [Elementos visuais efetivos]
- [Composição bem executada]
- [Uso adequado de cores]

---

### ⚠️ Pontos de Melhoria
- [Oportunidades de otimização]
- [Ajustes técnicos necessários]

---

### 🎨 Análise Técnica Visual
**Composição e Hierarquia**: [regra dos terços, pontos focais, equilíbrio]
**Paleta de Cores**: [harmonia, contraste, psicologia das cores]
**Tipografia** (se aplicável): [legibilidade, hierarquia, escolha de fontes]
**Contraste e Legibilidade**: [contraste de cores, clareza de texto]
**Qualidade Técnica**: [resolução, nitidez, ruído, compressão]

---

### ♿ Análise de Acessibilidade
**Contraste de Cores**: [mínimo 4.5:1]
**Legibilidade de Texto**: [tamanho, peso, espaçamento]
**Sugestão de Texto Alternativo (Alt Text)**: "[descrição para leitores de tela]"
**Recomendações**: [ajustes para acessibilidade]

---

### 📱 Adequação por Plataforma
**Instagram Feed** (1080x1080 ou 1080x1350): [análise]
**Instagram Stories** (1080x1920): [análise]
**Facebook/LinkedIn** (1200x630): [análise]
**YouTube Thumbnail** (1280x720): [análise]

---

### 💡 Sugestões de Otimização
#### 🔧 Ajustes Técnicos
#### 🎨 Ajustes Visuais
#### 📐 Ajustes de Layout

---

### 🏢 Alinhamento com Identidade de Marca
[análise de alinhamento com valores e estilo da marca]

---

### 🎯 Recomendações Finais
[resumo das melhorias prioritárias]
```

### Chamada à API

```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openAIApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: contextPrompt },
          { type: 'image_url', image_url: { url: image } }
        ]
      }
    ],
    temperature: 0.7,
    max_tokens: 2000,
  }),
});

// Retry: 3 tentativas com 2s de delay
// Não faz retry em 429 (rate limit) ou 401 (auth)
```

---

## 4. REVISÃO DE TEXTO PARA IMAGEM (`review-text-for-image`)

Análise de copy/texto que será inserido em imagens de posts.

**Modelo:** `gpt-4o-mini` (OpenAI)
**Custo:** 2 créditos

### System Prompt

```
Você é um especialista em copywriting para redes sociais e design de posts.
Analise textos que serão inseridos em imagens de posts (frases, mensagens,
citações, títulos, CTAs, etc.) de forma profunda, considerando clareza,
impacto visual, legibilidade, adequação ao espaço da imagem, tom de voz
e efetividade da mensagem.
Forneça análise estruturada, educacional e acionável com score de qualidade,
pontos positivos, sugestões específicas e versões otimizadas do texto.
```

### Estrutura de Resposta Obrigatória (Markdown)

```markdown
## 📊 Análise do Texto
**Score de Qualidade**: [1-10]/10
**Justificativa do Score**: [breve explicação]

---

### ✅ Pontos Fortes
- [Clareza da mensagem]
- [Impacto visual do texto]
- [Tom de voz apropriado]

---

### ⚠️ Pontos de Melhoria
- [Tamanho do texto]
- [Palavras complexas]
- [Falta de gancho emocional]

---

### 🎨 Análise de Adequação Visual
**Legibilidade**: [análise em diferentes tamanhos e fundos]
**Tamanho Ideal**: [muito longo, muito curto ou adequado]
**Hierarquia Visual**: [títulos, subtítulos, frases de destaque]
**Quebras de Linha**: [sugestões de quebra]
**Formatação Recomendada**: [negrito, itálico, CAPS, emojis]

---

### 💡 Versões Otimizadas

#### 1️⃣ Versão Impacto
[máximo impacto emocional e visual, texto direto e poderoso]

#### 2️⃣ Versão Didática
[mais explicativa e educativa, mantendo clareza]

#### 3️⃣ Versão Minimalista
[ultra-resumida, apenas o essencial]

---

### 🎯 Dicas de Formatação Visual
**Sugestão de Emojis**: [quais e onde]
**Destaque de Palavras-chave**: [CAPS ou negrito]
**Estrutura de Parágrafos**: [como organizar visualmente]
**Call-to-Action**: [sugestões de CTA]

---

### 📱 Adaptação para Plataformas
**Instagram Feed**: [adaptação]
**Instagram Stories**: [adaptação]
**LinkedIn**: [adaptação profissional]
**Facebook**: [adaptação]

---

### 🎯 Recomendações Finais
[resumo e próximos passos]
```

---

## 5. CONTEXTUALIZAÇÃO POLÍTICA (Injetada em Todas as Funções)

### Perfil Político (`_shared/politicalProfile.ts`)

```typescript
interface PoliticalProfile {
  political_role: string | null;      // Ex: "Vereador", "Deputado Federal"
  political_party: string | null;     // Ex: "PT", "PL"
  political_experience: string | null;
  political_level: string | null;     // Municipal, Estadual, Federal
  focus_areas: string[] | null;       // Ex: ["Saúde", "Educação"]
  main_social_networks: string[] | null;
  target_audience_description: string | null;
  mandate_stage: string | null;       // Pré-campanha, Campanha, Período extraeleitoral
  biography: string | null;
  tone_of_voice: string | null;
  red_lines: string | null;          // Temas proibidos/sensíveis
  evidence_history: string | null;
}
```

### Construção do Contexto (`buildPoliticalContext`)

```typescript
function buildPoliticalContext(profile: PoliticalProfile | null): string {
  const parts: string[] = [];

  // 1. BASE DE CONHECIMENTO: "A Próxima Democracia" (32 Teses)
  //    - Conceito do Mundo Figital
  //    - 16 Sinais de Colapso da Política
  //    - 16 Novos Princípios para Refundação
  //    - 32 Teses em 5 grupos
  //    - Framework AEIOU
  //    - 10 Diretrizes para geração de conteúdo
  const knowledgeBase = getKnowledgeBaseContext();
  if (knowledgeBase) parts.push(knowledgeBase);

  // 2. PERFIL POLÍTICO DO AUTOR
  if (profile) {
    const lines: string[] = [];
    if (profile.political_role) lines.push(`- Cargo político: ${profile.political_role}`);
    if (profile.political_party) lines.push(`- Partido: ${profile.political_party}`);
    if (profile.political_level) lines.push(`- Nível de atuação: ${profile.political_level}`);
    if (profile.political_experience) lines.push(`- Experiência: ${profile.political_experience}`);
    if (profile.mandate_stage) lines.push(`- Fase atual: ${profile.mandate_stage}`);
    if (profile.focus_areas?.length) lines.push(`- Áreas de foco: ${profile.focus_areas.join(', ')}`);
    if (profile.main_social_networks?.length) lines.push(`- Redes: ${profile.main_social_networks.join(', ')}`);
    if (profile.target_audience_description) lines.push(`- Público-alvo: ${profile.target_audience_description}`);
    if (profile.biography) lines.push(`- Biografia: ${profile.biography}`);
    if (profile.tone_of_voice) lines.push(`- Tom de voz: ${profile.tone_of_voice}`);
    if (profile.evidence_history) lines.push(`- Evidências: ${profile.evidence_history}`);

    if (lines.length > 0) {
      parts.push(`\n# PERFIL POLÍTICO DO AUTOR\n${lines.join('\n')}\n`);
    }

    // 3. TEMAS SENSÍVEIS (PROIBIÇÕES ABSOLUTAS)
    if (profile.red_lines) {
      parts.push(`\n# TEMAS SENSÍVEIS (RESTRIÇÕES ABSOLUTAS)\n${profile.red_lines}\n
ATENÇÃO: Os temas sensíveis acima são PROIBIÇÕES.
O conteúdo NUNCA deve violar essas restrições.\n`);
    }

    if (lines.length > 0) {
      parts.push(`\nIMPORTANTE: Considere o perfil político acima para adaptar
tom, linguagem e contexto do conteúdo gerado. O conteúdo deve ser adequado ao
cargo, partido e áreas de atuação do político.\n`);
    }
  }

  return parts.join('\n');
}
```

---

## 6. SISTEMA DE CRÉDITOS

### Custos por Ação

```typescript
const CREDIT_COSTS = {
  QUICK_IMAGE: 5,           // Imagem rápida (QuickContent)
  COMPLETE_IMAGE: 6,        // Imagem completa (generate-image)
  IMAGE_GENERATION: 5,      // Geração standalone
  IMAGE_EDIT: 1,            // Edição de imagem (edit-image)
  IMAGE_REVIEW: 2,          // Revisão de imagem (review-image)
  CAPTION_REVIEW: 2,        // Revisão de legenda
  TEXT_REVIEW: 2,            // Revisão de texto (review-text-for-image)
  CONTENT_PLAN: 3,          // Planejamento de conteúdo
  VIDEO_GENERATION: 20,     // Geração de vídeo
  FAKE_NEWS_MONITOR: 2,
  FAKE_NEWS_RESPOND: 3,
  FACT_CHECK: 1,
  CAMPAIGN_PACKAGE: 50,     // Pacote de campanha completo
  ANALYZE_REPERCUSSION: 2,
  CRISIS_ANALYSIS: 3,
};
```

### Fluxo de Créditos

```typescript
// 1. Verificar se o usuário tem créditos suficientes
const creditCheck = await checkUserCredits(supabase, userId, CREDIT_COSTS.COMPLETE_IMAGE);
if (!creditCheck.hasCredits) {
  return { error: 'Créditos insuficientes', required: 6, available: creditCheck.currentCredits };
}

// 2. Executar a ação (geração, edição, revisão)
// ...

// 3. Deduzir créditos após sucesso
const deductResult = await deductUserCredits(supabase, userId, CREDIT_COSTS.COMPLETE_IMAGE);

// 4. Registrar no histórico
await recordUserCreditUsage(supabase, {
  userId,
  teamId,
  actionType: 'COMPLETE_IMAGE',
  creditsUsed: 6,
  creditsBefore: creditCheck.currentCredits,
  creditsAfter: deductResult.newCredits,
  description: 'Geração de imagem',
  metadata: { platform, vibeStyle, model: 'gemini-3-pro-image-preview' }
});
```

---

## 7. MAPEAMENTOS COMPLETOS

### Vibes (Estilos Visuais)

```typescript
const VIBE_STYLES: Record<string, string> = {
  minimalist: "Fotografia flat lay estúdio, fundo limpo, espaço negativo amplo, composição equilibrada, tons neutros elegantes",
  pop_neon: "Cores saturadas, iluminação neon, contraste forte, estilo arte urbana, vibrante e energético",
  professional: "Fotografia corporativa de alta qualidade, profundidade de campo rasa, tons neutros, iluminação studio profissional",
  cinematic: "Fotografia cinematográfica 4K, color grading de filme, composição dramática, iluminação volumétrica",
  "3d_modern": "3D render minimalista, iluminação studio suave, materiais realistas, composição clean moderna",
  illustration: "Ilustração vetorial moderna, cores vibrantes, formas geométricas, design gráfico contemporâneo",
  realistic: "Fotografia de alta qualidade, hiper-realista, 8K, iluminação natural profissional",
  animated: "3D animado estilo Pixar/Disney, renderização estilizada, cores vibrantes",
  cartoon: "Ilustração cartoon, contornos marcados, cores planas, design expressivo",
  anime: "Estilo anime japonês, cel-shading, lineart detalhada",
  watercolor: "Estilo aquarela, pinceladas suaves, textura artística",
  oil_painting: "Estilo pintura a óleo, texturas ricas, pinceladas visíveis",
  digital_art: "Arte digital profissional, conceito art, renderização polida",
  sketch: "Estilo desenho a lápis, linhas expressivas, grafite sobre papel",
  vintage: "Estética vintage retrô, color grading nostálgico, grain de filme, tons quentes",
};
```

### Fontes (Tipografia)

```typescript
const FONT_STYLES: Record<string, string> = {
  elegant: "serifa clássica, refinada, com elegância tipográfica",
  modern: "sans-serif limpa, geométrica, moderna e minimalista",
  fun: "script casual ou display arrojada, divertida e expressiva",
  impactful: "bold condensada, display forte, grande impacto visual",
};
```

### Plataformas → Aspect Ratios

```typescript
const PLATFORM_ASPECT_RATIO: Record<string, string> = {
  'feed': '4:5',
  'stories': '9:16',
  'reels': '9:16',
  'linkedin': '1.91:1',
  'twitter': '1.91:1',
  'facebook_feed': '4:5',
  'youtube_thumb': '16:9',
};
```

### Posições de Texto

```typescript
const TEXT_POSITIONS: Record<string, string> = {
  'top': 'no topo da imagem',
  'center': 'centralizado na imagem',
  'bottom': 'na parte inferior da imagem',
  'top-left': 'no canto superior esquerdo',
  'top-right': 'no canto superior direito',
  'bottom-left': 'no canto inferior esquerdo',
  'bottom-right': 'no canto inferior direito',
};
```

---

## 8. SANITIZAÇÃO DE INPUT

```typescript
function cleanInput(text: string | string[] | undefined | null): string {
  if (!text) return "";
  if (Array.isArray(text)) {
    return text.map(item => cleanInput(item)).join(", ");
  }
  const textStr = String(text);
  // Remove caracteres potencialmente perigosos
  let cleanedText = textStr.replace(/[<>{}[\]"'`]/g, "");
  // Normaliza espaços
  cleanedText = cleanedText.replace(/\s+/g, " ").trim();
  return cleanedText;
}
```

---

## 9. FLUXO COMPLETO (Diagrama)

```
USUÁRIO (Frontend)
    │
    ├── Seleciona: Marca, Pauta, Persona
    ├── Preenche: Descrição, Objetivo, Tom, Vibe, Fonte
    ├── Configura: Texto na imagem, Plataforma, Tipo
    ├── Anexa: Imagens de referência (opcional)
    │
    ▼
buildImagePromptString() → promptContext (Markdown estruturado em 8 seções)
buildRequestPayload() → { IDs + campos + promptContext + imagens }
    │
    ▼
═══════════════════════════════════════════════════════════
EDGE FUNCTION: generate-image (Backend)
═══════════════════════════════════════════════════════════
    │
    ├── Auth: JWT → user_id → profile + politicalProfile
    ├── Credits: checkUserCredits(userId, 6)
    ├── DB: fetchBrandData + fetchThemeData + fetchPersonaData (paralelo)
    ├── Context: buildPoliticalContext(politicalProfile)
    │            └── Inclui base de conhecimento (32 Teses)
    │            └── Inclui temas sensíveis
    │
    ├── STEP 1: enrichPromptWithFlash()
    │   ├── Modelo: google/gemini-3-flash-preview
    │   ├── Input: descrição bruta + todos os dados contextuais
    │   └── Output: { briefing_visual, headline, subtexto }
    │
    ├── STEP 2: buildDirectorPrompt()
    │   ├── 6 seções estruturadas
    │   ├── + contexto político completo
    │   ├── + base de conhecimento
    │   └── + informações adicionais
    │
    ├── STEP 3: Geração da Imagem
    │   ├── Modelo: google/gemini-3-pro-image-preview
    │   ├── Input: Master Prompt + imagens de referência
    │   ├── Retry: 3 tentativas com 2s delay
    │   └── Output: imagem PNG (base64 ou URL)
    │
    ├── Upload: Supabase Storage (content-images/{teamId}/{timestamp}.png)
    ├── Deduct: deductUserCredits(userId, 6) + recordUserCreditUsage
    ├── Save: actions table (type: 'CRIAR_CONTEUDO')
    │
    ▼
RESPOSTA: { imageUrl, description, headline, subtexto, actionId, success }
    │
    ▼
═══════════════════════════════════════════════════════════
AÇÕES PÓS-GERAÇÃO (Usuário escolhe)
═══════════════════════════════════════════════════════════
    │
    ├── ✅ Aprovar e baixar (PNG)
    │
    ├── ✏️ Editar (edit-image)
    │   ├── Modelo: google/gemini-2.5-flash-image
    │   ├── Input: imagem original + instrução de edição + contexto da marca/tema
    │   ├── Custo: 1 crédito
    │   └── Output: nova imagem editada (upload para Storage)
    │
    ├── 🔍 Revisar imagem (review-image)
    │   ├── Modelo: gpt-4o-mini (OpenAI)
    │   ├── Input: imagem + contexto político + marca + tema
    │   ├── Custo: 2 créditos
    │   ├── Retry: 3 tentativas com 2s delay
    │   └── Output: análise Markdown estruturada (Score, Pontos Fortes,
    │              Acessibilidade, Adequação por Plataforma, Sugestões)
    │
    └── 📝 Revisar texto (review-text-for-image)
        ├── Modelo: gpt-4o-mini (OpenAI)
        ├── Input: texto + contexto político + marca + tema
        ├── Custo: 2 créditos
        └── Output: análise + 3 versões otimizadas (Impacto, Didática, Minimalista)
```

---

## 10. AUTENTICAÇÃO E SEGURANÇA

Todas as Edge Functions seguem o mesmo padrão:

```typescript
// 1. Extrair token JWT do header
const authHeader = req.headers.get('authorization');
const token = authHeader?.replace('Bearer ', '');

if (!token) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}

// 2. Validar usuário via Supabase Auth
const { data: { user }, error: authError } = await supabase.auth.getUser(token);

if (authError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}

// 3. Buscar perfil do usuário (team_id é opcional)
const { data: profile } = await supabase
  .from('profiles')
  .select('team_id, credits')
  .eq('id', user.id)
  .single();

// 4. Verificar créditos antes de executar
const creditCheck = await checkUserCredits(supabase, user.id, CREDIT_COSTS.AÇÃO);
if (!creditCheck.hasCredits) {
  return new Response(JSON.stringify({
    error: 'Créditos insuficientes',
    required: CREDIT_COSTS.AÇÃO,
    available: creditCheck.currentCredits
  }), { status: 402 });
}
```

---

## 11. TABELAS DO BANCO DE DADOS

### `actions` (Histórico de ações)

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID | PK |
| type | string | 'CRIAR_CONTEUDO', 'REVISAR_CONTEUDO', etc. |
| user_id | UUID | FK → profiles |
| team_id | UUID | FK → teams (opcional) |
| brand_id | UUID | FK → brands (opcional) |
| status | string | 'Aprovado', 'Concluída', etc. |
| approved | boolean | Se foi aprovado pelo usuário |
| asset_path | string | Caminho no Storage |
| thumb_path | string | Caminho da thumbnail |
| details | JSON | Dados de entrada |
| result | JSON | Resultado da ação |
| created_at | timestamp | Data de criação |

### `credit_history` (Histórico de créditos)

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → profiles |
| team_id | UUID | FK → teams (opcional) |
| action_type | string | 'COMPLETE_IMAGE', 'IMAGE_EDIT', etc. |
| credits_used | number | Créditos consumidos |
| credits_before | number | Saldo antes |
| credits_after | number | Saldo depois |
| description | string | Descrição da ação |
| metadata | JSON | Dados adicionais |
| created_at | timestamp | Data |
