# Entrega iOS — estado atual em 21/10/2026

Implementação por **Claude Opus 5.5**, sem subagentes; revisão, publicação web e conferência física pelo coordenador. App **FSY RP2**, bundle `br.com.fsyrp2.app`, SwiftUI iOS 17+, tema **Alegrar-se em Cristo**. Usa o mesmo projeto Supabase e as mesmas contas do [site](https://fsy-event-app.vercel.app).

## Administração nativa

O painel abre pela navegação SwiftUI de Início ou Perfil. Não usa WebKit, Safari ou sessão web para administrar a sessão. A ponte intermediária `/api/auth/native-session` foi removida em **df9e30d** após a orientação explícita do usuário.

| Módulo | Ações implementadas em SwiftUI |
| --- | --- |
| Visão geral | Contagens de participantes, quartos, companhias, consultores, fichas, comunicados e mídia |
| Contas e usuários | Busca, filtros, paginação, detalhe/histórico; editar dados/cargo, suspender/reativar, excluir com confirmação, senha, recuperação e e-mail conforme permissões do servidor |
| Companhias | Criar/editar/excluir, nome/lema/cor e vínculo de consultores |
| Programação | Criar/editar/excluir, dias 0–5, horários, local, categoria, descrição e destaque |
| Logística e ônibus | Criar/editar/excluir, motorista, telefone, lotação, horários, observações e status |
| Comunicados | Criar/editar/excluir, prioridade, categoria e companhia destinatária |
| Fotos e mídia | Gerenciar registros de mídia, links do Drive, miniatura, categoria e visibilidade |
| Saúde e atendimentos | Fichas, contatos e observações; agendamentos, alteração de situação e exclusão |
| Inclusão | Criar acompanhamento, fases/contatos/plano, entrevistas, decisão confirmada, arquivar e reabrir com histórico e controle de versão |
| Auditoria dos consultores | Consulta, busca, filtro por companhia e detalhe |

Logística, Coordenação e Casal Diretor recebem todos os módulos. Consultor recebe Comunicados; Mídia recebe Fotos e mídia; Médico recebe Saúde e Inclusão. Jovens não recebem módulos administrativos. A lista nativa organiza a navegação; **cada leitura e escrita é autorizada novamente no servidor**.

## Dados e sincronização

- `PortalAPI.swift` chama as mesmas rotas `/api/...` do site com o access token no cabeçalho Authorization. Sessão de autenticação no Keychain; renovação compartilhada entre requisições, sem cookies ou credenciais em URL/log.
- O servidor valida o token no Supabase Auth e consulta cargo, companhia e suspensão no perfil protegido a cada requisição. Authorization inválida, inclusive vazia, não recorre a outra sessão de cookie. As contas do site continuam usando cookies normalmente.
- As escritas só mostram sucesso após resposta do servidor. Listas e dados relacionados são recarregados após salvar. Atualização manual, ao voltar ao primeiro plano e a cada **60 segundos na tela administrativa ativa**. Não é Supabase Realtime; uma página web já aberta segue seu próprio mecanismo de atualização.
- Formulários mantêm o rascunho quando a lista atualiza; uma resposta antiga não substitui uma leitura mais recente. Inclusão envia a versão do caso e preserva a recusa de conflito 409.
- Dados administrativos, contas e saúde ficam apenas na memória das telas, sem cache persistente ou fila de escrita offline. As APIs respondem `private, no-store` e variam por Cookie e Authorization. Chaves de servidor permanecem no servidor; nenhuma alteração de RLS ou migração foi necessária.

## Instagram e identidade visual

Galeria SwiftUI acessível em Início e Perfil: seis publicações reais recebidas do feed público, grade com miniaturas, detalhe com zoom, legendas expansíveis e links. Vídeos usam a capa; assistir ao vídeo e ver todas as imagens de carrosséis abre a publicação original no Instagram. Gerenciamento administrativo de mídia é um módulo separado.

Fundo vetorial geométrico nas cores FSY: discos, arcos, flâmulas, traços e pontos, com arranjos por aba. A troca de abas reorganiza as formas; não há animação contínua ou timer decorativo. Reduzir Movimento mantém a composição estática. Cartões tocáveis têm retorno visual e tátil; imagens usam transição de zoom compatível com a versão do iOS. Logo e templo preservam suas cores e superfície limpa.

## Verificação

- **69/69 testes nativos** de lógica/contratos passaram, incluindo fuso de São Paulo, cargos/módulos, modelos de API, nulos explícitos, erros e ordenação das respostas assíncronas.
- Build assinado serial `-jobs 1`: sucesso, sem erros ou avisos. Instalação por cima preserva a sessão Google existente. Não foi usado simulador.
- **156/156 testes web**, lint, tipos, auditoria de dependências, build e QA visual passaram no [CI 39534915761](https://github.com/alxgoes/fsy-event-app/actions/runs/39534915761), commit **df9e30d**.
- Backend publicado em produção: deployment GitHub **7216515468**, SHA df9e30d, sucesso. `/api/admin/overview` com Authorization inválida devolveu 401 e `private, no-store`.
- **Observado no iPhone SE físico:** sessão preservada; entrada no painel SwiftUI; contagens reais de 1 participante, 4 companhias, 0 fichas e 4 registros de mídia; Logística vazia com atualização registrada; abertura de “Novo ônibus” com Salvar desabilitado quando vazio; cancelamento sem escrita. O humano ajudou a rolar a tela pelo espelhamento.
- **Instagram observado no aparelho:** grade real, abertura do detalhe, imagem e zoom por toque duplo. Fundo geométrico observado em Início, Perfil, painel, Logística e galeria, no modo escuro.
- Não foram executadas mutações em dados reais, envios de e-mail, exclusões ou decisões de saúde como QA. As demais telas/formulários foram compiladas e revisadas; não se afirma exercício físico de todas as operações. Claro, VoiceOver, Texto Maior e Reduzir Movimento ainda precisam de exercício no aparelho.

Evidências sem tokens, contas ou conteúdo clínico: [pasta de 21/10](evidencias-2026-10-21/README.md). A revisão final de inclusão e contraste do rodapé foi compilada sem erros/avisos e instalada por cima às 00h06, preservando a sessão. No novo cold start: perfil, avisos, curtidas e agenda responderam 200; 82 atividades e seis publicações de Instagram foram recebidas. O rodapé com superfície opaca foi revisado em código, sem nova captura própria após a instalação.

## Ambiente e limites restantes

Xcode 26.3 em `/Users/alexgoes/Downloads/Xcode.app`, SDK iOS 26.2. iPhone SE conectado, CoreDevice `9D90349B-28C9-5857-BAD2-7D0CC6198B2F`, iOS 26.6.1. Personal Team `K4A892MU5J`; perfil de desenvolvimento com validade registrada até 28/10/2026. `ios/Config/Local.xcconfig` é local e ignorado, com somente chave publicável e configuração de assinatura.

Google PKCE retorna em `fsyrp2://auth-callback`, já autorizado no Supabase e testado pelo humano. O provedor Google permanece em modo Teste. Notificações atuais são lembretes locais; APNs e Supabase Realtime não estão implementados. Widgets dependem de App Group/Team compatível; com o Team gratuito mostram “Abra o app”. Curtidas de avisos continuam em modo de leitura na interface nativa.

Abrir, compilar e roteiro: [README](README.md). Contratos e integrações: [CONTRATO-WEB](CONTRATO-WEB.md).
