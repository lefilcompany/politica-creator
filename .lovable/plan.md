

# Reestruturação da Criação de Conteúdo - Prompt Premium + Gemini 3 Pro

## Visao Geral

Reestruturar o pipeline de geração de imagem para usar um prompt estruturado de "Diretor de Arte Digital", integrando dados completos de identidade, pauta estrategica, audiencia e perfil politico. Migrar para o modelo `google/gemini-3-pro-image-preview` via Lovable AI Gateway e adicionar um passo intermediario de "enriquecimento de prompt" com Gemini Flash.

---

## Parte 1: Edge Function `generate-image` - Pipeline de 2 Etapas

### Etapa A: Enriquecimento de Prompt (Gemini Flash)

Antes de gerar a imagem, usar `google/gemini-3-flash-preview` via Lovable AI Gateway para transformar a descricao simples do usuario numa `scene_description` rica e visual.

- Input: descricao bruta do usuario + dados do banco (marca, pauta, persona, perfil politico)
- Output: descricao cinematografica detalhada (iluminacao, composicao, atmosfera, detalhes visuais)
- Chamada via `https://ai.gateway.lovable.dev/v1/chat/completions` com `LOVABLE_API_KEY`

### Etapa B: Geracao de Imagem (Gemini 3 Pro Image Preview)

Substituir a chamada direta ao Gemini API (`generativelanguage.googleapis.com`) pela Lovable AI Gateway usando o modelo `google/gemini-3-pro-image-preview`.

- Usar `modalities: ["image", "text"]` conforme documentacao
- Manter retry logic (3 tentativas)
- Upload do resultado para storage

### Novo `buildDetailedPrompt` - Template Dinamico

Reestruturar o prompt builder para seguir o template de "Diretor de Arte Digital":

1. **CONTEXTO DO UTILIZADOR E MARCA** - Preencher com dados completos da marca (segmento, valores, keywords, paleta de cores hex), perfil politico (cargo, partido, areas de foco), e pauta estrategica (titulo, objetivos, macro-temas)
2. **CONTEUDO E COMPOSICAO DO POST** - Headline text (se incluir texto), CTA text, scene_description (enriquecida pelo Flash), visual_style
3. **INSTRUCOES DE DESIGN** - Fidelidade tipografica, legibilidade, contraste, design inteligente baseado no tom de voz
4. **REFERENCIAS VISUAIS** - Imagens da marca como `style_reference`, imagens do usuario como referencia adicional

### Buscar Dados Completos no Backend

Atualmente o backend recebe apenas nomes (strings). Mudar para buscar dados completos diretamente das tabelas:

- `brands`: `segment, values, keywords, color_palette, brand_color, goals, promise`
- `strategic_themes`: `tone_of_voice, platforms, target_audience, objectives, macro_themes, description, objective_type, color_palette, hashtags`
- `personas`: `age, gender, location, professional_context, preferred_tone_of_voice, challenges, main_goal, beliefs_and_interests`
- `profiles` (perfil politico): ja buscado via `fetchPoliticalProfile`

---

## Parte 2: Customizacoes no Frontend (CreateImage.tsx)

### Menus de "Vibe" e Tipografia

Adicionar dois novos seletores ao formulario:

**Menu de Vibe (Visual Style)** - substituir o seletor existente com opcoes mapeadas:
- Minimalista -> "Fotografia flat lay, fundo limpo, espaco negativo amplo"
- Pop/Neon -> "Cores saturadas, iluminacao neon, contraste forte"
- Profissional -> "Fotografia corporativa, profundidade de campo rasa, tons neutros"
- Cinematografico -> "Fotografia cinematografica 4K, grading de filme"
- 3D Moderno -> "3D render minimalista, iluminacao studio"
- Ilustracao -> "Ilustracao vetorial moderna, cores vibrantes"

**Menu de Tipografia** (quando texto na imagem estiver ativado):
- Elegante -> "serifa classica, refinada"
- Moderna -> "sans-serif limpa, geometrica"
- Divertida -> "script casual ou display arrojada"
- Impactante -> "bold condensada, display forte"

### Enviar dados enriquecidos ao backend

O frontend ja envia `brandId`, `themeId`, `personaId`. O backend que sera responsavel por buscar todos os dados completos diretamente do banco.

---

## Parte 3: Arquivos Modificados

### `supabase/functions/generate-image/index.ts`
- Adicionar Step 1: enriquecimento de prompt via Gemini Flash (Lovable AI Gateway)
- Migrar Step 2: geracao de imagem para `google/gemini-3-pro-image-preview` via Lovable AI Gateway
- Buscar dados completos de brand, theme e persona diretamente do banco
- Reescrever `buildDetailedPrompt()` com template de "Diretor de Arte Digital"
- Incluir instrucoes de fidelidade tipografica e design inteligente
- Tratar imagens de referencia como `style_reference` no prompt

### `src/pages/CreateImage.tsx`
- Atualizar opcoes de `visualStyle` com as novas "Vibes" (Minimalista, Pop/Neon, Profissional, Cinematografico, 3D, Ilustracao)
- Adicionar seletor de tipografia (condicional ao texto na imagem)
- Enviar `fontStyle` e `vibeStyle` no request body ao backend

### `supabase/functions/_shared/politicalProfile.ts`
- Sem alteracoes (ja funciona corretamente)

---

## Detalhes Tecnicos

### Chamada Lovable AI Gateway (Enriquecimento)
```text
POST https://ai.gateway.lovable.dev/v1/chat/completions
Authorization: Bearer LOVABLE_API_KEY
{
  "model": "google/gemini-3-flash-preview",
  "messages": [
    { "role": "system", "content": "Voce e um diretor de arte..." },
    { "role": "user", "content": "Transforme: [descricao bruta]" }
  ]
}
```

### Chamada Lovable AI Gateway (Imagem)
```text
POST https://ai.gateway.lovable.dev/v1/chat/completions
Authorization: Bearer LOVABLE_API_KEY
{
  "model": "google/gemini-3-pro-image-preview",
  "messages": [{ "role": "user", "content": [...parts...] }],
  "modalities": ["image", "text"]
}
```

### Fluxo Completo
```text
Usuario preenche formulario
        |
        v
Frontend envia brandId, themeId, personaId + descricao + vibe + tipografia
        |
        v
Backend busca dados completos (brand, theme, persona, perfil politico)
        |
        v
Step 1: Gemini Flash enriquece a descricao -> scene_description rica
        |
        v
Step 2: Monta prompt estruturado de "Diretor de Arte Digital"
        |
        v
Step 3: Gemini 3 Pro Image Preview gera a imagem
        |
        v
Upload para storage + salvar acao + deduzir creditos
```

### Tratamento de Erros
- Rate limit (429) e payment required (402) da Lovable AI Gateway
- Fallback: se enriquecimento falhar, usar descricao original
- Retry 3x na geracao de imagem

