

# Trocar "linhas vermelhas" por "temas sensíveis"

Renomear todas as ocorrências visíveis ao usuário e nos prompts internos de IA de "linhas vermelhas" para "temas sensíveis". O campo no banco (`red_lines`) permanece inalterado para evitar migração desnecessária.

## Arquivos a editar (8 arquivos, ~15 pontos de alteração)

### Frontend (UI visível)
1. **`src/components/dashboard/DashboardProfileModal.tsx`** — linhas 343, 346: título e comentário do step
2. **`src/components/dashboard/PoliticalProfileBanner.tsx`** — linha 269: label "Linhas vermelhas" → "Temas sensíveis"

### Backend (prompts de IA)
3. **`supabase/functions/_shared/politicalProfile.ts`** — linha 73: `LINHAS VERMELHAS (RESTRIÇÕES ABSOLUTAS)` → `TEMAS SENSÍVEIS (RESTRIÇÕES ABSOLUTAS)` e texto descritivo
4. **`supabase/functions/generate-text/index.ts`** — linha 151: "linhas vermelhas do candidato" → "temas sensíveis do candidato"
5. **`supabase/functions/generate-campaign/index.ts`** — linha 125: idem
6. **`supabase/functions/fake-news-respond/index.ts`** — linha 85: idem
7. **`supabase/functions/analyze-repercussion/index.ts`** — linha 69: `LINHAS VERMELHAS` → `TEMAS SENSÍVEIS`

### Documentação
8. **`public/docs/IMAGE_PIPELINE_DOCUMENTATION.md`** — ~5 ocorrências: atualizar todas

