

## Correção: Sala de Crise - Erro de Boot

**Problema**: A edge function `analyze-crisis` falha ao iniciar porque importa funções com nomes errados dos módulos compartilhados.

**Erros encontrados**:
1. Importa `deductCredits` de `userCredits.ts` -- o nome correto e `deductUserCredits`
2. Importa `searchNews` de `newsapi.ts` -- o nome correto e `fetchNewsArticles`
3. A logica de deducao de creditos usa `deductCredits(supabase, profile.team_id, ...)` (API antiga baseada em teams) em vez de `deductUserCredits(supabase, user.id, ...)` (API atual baseada em usuario)

**Correcao no arquivo** `supabase/functions/analyze-crisis/index.ts`:

1. Corrigir imports:
   - `deductCredits` para `deductUserCredits`
   - `searchNews` para `fetchNewsArticles`

2. Atualizar logica de creditos:
   - Buscar creditos do usuario via `profiles.credits` em vez de `teams.credits`
   - Usar `deductUserCredits(supabase, user.id, amount)` para deduzir
   - Atualizar `recordCreditUsage` com os campos corretos (`creditsBefore`, `creditsAfter`)

3. Atualizar chamada de busca de noticias:
   - `searchNews(subject, 5)` para `fetchNewsArticles(subject, { pageSize: 5 })`

**Resultado**: A edge function vai compilar e funcionar corretamente.
