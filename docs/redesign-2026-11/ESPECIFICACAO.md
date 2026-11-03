# Redesign e simplificação — web app e Android (nov/2026)

Branch: `feat/redesign-simplificacao-2026-11` (a partir de `feat/android-inscricoes-2027`).
Sistema visual: `DESIGN.md` continua sendo a autoridade (paleta 2027, Libre Baskerville + Inter, Gold só na marca).

## Decisões do responsável (02/11/2026)

1. **Navegação igual no site (celular) e no Android:** barra inferior com 4 abas — **Início · Agenda · Avisos · Mais**.
   `Mais` reúne perfil, fotos, aparência, instalar o app e, só para quem tem acesso, Consultor e Gestão.
   No desktop o topo vira uma barra simples (marca, os mesmos 4 destinos, sino, avatar). Saem os mega-menus.
2. **Início do jovem = essencial do dia + fotos:** Agora/A seguir, agenda de hoje resumida, minha companhia
   (nome, conselheiros, quarto, últimos avisos) e uma faixa de fotos em destaque. Instagram e "Tema do dia"
   saem do Início (Instagram vai para Fotos; o tema vira uma linha no topo).
3. **Sem cartões personalizáveis** (arrastar/Personalizar/Organizar) em nenhuma tela.
4. **Visual "alegre e limpo":** pergaminho + azul oficial; Sunshine e coral só em destaques; menos selos,
   chips e sombras; tipografia maior; movimento sutil em toque e transições. Fim das sombras duras
   (`shadow-brutal*`, `shadow-tactile-pill`), que o `DESIGN.md` já proíbe.

## Princípios de corte

- Um destino, um nome. Cada página aparece uma vez em cada navegação.
- Nada anunciado que não existe (cards de menu que levam à mesma página com nomes diferentes).
- Estado honesto: carregando ≠ vazio ≠ offline ≠ erro.
- Dados do evento vêm de `src/lib/event/identity.ts` / `EventCalendar.kt`, nunca repetidos à mão.
- Linguagem do produto em pt-BR, sem jargão técnico (Supabase, cache, dashboard, SQL).

## Web — achados que entram neste ciclo

P0
- Id da companhia exibido no lugar do nome (Header, Início, Avisos, Consultor, gestão).
- "Acontecendo agora" falha quando `end_time` é `--`; entre atividades o cartão fica vazio mesmo com a próxima conhecida;
  antes do evento mostra a sessão no lugar do local (Ipê Park Hotel · São José do Rio Preto) e uma atividade fixa no código.
- Tempo-limite de 2 s mostra estados vazios falsos ("Nenhum aviso ainda") enquanto os dados ainda carregam.
- Painel do consultor some inteiro (tela de carregamento) a cada ação e esconde erros.
- Contadores de não lidos divergentes entre sino e página de avisos.

P1
- Mega-menus com 4 itens para `/schedule` e 3 para `/dashboard`; a mesma página com 5 nomes; "Meu Dashboard".
- Agenda sempre abre no Dia 1; deve abrir no dia atual durante o evento.
- Avisos: ~27 ações para 10 mensagens. Fica: Todos / Não lidos, marcar como lido ao abrir, curtir.
- Gestão: navegação triplicada (barra lateral, cartões, menu do perfil); nomes diferentes para o mesmo módulo.
- Jargão: "Supabase Live", "Salvo no Supabase", "Voltar ao Dashboard", "Drive & Murais".

P2
- Cores fora da paleta (#06D6A0, #FFD166, roxos), números em serifa, `font-mono` em horários, alvos de 32 px.
- Modo escuro: cartão "Agora" continua amarelo-claro; ícones claros sobre pílulas brancas.

### Precisa de confirmação (não alterado sem resposta)
- ~~Perfil **logística** consegue abrir Saúde~~ — **decidido em 02/11/2026: manter o acesso** (Logística tem a mesma autoridade da coordenação).
- O sino de equipe baixa todos os atendimentos médicos em toda página.

## Android — achados que entram neste ciclo

P0
- Filtros de categoria da Agenda usam chaves em inglês; banco usa `Espiritual/Atividade/Alimentação/...` → todo filtro vazio e todo item rotulado "Atividade".
- Cadastro envia `unit`, o gatilho do banco lê `stake`.
- Quarto/ônibus/Drive fixados em `null` → "Em definição" sempre.
- Sem cache offline; falha do perfil descarta agenda e avisos já carregados.
- Exclusões na gestão sem confirmação.

P1
- Rotação/tema/fonte do sistema recriam tudo (volta ao Início, perde formulário).
- Token vencido em push e widgets (sem renovação); lembretes atrasados no Doze; horário silencioso suprime lembrete pessoal.
- "Agora/A seguir" congela entre atualizações (sem relógio).
- Instagram de reserva errado (`fsybrasiloficial`); erros em inglês ("invalid_grant").
- Duas linguagens visuais (M3 cru em Galeria/Consultor vs. componentes FSY).

## Fora deste ciclo
- iOS (pausado).
- Mudanças de esquema no Supabase.
- Publicação em produção (Vercel / APK) — só após revisão do responsável.
