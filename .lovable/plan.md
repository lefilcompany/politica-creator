

# Renomear Seções: Partidos → Identidade, Pautas → Agenda, Eleitores → Audiência

## Resumo
Trocar os nomes das 3 seções principais em todo o sistema e garantir que funcionem como links clicaveis nas areas onde aparecem.

## Alterações

### 1. Traduções (`src/lib/translations.ts`)
- `sidebar.brands`: "Partidos" → "Identidade"
- `sidebar.themes`: "Pautas" → "Agenda"
- `sidebar.personas`: "Eleitores" → "Audiência"
- `search.placeholder`: "Pesquisar partidos, pautas, eleitores..." → "Pesquisar identidade, agenda, audiência..."
- `dashboard.brandsManaged`: "Partidos Gerenciados" → "Identidades Gerenciadas"
- `dashboard.totalBrands`: "total de partidos ativos" → "total de identidades ativas"
- `dashboard.managePersonas`: "Gerenciar Eleitores" → "Gerenciar Audiência"
- `dashboard.managePersonasDesc`: atualizar referência a "eleitores" → "audiência"

### 2. Dashboard Stats (`src/components/dashboard/DashboardStats.tsx`)
- "Partidos Ativos" → "Identidades Ativas"
- "Eleitores-Alvo" → "Audiência-Alvo"
- "Pautas Estratégicas" → "Agenda Estratégica"
- Todos os cards ja sao links clicaveis para /brands, /personas, /themes

### 3. Paginas de listagem (titulos internos)
- Verificar e atualizar titulos nas paginas `Brands.tsx`, `Personas.tsx`, `Themes.tsx` para refletir os novos nomes (se houver referências hardcoded a "Partidos", "Eleitores", "Pautas")

---

## Detalhes tecnicos

Arquivos a modificar:
1. `src/lib/translations.ts` -- todas as labels mencionadas acima
2. `src/components/dashboard/DashboardStats.tsx` -- labels dos 3 cards de estatísticas
3. Verificar `src/pages/Brands.tsx`, `src/pages/Personas.tsx`, `src/pages/Themes.tsx` para titulos hardcoded

Nenhuma alteração de banco de dados necessária -- são apenas mudanças de nomenclatura no frontend.

