# Diretrizes de Orquestração Multi-Agente — FSY Sessão Ribeirão Preto 2

Este documento estabelece as regras de governança, divisão de responsabilidades e padrões de colaboração para múltiplos agentes de IA trabalhando simultaneamente ou sequencialmente neste repositório.

---

## 1. O Time de Agentes e Especialidades

Cada agente possui um domínio estrito de atuação para evitar conflitos de código e regressões.

| Agente / Especialista | Skill / Gatilho | Foco de Atuação | Escopo de Arquivos |
| :--- | :--- | :--- | :--- |
| **Lead Orchestrator** | Padrão (Sem skill) | Planejamento, decomposição de tarefas e integração | `implementation_plan.md`, `walkthrough.md` |
| **Frontend & UI/UX** | `@impeccable` | Design system, Tailwind, acessibilidade visual e micro-interações | `src/components/ui/`, `src/components/layout/`, `src/app/**/*.tsx`, `src/app/globals.css` |
| **Backend & Dados** | `@fsy-backend` | APIs, schemas de validação, integração de dados e segurança | `src/app/api/`, `src/lib/`, `src/types/`, server actions |
| **QA & Confiabilidade** | `@fsy-qa` | Verificação estática, testes unitários/E2E, auditoria WCAG e lint | `tests/`, `scripts/`, `package.json`, verificação de builds |
| **Domínio FSY 2027** | `@fsy-domain` | Regras de negócio do FSY (escalas, fichas médicas, conselheiros, companhias) | Regras de negócio em `src/`, documentações de fluxo |

---

## 2. Regras de Ouro da Convivência Multi-Agente

### Regra 1: Abordagem "Contract-First" (Tipagem Prévia)
- Nenhuma funcionalidade que envolva Frontend e Backend deve ser iniciada sem que os tipos e contratos estejam definidos em `src/types/`.
- O agente de Backend define os schemas (ex: Zod / TypeScript) e interfaces primeiro. O agente de Frontend consome essas interfaces sem presumir estruturas arbitrárias.

### Regra 2: Fronteira Estrita de Arquivos (Evitar Conflitos)
- Dois agentes **nunca** devem modificar os mesmos arquivos em tarefas simultâneas.
- Se o Agente Frontend estiver refatorando um componente visual (ex: `src/components/admin/MedicalDashboard.tsx`), o Agente Backend deve concentrar as alterações de dados em `src/lib/` ou nas rotas de API correspondentes.

### Regra 3: Protocolo de Validação Obrigatória
Antes de qualquer agente declarar uma tarefa como concluída, ele é obrigado a executar:
1. `npm run lint` — Garantir zero erros de lint e formatação.
2. `npm run build` (quando aplicável) — Garantir integridade de tipagem estrita no TypeScript.
3. Se um agente introduzir um erro em arquivo fora de seu domínio, deve reverter ou sinalizar explicitamente ao Orquestrador.

### Regra 4: Idioma e Acessibilidade
- O idioma oficial da interface para o usuário final é **Português do Brasil (`pt-BR`)**.
- Mensagens de tela, `aria-label`, tooltips e textos de leitores de tela (`sr-only`) devem estar sempre em `pt-BR`.
- Componentes interativos devem garantir alvos de toque de no mínimo **44×44px** para suporte mobile conforme `DESIGN.md`.

---

## 3. Fluxo de Trabalho Recomendado

1. **Definir a Demanda com o Orquestrador**: Inicie uma conversa geral para estruturar a tarefa.
2. **Dividir em Pacotes de Trabalho Independentes**:
   - Pacote A: Banco de dados / API (delegado a `@fsy-backend`)
   - Pacote B: Interface / Telas (delegado a `@impeccable`)
   - Pacote C: Testes e Auditoria (delegado a `@fsy-qa`)
3. **Auditoria de Entrega**: Ao final de cada ciclo, execute `/impeccable audit` para garantir que o código mantém a nota máxima de integridade e usabilidade.
