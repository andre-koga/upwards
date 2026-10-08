import type { FeatureRelease } from "./feature-releases";

/**
 * Portuguese (Brazil) text for each What's New entry, keyed by the English
 * entry's id. A test fails when a release has no translation or the bullet and
 * fix counts differ, so a new entry cannot ship in English only.
 */
export interface ReleaseText {
  title: string;
  bullets: string[];
  fixes?: string[];
}

export const FEATURE_RELEASES_PT: Record<string, ReleaseText> = {
  "2026-10-08-sign-in-required": {
    title: "Entre para usar o Upwards",
    bullets: [
      "O Upwards agora abre numa tela de login, então seus dias, diário e hábitos ficam sempre salvos na sua conta e acompanham você em todos os dispositivos.",
      "Depois de entrar, tudo continua funcionando offline e sincroniza quando você voltar a ficar online. O primeiro login em um dispositivo novo precisa de conexão.",
      "Se um dispositivo ainda guarda dados de antes de você ter uma conta, você pode salvar um backup deles antes de escolher entre enviá-los ou substituí-los pelos dados da sua conta.",
    ],
  },
  "2026-10-08-routines-and-timers": {
    title: "Rotinas, e cronômetros só onde fazem sentido",
    bullets: [
      "Os memos recorrentes agora são rotinas: atividades comuns que você marca a cada dia, num grupo Rotinas que você pode renomear. As que você já tinha foram convertidas para você.",
      "Cada atividade tem uma chave Marcar tempo. Desative para o que você só marca como feito, como remédios, e o cronômetro some.",
      "Atividades que você arquiva ou exclui continuam nos dias em que você as usou e desaparecem a partir do dia seguinte.",
      "As sessões não pertencem mais a um único dia, então uma que passa da meia-noite aparece nos dois dias.",
    ],
    fixes: [
      "Cronômetros esquecidos ligados por mais de um dia foram encerrados após uma hora, então não somam mais horas a todos os dias.",
      "Restaurar um backup de antes desta mudança agora o converte da mesma forma.",
    ],
  },
  "2026-10-07-your-birthday": {
    title: "Seu aniversário no diário",
    bullets: [
      "Adicione seu aniversário em Configurações e ele aparece no seu diário todo ano, como um feriado, com a sua idade.",
      "Só você vê. Ele não é compartilhado com ninguém nem enviado para a IA.",
      "Se seu aniversário é em 29 de fevereiro, ele aparece em 28 de fevereiro nos anos sem dia bissexto.",
    ],
  },
  "2026-10-06-holiday-calendars": {
    title: "Feriados do lugar onde você está",
    bullets: [
      "Escolha em Configurações quais feriados aparecem no seu diário: os dos Estados Unidos, do Brasil ou um conjunto de celebrações do mundo todo.",
      "O conjunto mundial inclui Ano Novo Lunar, Holi, Ramadã, Eid, Diwali, Hanucá, Páscoa e Dia dos Mortos.",
      "Os feriados seguem os calendários que você escolher, não o seu idioma, então você pode ler em português e seguir o calendário dos EUA, ou o contrário.",
      "Os banners de mês agora podem acompanhar as estações de onde você mora, então dezembro mostra verão no Hemisfério Sul.",
    ],
  },
  "2026-10-06-clip-format": {
    title: "Clipes diários em um só formato",
    bullets: [
      "Os novos clipes diários são salvos como vídeos MP4 padrão, então tocam igual em qualquer celular e navegador.",
      "Vídeos longos são cortados nos primeiros 10 segundos.",
      "Se o seu navegador não consegue criar clipes, o Upwards explica o motivo em vez de falhar em silêncio. Suas fotos e clipes existentes não são afetados.",
    ],
  },
  "2026-10-06-privacy-opt-ins": {
    title: "Você escolhe o que fica ligado",
    bullets: [
      "As Configurações têm uma nova seção Privacidade e extras com duas chaves: adicionar minha localização automaticamente e o clipe diário.",
      "A localização automática fica desligada até você ligar, e o Upwards nunca pergunta ao seu dispositivo onde você está enquanto ela estiver desligada.",
      "Desligue o clipe diário e a opção de vídeo, o filtro de vídeo e as prévias de vídeo desaparecem. Os clipes que você já gravou são mantidos.",
      "As duas escolhas acompanham a sua conta, então valem também nos seus outros dispositivos.",
    ],
    fixes: [
      "Outras pessoas não conseguem mais ler as configurações do seu perfil.",
    ],
  },
  "2026-10-05-edit-any-day": {
    title: "Edite qualquer dia",
    bullets: [
      "Todos os dias agora são editáveis, incluindo entradas do diário, contagens de hábitos e sessões de mais de uma semana atrás.",
      "Alterar um dia com mais de 7 dias pede confirmação antes e mostra o que vai mudar.",
      "Quando você reescreve um dia mais antigo do diário, a versão anterior é guardada para que nada se perca.",
      "A sequência do diário conta todos os dias concluídos, então preencher um dia esquecido traz a sequência de volta.",
    ],
    fixes: [
      "As fotos que você remove de um dia antigo do diário são mantidas se uma versão anterior ainda as usa.",
    ],
  },
  "2026-10-02-midnight-days": {
    title: "Os dias terminam à meia-noite",
    bullets: [
      "A configuração de reinício do dia saiu. Um dia agora vai da meia-noite à meia-noite, então tudo o que você faz entre 00:00 e 04:00 pertence ao novo dia. Para registrar algo de madrugada no dia anterior, abra o dia anterior e adicione lá.",
      'Uma sessão que atravessa a meia-noite aparece nos dois dias com a nota "do dia anterior" ou "continua no dia seguinte", e cada dia conta só a sua parte do tempo.',
      "O cronômetro em andamento sempre mostra o tempo total decorrido da sessão.",
    ],
  },
  "2026-10-02-simpler-settings": {
    title: "Um app mais tranquilo",
    bullets: [
      "As paletas de cores saíram. A aparência agora é Sistema, Claro ou Escuro.",
      "A citação no fim de Hoje e os fundos coloridos das entradas favoritadas do diário saíram.",
      "Os registros de erros e o link do GitHub passaram do menu Mais para Configurações › Sobre.",
      "Uma sessão é um intervalo com início e fim ou um único horário de conclusão. Não dá mais para transformar uma na outra, e as entradas manuais precisam de início e fim.",
    ],
  },
  "2026-10-02-backup": {
    title: "Backup e restauração",
    bullets: [
      "Baixe em Configurações um backup de tudo o que você registrou: só os dados, os dados com fotos ou os seus clipes diários, um ano de cada vez.",
      "Restaurar um backup adiciona o que falta e nunca conta a mesma coisa duas vezes, mesmo que você o restaure de novo.",
      "Quando uma entrada do diário no backup é diferente da que você tem, as duas versões esperam na página Problemas de sincronização para você escolher.",
      "A sua chave de IA nunca é incluída em um backup.",
    ],
    fixes: [
      "As escolhas que você faz na página Problemas de sincronização agora chegam aos seus outros dispositivos.",
    ],
  },
  "2026-10-02-update-required": {
    title: "Atualizações do app mais seguras",
    bullets: [
      "Quando é preciso uma versão mais nova do Upwards para continuar sincronizando, o app pede que você atualize em vez de falhar em silêncio.",
      "As alterações feitas antes de atualizar ficam no seu dispositivo e são enviadas assim que a nova versão abrir.",
    ],
    fixes: [
      "Seus outros dispositivos agora aparecem na lista de dispositivos da página Problemas de sincronização.",
    ],
  },
  "2026-09-11-memories": {
    title: "Memórias",
    bullets: [
      "Guarde momentos do passado fora do diário diário — abra Memórias no menu Mais para registrar o que você lembra e quando aconteceu, com as suas palavras.",
      'Adicione um rótulo de tempo livre como "verão passado" ou "quando eu era criança" em vez de escolher uma data exata.',
      "Anexe fotos e busque suas memórias por texto ou rótulo de tempo.",
      "Mova uma memória para a lixeira para escondê-la, depois restaure ou exclua de vez na seção da lixeira.",
      "As Configurações foram para a lista do menu Mais, para que Diário e Memórias ganhem destaque na grade do rodapé.",
    ],
    fixes: [
      "A pílula de status da sincronização agora fica no canto superior direito.",
      "Os cartões de memória usam ícones compactos de editar e lixeira alinhados ao rótulo de tempo.",
    ],
  },
  "2026-09-04-installed-app-polish": {
    title: "Acabamento do app instalado",
    bullets: [
      "O app Android instalado agora abre em tela cheia e mantém visíveis as barras de status e de navegação do sistema.",
      "As barras do sistema acompanham o seu tema claro ou escuro em vez de ficarem presas na cor errada.",
    ],
    fixes: [
      "As conclusões sem cronômetro mantêm o horário na linha do tempo depois de recarregar.",
      "Os detalhes da sessão salvam corretamente quando você adiciona ou remove horários de uma conclusão sem cronômetro.",
      "A sincronização não perde mais entradas do diário nem contagens de hábitos ao usar vários dispositivos.",
      "Marcar um hábito registra o horário da conclusão como horário de fim, então os detalhes da sessão abrem com valores sensatos.",
      "Os hábitos Nunca agora aparecem na linha do tempo quando você registra um deslize.",
    ],
  },
  "2026-08-25-untimed-completion-time": {
    title: "Horário de conclusão na linha do tempo",
    bullets: [
      "As conclusões sem cronômetro mostram a hora do dia numa pílula de relógio, com AM ou PM para não serem confundidas com uma duração.",
      "Abrir uma sessão preenche início e fim com o horário da conclusão para você poder editá-los.",
    ],
    fixes: [
      "Marcar um hábito não adiciona mais uma linha duplicada na linha do tempo a cada recarga.",
    ],
  },
  "2026-08-24-untimed-completions": {
    title: "Conclusões na linha do tempo",
    bullets: [
      "Marcar um hábito o adiciona à linha do tempo mesmo que você não tenha cronometrado.",
      "Deixe início e fim em branco quando a duração não importa — você ainda pode adicionar uma nota.",
      "As notas da linha do tempo quebram linha para você ler tudo o que escreveu.",
    ],
    fixes: ["As notas de sessão na linha do tempo estavam cortadas."],
  },
  "2026-08-23-session-notes": {
    title: "Notas nos registros de tempo",
    bullets: [
      "Início e fim ficam lado a lado quando você adiciona ou edita uma sessão.",
      "Adicione uma nota curta (até 200 caracteres). Ela aparece em texto pequeno abaixo da sessão na linha do tempo.",
    ],
  },
  "2026-08-21-simpler-habits": {
    title: "Edição e arquivo de hábitos mais simples",
    bullets: [
      'Mude o cronograma ou as regras de um hábito e vale na hora — sem a opção "a partir de hoje".',
      "Arquive um hábito pela tela de edição. Os hábitos arquivados ficam no fim do grupo, e você pode desarquivá-los ou excluí-los de lá.",
    ],
  },
  "2026-08-16-simpler-home": {
    title: "Um início mais simples",
    bullets: [
      "Estatísticas, amigos e o sino de notificações saíram — o app agora é só o seu dia, o diário e as configurações.",
      "Toque no nome de um hábito para editá-lo. Concluir um hábito ainda mostra a sequência no ícone de marcar.",
    ],
  },
  "2026-08-02-journal-search-places-icon": {
    title: "Encontre dias por mapa, filtros e datas",
    bullets: [
      "Abra o globo ao lado da busca do diário para ver onde você escreveu — toque num pino para ir àquele dia, ou num grupo numerado para mostrar só esses dias.",
      "Filtre o arquivo com chips para dias favoritados, fotos, vídeo e lugares.",
      "Use o chip Datas para um ano, Este mês, Últimos 30/90 dias ou um intervalo personalizado no calendário.",
      "Anexe até 8 fotos num dia (eram 5).",
      "Os lugares são um conjunto sem ordem para o dia — adicione por busca ou detecção automática, depois abra o mapa em tela cheia para mover e dar zoom.",
      "O ícone do app é o traço verde sobre fundo transparente — chega de quadrado preto.",
    ],
    fixes: [
      "Lugares duplicados no mesmo dia não se empilham mais.",
      "Os itens em Aguardando sincronização somem depois de uma sincronização bem-sucedida.",
    ],
  },
  "2026-07-17-theme-aware-chrome-journal-polish": {
    title: "Barras que seguem o tema e acabamento do diário",
    bullets: [
      "No app de celular instalado, as barras de cima e de baixo acompanham o seu tema.",
      "As entradas do diário mostram a mídia em cima, o número do dia ao lado do texto e as fotos numa grade.",
      "Banners de mês com imagens sazonais (e banners de feriados) marcam o feed do diário conforme você rola.",
    ],
  },
  "2026-07-17-journal-archive": {
    title: "Arquivo do diário",
    bullets: [
      "Abra o Diário pelo menu para percorrer todos os dias que você escreveu — emoji, texto, fotos e vídeo numa só linha do tempo.",
      "Busque por palavras, emoji, lugares ou datas e vá direto a qualquer dia tocando nele.",
    ],
  },
  "2026-06-28-recurring-memos": {
    title: "Memos recorrentes",
    bullets: [
      "Faça os memos se repetirem num cronograma e eles aparecem na sua lista automaticamente quando vencem.",
    ],
  },
  "2026-06-27-stats-refined": {
    title: "Estatísticas, refinadas",
    bullets: [
      "Os gráficos de hora do dia agora empilham por atividade (num grupo) ou por grupo (na visão geral), para você ver o que preencheu cada hora em vez de uma barra única.",
      "Grupos e atividades ficam logo abaixo do mapa de calor de 90 dias, com minigráficos, tempo registrado e conclusão num relance.",
      "Os dias de descanso aparecem nos minigráficos com uma pequena marca âmbar na base de cada dia.",
      "Toque numa linha de grupo ou atividade para detalhar — uma seta mostra o caminho.",
    ],
    fixes: [
      "Os minigráficos de grupo agora contam os hábitos Nunca na conclusão.",
      "Os dias de descanso no mapa de calor geral mostram a sua taxa real de conclusão, não 100% por padrão.",
      "Os dias de descanso no mapa de calor da atividade usam o mesmo estilo âmbar dos dias de folga.",
    ],
  },
  "2026-06-23-habit-stats-rebuilt": {
    title: "Estatísticas de hábitos, reconstruídas",
    bullets: [
      "A página de Estatísticas é o seu centro de desempenho — conclusão semanal, sequências, um mapa de calor de 90 dias e para onde vai o seu tempo por grupo.",
      "Abra qualquer grupo para comparar hábitos com minigráficos e tendências, depois entre num hábito para ver histórico de sessões, recordes e padrões.",
      "Toque num grupo em Projetos para espiar as estatísticas dele sem sair do seu dia.",
      "Cada hábito tem uma pontuação composta que sobe com vitórias e cai com falhas — um número que mede o ritmo de verdade.",
      "Os gráficos de hora do dia mostram quando você costuma trabalhar nos hábitos, da visão geral até um único hábito.",
      "As tendências mensais de conclusão mostram o último ano — no total e por grupo numa só visão.",
      "O mapa de calor de 90 dias ficou mais claro: vitórias cheias, falhas contornadas, descansos tracejados e dias de folga esmaecidos.",
    ],
    fixes: [
      "Os hábitos Nunca não mostram mais dias de descanso no mapa de calor.",
    ],
  },
  "2026-06-10-activity-stats-smarter-day-boundary": {
    title: "Estatísticas de atividade e um limite de dia mais inteligente",
    bullets: [
      "Toque em qualquer hábito para ver as estatísticas dele: sequências, um mapa de calor de 90 dias e um gráfico por dia da semana.",
      "As estatísticas se adaptam ao tipo de hábito — cronômetros mostram a duração das sessões, hábitos de marcar mostram a taxa de sucesso e hábitos Nunca mostram dias limpos.",
      "As configurações de um hábito ou grupo foram para um ícone de engrenagem — tocar na própria pílula agora abre as estatísticas.",
    ],
    fixes: [
      "Hábitos criados depois da meia-noite (mas antes do horário de reinício do dia) agora aparecem corretamente em Para hoje.",
      "As sequências não voltam mais a 0 quando você conclui um hábito depois da meia-noite mas antes do reinício do dia.",
      "O seletor de data nas entradas manuais de tempo não permite mais escolher amanhã quando o relógio passou da meia-noite mas ainda não chegou ao horário de reinício.",
      "O calendário principal (navegação por dia) e todos os outros seletores de data agora destacam o hoje lógico correto com base no seu horário de reinício.",
      "Deslizar para o dia seguinte é bloqueado no hoje lógico correto, não na data do relógio.",
      "O botão Hoje no rodapé identifica corretamente o dia lógico atual.",
      "Os rótulos de vencimento em tarefas avulsas ('Hoje', 'Ontem') agora seguem o seu horário de reinício.",
      "Marcar um hábito como concluído pela gaveta de Projetos agora o registra no dia lógico correto.",
    ],
  },
  "2026-06-05-archive-memos-error-logs": {
    title: "Arquivar memos e registros de erros",
    bullets: [
      "Arquive memos que você quer esconder sem excluir — clique no ícone de arquivo ao lado do título Memos para ver e restaurar os arquivados.",
      "Restaure ou exclua de vez memos arquivados num diálogo compacto.",
      "A página de registros de erros mostra todos os erros e eventos importantes das últimas 24 horas, limpos automaticamente todo dia.",
      "Acesse os Registros de erros pelo menu Mais para compartilhá-los com o suporte ao investigar problemas.",
      "O horário de reinício do dia agora usa incrementos de 1 hora da meia-noite às 8h, para uma configuração mais simples.",
      "O texto dos memos agora mostra corretamente as quebras de linha, igual ao que você vê no diálogo de edição.",
    ],
    fixes: [
      "Os memos arquivados agora persistem corretamente depois da sincronização.",
      "O estilo da lista de reinício do dia agora combina com a seção de aparência, para manter a consistência.",
    ],
  },
  "2026-06-04-overnight-sessions-smarter-timeline": {
    title: "Sessões noturnas e uma linha do tempo mais inteligente",
    bullets: [
      "Registre sessões que passam da meia-noite — elas aparecem nos dois dias automaticamente.",
      "Adicione ou edite uma sessão com horário de fim antes do início; um aviso diz que ela atravessa dois dias e salva corretamente.",
      "Edite sessões e marque hábitos até 7 dias atrás (antes era só hoje).",
      "O cabeçalho da linha do tempo agora mostra o horário de reinício do seu dia, para você sempre saber quais horas contam.",
      "O botão de data no rodapé mostra o dia da semana.",
      "As entradas manuais de tempo agora começam com uma janela de 5 minutos.",
    ],
    fixes: [
      "Os cronômetros de hábitos agora mostram só o tempo registrado hoje, não a sessão inteira.",
    ],
  },
  "2026-06-02-friends-notifications": {
    title: "Amigos e notificações",
    bullets: [
      "Adicione amigos pelo nome de usuário; a caixa do sino cuida dos pedidos de amizade.",
    ],
    fixes: [
      "Os cronômetros da gaveta de Projetos voltaram a mostrar o tempo total registrado por hábito.",
      "Marque hábitos como feitos pela gaveta de Projetos; eles ficam em Para hoje durante o dia em que você os conclui.",
    ],
  },
  "2026-05-15-new-nav-pinned-memos-group-editing": {
    title: "Nova navegação, memos fixados e edição de grupos mais simples",
    bullets: [
      "O botão de notificações agora é um sino fixo no canto superior direito (só na tela inicial).",
      "Os memos fixados mostram um ícone de alfinete dentro da caixa de seleção, seguindo a lógica visual da seção Para hoje.",
      "Clicar no nome de um grupo ou atividade na gaveta de Projetos abre direto o diálogo de edição — sem página separada.",
      "As estatísticas foram para uma página /stats mais limpa; as rotas antigas /activities foram removidas.",
    ],
    fixes: [
      "O diálogo de navegação entre dias anterior/próximo agora é centralizado.",
      "A página Novidades sempre abre no topo (atualização mais recente primeiro).",
    ],
  },
  "2026-05-14-simpler-groups-clearer-sessions-time-edits": {
    title:
      "Grupos mais simples, sessões mais claras e edições de tempo mais rápidas",
    bullets: [
      "Grupos de atividades e tarefas não usam mais emoji — nomes e cores identificam o grupo.",
      "O seletor de horário em formato de relógio tem atalhos de -5 min e +5 min abaixo dos controles de hora, minuto, segundo e AM/PM.",
      "Grupos e atividades arquivados agora são mais fáceis de gerenciar na visão Arquivo.",
      "Recalcule os contadores de sequência caso haja bugs tocando no ícone de atualizar na visão Hoje, à direita do título Para hoje.",
    ],
    fixes: [
      "Os detalhes da sessão ficaram mais enxutos: escolha a atividade e ajuste só o início e o fim (grupo e data não aparecem mais; a sessão continua pertencendo ao dia original ao salvar).",
      "Os calendários nos diálogos de data têm setas de navegação do mês maiores quando a grade é grande, um visual mais limpo quando hoje também é o dia selecionado, e os dias desativados não ganham mais um fundo cinza de botão preenchido.",
      "As pílulas de grupo têm nomes de acessibilidade mais claros; as confirmações de exclusão e a gaveta de grupos/atividades arquivados foram ajustadas para maior confiabilidade.",
      "As pílulas de atividade em dias somente leitura (por exemplo ao ver as tarefas de outro dia) se alinham visualmente à versão interativa sem layouts duplicados.",
      "Acabamento geral em botões e estados de passar o mouse para que os estados desativado e interativo fiquem mais consistentes no app.",
    ],
  },
  "2026-04-28-smarter-location-tracking-memo-categories": {
    title: "Localização mais inteligente e categorias de memo",
    bullets: [
      "As entradas do diário agora aceitam vários locais num único dia, mantidos na ordem das visitas.",
      "Os locais podem ser revistos e editados num diálogo próprio, Locais visitados.",
      "Adicione, troque e exclua paradas com busca de local e prévia do mapa embutidas.",
      "O chip de local no diário continua clicável mesmo antes de haver algum local, para adicionar locais mais rápido.",
      "Foi adicionado suporte a categorias nos memos, então agora você pode atribuir uma categoria a um memo e filtrar por categoria.",
      "Os memos fixados ficam mais fáceis de achar com um ícone de alfinete em cada cartão.",
    ],
    fixes: [
      "Os cronômetros de transição entre locais foram removidos para simplificar o diário e manter o foco na ordem dos lugares visitados.",
      "O espaçamento e a posição das ações no diálogo de locais foram ajustados para um layout mais consistente.",
      "O diálogo de edição de horário agora tem um layout e espaçamento mais consistentes e passa sozinho ao próximo campo quando o atual é preenchido.",
      "O registro de atividade de 2 ou mais dias atrás não é mais editável.",
    ],
  },
  "2026-04-24-whats-new-feedback": {
    title: "Novidades e Feedback!",
    bullets: [
      "Abra Novidades pelo menu Mais para ver um histórico contínuo de melhorias.",
      "Envie feedback e pedidos de recursos em Mais → Feedback / pedidos.",
    ],
    fixes: [
      "Os diálogos não ficam mais cobertos pelo teclado na tela no celular.",
      "O botão de editar em grupos e atividades permite arquivar.",
      "Os memos excluídos agora são realmente excluídos.",
      "O app não força mais o logout da conta por causa de uma conexão ruim.",
      "As atividades do diário de dias anteriores, somente leitura, agora são exibidas corretamente.",
      "Salva temporariamente as alterações feitas nos diálogos do diário e de tarefa rápida se você clicar fora sem querer.",
    ],
  },
};

/** The text for a release in the given language, falling back to English. */
export function releaseText(
  release: FeatureRelease,
  language: string
): ReleaseText {
  if (language.toLowerCase().startsWith("pt")) {
    const translated = FEATURE_RELEASES_PT[release.id];
    if (translated) return translated;
  }
  return {
    title: release.title,
    bullets: release.bullets,
    fixes: release.fixes,
  };
}
