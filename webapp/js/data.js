/* ============================================================
   IPA — Base metodológica (Abordagem ACP)
   Conteúdo extraído dos documentos oficiais das Fases 1 a 8.
   ============================================================ */

const ACP = {};

/* Estilos e identidade visual (paleta validada p/ acessibilidade) */
ACP.STYLES = {
    A: { key: 'A', nome: 'Centrado na Atenção',      curto: 'Atenção',      cor: '#d9a400', necessidade: 'Autoestima' },
    C: { key: 'C', nome: 'Centrado na Comunicação',  curto: 'Comunicação',  cor: '#e8401a', necessidade: 'Segurança' },
    P: { key: 'P', nome: 'Centrado no Procedimento', curto: 'Procedimento', cor: '#2952cc', necessidade: 'Tratamento justo' },
    E: { key: 'E', nome: 'Equilibrado',              curto: 'Equilibrado',  cor: '#0e9f6e', necessidade: 'Integração das três' }
};

/* Quadros: 12 palavras por momento; cada palavra tem id único,
   estilo e descrições usadas nas Fases 6 e 7 do relatório. */
ACP.QUADROS = [
    {
        id: 1, momento: 'Início do atendimento',
        objetivo: 'estabelecer rapport e empatia, acolhendo o cliente e alinhando expectativas iniciais',
        enfase: 'A',
        enfaseTexto: 'Neste momento inicial a variável Atenção se sobressai, seguida pela Comunicação — o Procedimento se restringe aos trâmites administrativos de registro.',
        palavras: [
            { id: 'Q1_ABERTO',      w: 'ABERTO',      st: 'A', sig: 'Postura receptiva e não defensiva, que sinaliza disponibilidade para a interação e permite que a comunicação flua sem resistências.', risco: 'Postura fechada ou defensiva no primeiro contato reduz a interação e bloqueia o estabelecimento do rapport.' },
            { id: 'Q1_ACOLHEDOR',   w: 'ACOLHEDOR',   st: 'A', sig: 'Recepção com calor humano, que faz o cliente sentir-se bem-vindo e seguro desde o primeiro instante.', risco: 'Uma recepção fria faz o cliente sentir-se "um número", ferindo sua necessidade de autoestima logo na entrada.' },
            { id: 'Q1_ATENCIOSO',   w: 'ATENCIOSO',   st: 'A', sig: 'Interesse genuíno pela pessoa e pela sua necessidade, demonstrado por gestos, olhar e escuta.', risco: 'A falta de atenção é percebida como desinteresse — o pior sentimento que se pode despertar no cliente.' },
            { id: 'Q1_CLARO',       w: 'CLARO',       st: 'C', sig: 'Linguagem simples e compreensível desde o primeiro contato, sem jargões.', risco: 'Falta de clareza inicial gera confusão e insegurança sobre o que vai acontecer.' },
            { id: 'Q1_EXPLICITO',   w: 'EXPLÍCITO',   st: 'C', sig: 'Declara regras, etapas e condições sem ambiguidade, firmando o "contrato psicológico" da relação.', risco: 'Omitir condições e etapas desalinha expectativas e cobra seu preço no término do atendimento.' },
            { id: 'Q1_ENFATICO_C',  w: 'ENFÁTICO',    st: 'C', sig: 'Destaca com energia os pontos essenciais, garantindo que o cliente perceba o que é mais importante.', risco: 'Sem ênfase, informações críticas passam despercebidas pelo cliente.' },
            { id: 'Q1_CONCENTRADO', w: 'CONCENTRADO', st: 'P', sig: 'Foco nos registros e nas informações objetivas necessárias para iniciar o atendimento corretamente.', risco: 'Desatenção aos registros iniciais gera erros cadastrais e retrabalho em todo o ciclo.' },
            { id: 'Q1_FORMAL',      w: 'FORMAL',      st: 'P', sig: 'Cumpre o padrão institucional de recepção, transmitindo seriedade e profissionalismo.', risco: 'Ignorar o padrão institucional fragiliza a imagem de competência; em excesso, a formalidade vira frieza.' },
            { id: 'Q1_IMPESSOAL',   w: 'IMPESSOAL',   st: 'P', sig: 'Trata com isenção e equidade, sem julgamentos ou favoritismos.', risco: 'Levada ao extremo, a impessoalidade é percebida como distanciamento e desumanização.' },
            { id: 'Q1_FLEXIVEL',    w: 'FLEXÍVEL',    st: 'E', sig: 'Ajusta postura, linguagem e ritmo ao perfil de cada cliente, sem rigidez.', risco: 'Usar o mesmo padrão para todos ignora que cada cliente tem necessidades e expectativas próprias.' },
            { id: 'Q1_INTERESSADO', w: 'INTERESSADO', st: 'E', sig: 'Atenção genuína à demanda inicial: pergunta com objetividade e escuta sem interromper.', risco: 'Supor ou julgar a demanda sem ouvir leva a diagnósticos errados do que o cliente precisa.' },
            { id: 'Q1_CORDIAL_E',   w: 'CORDIAL',     st: 'E', sig: 'Gentileza que humaniza a recepção e facilita a cooperação do cliente.', risco: 'A aspereza no primeiro contato cria uma barreira difícil de reverter nos momentos seguintes.' }
        ]
    },
    {
        id: 2, momento: 'Durante o atendimento',
        objetivo: 'executar os procedimentos com competência técnica, mantendo o ouvir ativo e a atenção às reações do cliente',
        enfase: 'P',
        enfaseTexto: 'Neste momento a variável Procedimento assume relativa predominância, mas com presença importante e concomitante da Comunicação e da Atenção.',
        palavras: [
            { id: 'Q2_COMPREENSIVO', w: 'COMPREENSIVO', st: 'A', sig: 'Acolhe as reações emocionais do cliente durante a execução, sem julgamentos.', risco: 'Ignorar as reações emocionais durante a execução transforma o atendimento em linha de produção.' },
            { id: 'Q2_CUIDADOSO',    w: 'CUIDADOSO',    st: 'A', sig: 'Executa com zelo, protegendo o conforto e a dignidade do cliente.', risco: 'A execução sem zelo é percebida pelo cliente mesmo sem conhecimento técnico — e lida como incompetência.' },
            { id: 'Q2_RESPEITOSO',   w: 'RESPEITOSO',   st: 'A', sig: 'Trata o cliente como sujeito soberano da própria história — a salvaguarda contra a "robotização".', risco: 'O desrespeito, ainda que sutil, viola a necessidade de autoestima e é um "pecado mortal" do atendimento.' },
            { id: 'Q2_DESCRITIVO',   w: 'DESCRITIVO',   st: 'C', sig: 'Explica o que está sendo feito de forma visual e pedagógica, mantendo o cliente situado.', risco: 'Sem descrição do que acontece, o cliente fica refém do desconhecido — e o medo cresce no silêncio.' },
            { id: 'Q2_INTERATIVO',   w: 'INTERATIVO',   st: 'C', sig: 'Mantém diálogo bidirecional, envolvendo o cliente no processo.', risco: 'O monólogo técnico exclui o cliente do próprio atendimento e gera sensação de desvalorização.' },
            { id: 'Q2_OUVINTE',      w: 'OUVINTE',      st: 'C', sig: 'Pratica a escuta ativa — a parte mais importante da comunicação — para adequar os procedimentos ao que o cliente traz.', risco: 'Não ouvir é a falha mais comum e mais custosa: perde-se a informação que ajustaria o procedimento à real necessidade.' },
            { id: 'Q2_DISTANTE',     w: 'DISTANTE',     st: 'P', sig: 'Mantém neutralidade emocional para preservar a objetividade técnica da execução.', risco: 'Em excesso, o distanciamento é percebido como frieza; em falta, o envolvimento emocional compromete a técnica.' },
            { id: 'Q2_EFICIENTE',    w: 'EFICIENTE',    st: 'P', sig: 'Executa com qualidade, sem desperdício de tempo ou de recursos.', risco: 'A ineficiência prolonga o desconforto do cliente e corrói a confiança na entrega.' },
            { id: 'Q2_OBJETIVO',     w: 'OBJETIVO',     st: 'P', sig: 'Foca no resultado contratado, sem dispersões.', risco: 'Sem objetividade o atendimento se perde em desvios e o cliente sente que seu tempo não é respeitado.' },
            { id: 'Q2_RAPIDO_E',     w: 'RÁPIDO',       st: 'E', sig: 'Agilidade equilibrada — resolve com presteza sem atropelar qualidade nem relacionamento.', risco: 'A lentidão desnecessária desgasta; a pressa excessiva transmite descaso e insegurança.' },
            { id: 'Q2_PRECISO',      w: 'PRECISO',      st: 'E', sig: 'Exatidão nas ações e nas informações, integrando técnica e comunicação.', risco: 'A imprecisão — no gesto ou na informação — planta a dúvida sobre a competência do profissional.' },
            { id: 'Q2_SOLICITO',     w: 'SOLÍCITO',     st: 'E', sig: 'Disponível para ajudar prontamente, antecipando-se às necessidades.', risco: 'A indisponibilidade percebida faz o cliente desistir de perguntar — e de voltar.' }
        ]
    },
    {
        id: 3, momento: 'Término do atendimento',
        objetivo: 'informar resultados com clareza e verdade, encerrar com polidez e preparar a fidelização',
        enfase: 'C',
        enfaseTexto: 'No momento final a variável Comunicação predomina, seguida pela Atenção — o Procedimento administrativo se faz presente no fechamento e registros.',
        palavras: [
            { id: 'Q3_AUTENTICO',   w: 'AUTÊNTICO',   st: 'A', sig: 'Encerra com verdade e integridade — gestos coerentes com as falas, sem fachadas.', risco: 'A incoerência entre gesto e palavra no fechamento invalida todo o discurso e gera desconfiança.' },
            { id: 'Q3_CORDIAL_A',   w: 'CORDIAL',     st: 'A', sig: 'Despedida calorosa que consolida o vínculo — a "Regra do Pico-Fim": a memória da experiência é marcada pelo final.', risco: 'Um fechamento seco apaga a boa impressão construída ao longo de todo o atendimento.' },
            { id: 'Q3_EMPATICO',    w: 'EMPÁTICO',    st: 'A', sig: 'Reconhece o estado emocional do cliente ao entregar resultados, especialmente notícias difíceis.', risco: 'Entregar resultados sem empatia — sobretudo más notícias — pode transformar o cliente em detrator.' },
            { id: 'Q3_ACESSIVEL',   w: 'ACESSÍVEL',   st: 'C', sig: 'Permanece disponível para dúvidas posteriores; o atendimento só termina quando o objetivo do cliente é atingido.', risco: 'Fechar as portas ao final ("não me procure mais") interrompe a jornada e impede a fidelização.' },
            { id: 'Q3_ELOQUENTE',   w: 'ELOQUENTE',   st: 'C', sig: 'Comunica os resultados com fluência e segurança, transmitindo domínio do que foi feito.', risco: 'Um fechamento hesitante deixa dúvidas sobre o resultado — mesmo quando o serviço foi bem executado.' },
            { id: 'Q3_ESPONTANEO',  w: 'ESPONTÂNEO',  st: 'C', sig: 'Naturalidade que humaniza o desfecho, evitando o encerramento mecânico de script.', risco: 'O fechamento robotizado desfaz a percepção de cuidado construída na relação.' },
            { id: 'Q3_DIRETO',      w: 'DIRETO',      st: 'P', sig: 'Informa o resultado sem rodeios, respeitando o direito do cliente à verdade dos fatos.', risco: 'Rodeios e evasivas no resultado alimentam desconfiança e ansiedade.' },
            { id: 'Q3_PROTOCOLAR',  w: 'PROTOCOLAR',  st: 'P', sig: 'Cumpre as etapas obrigatórias do encerramento: registros, normas e orientações formais.', risco: 'Ignorar etapas obrigatórias, registros ou normas de segurança no encerramento fere a conformidade e o tratamento justo.' },
            { id: 'Q3_RAPIDO_P',    w: 'RÁPIDO',      st: 'P', sig: 'Conclui os trâmites finais com agilidade, sem burocratizar a saída do cliente.', risco: 'Um fechamento administrativo arrastado pode desfazer "a venda" já realizada.' },
            { id: 'Q3_CONSISTENTE', w: 'CONSISTENTE', st: 'E', sig: 'Mantém o mesmo padrão de qualidade do primeiro ao último minuto.', risco: 'A queda de padrão no final revela que o cuidado era protocolo, não valor.' },
            { id: 'Q3_PRESTATIVO',  w: 'PRESTATIVO',  st: 'E', sig: 'Oferece orientações e cuidados pós-atendimento, prolongando o valor entregue.', risco: 'Sem orientações finais, o cliente sai com o serviço feito mas sem saber como sustentar o resultado.' },
            { id: 'Q3_ENFATICO_E',  w: 'ENFÁTICO',    st: 'E', sig: 'Reforça recomendações e próximos passos essenciais para o sucesso pós-atendimento.', risco: 'Recomendações ditas sem ênfase são esquecidas — e o resultado se perde depois da porta.' }
        ]
    }
];

/* ---------- Textos padrão (Fases 1, 2 e 7) ---------- */

ACP.FASE1 = [
    'Os Estilos de Atendimento representam diferentes formas do profissional se relacionar com seus clientes, sejam eles externos ou internos, geralmente para conduzir processos de diferentes modalidades de prestação de serviços.',
    'O Estilo é uma preferência pessoal! Cada profissional tem uma preferência por um determinado Estilo. O Estilo de uma pessoa não é fácil de definir, mas muito fácil de perceber. Ele é formado por um conjunto de atributos que a pessoa apresenta e repete com frequência nos diferentes ambientes em que atua. A maior parte desses atributos são de natureza psicológica e fazem parte do que podemos chamar de sua personalidade.',
    'O estilo não vem estampado na face das pessoas, e você não nasce com ele! Na realidade, os estilos são conhecidos por inferências que fazemos a partir dos comportamentos praticados, principalmente através dos gestos e das falas. Em geral, são necessários vários contatos para que formemos uma imagem deste estilo — e esta imagem pode ser diferente para diferentes pessoas que observam os comportamentos.',
    'Com a identificação do estilo, o profissional pode reconhecer suas preferências, ampliar sua consciência e aprimorar sua atuação para oferecer um atendimento mais completo, eficaz e humanizado, apurado pela pontuação em cada um dos estilos, decorrente de suas escolhas no preenchimento do IPA — Indicador do Perfil de Atendimento.'
];

ACP.FASE2 = [
    'Apresentar o Perfil de Atendimento com base nas pontuações obtidas no IPA.',
    'Gerar consciência comportamental sobre o seu <strong>Estilo Predominante</strong> e suas interações dinâmicas.',
    'Identificar áreas de desenvolvimento e oportunidades de aprimoramento.',
    'Oferecer insights práticos para elevar a qualidade do atendimento e fortalecer a atuação profissional.'
];

/* ---------- Perfis dos estilos (Fase 4) ---------- */

ACP.PERFIS = {
    A: {
        titulo: 'Estilo Centrado na Atenção',
        descricao: [
            'No Estilo Centrado na Atenção, a variável "atenção" assume o papel de lente prioritária, por meio da qual as dimensões de comunicação e procedimento são moduladas e executadas. A postura, o gesto e a consciência tornam-se os eixos primordiais da atuação: é a prática da humanização — atender uma pessoa em sua totalidade física, emocional e social, e não apenas resolver um sintoma ou vender um serviço.',
            'Este estilo tem conexão direta com a necessidade de autoestima do cliente. Garantir e aumentar a autoestima é a chave para uma satisfação duradoura: reforçar o valor da pessoa, reconhecer seu ponto de vista e seus direitos. O rapport, estabelecido principalmente no início do atendimento através do comportamento acolhedor e atencioso, cria o clima de harmonia e confiança em que ambos se sentem à vontade.',
            'A atenção é o componente menos concreto e mais difícil de dominar do atendimento — mas é a variável que transforma um atendimento comum em uma experiência de referência, capaz de gerar lealdade e memórias positivas duradouras.'
        ],
        adequado: 'A atenção dada desperta simpatia e reciprocidade, aproxima psicologicamente e estabelece um relacionamento interpessoal positivo. Clientes atendidos com a devida atenção avaliam muito positivamente o profissional, recomendam-no e desejam ser atendidos por ele novamente — o início da fidelização.',
        inadequado: 'A falta de atenção desperta os piores sentimentos: o cliente sente-se tratado como objeto, sem importância. O excesso também prejudica — o cliente passa a desconfiar de tanto interesse. O risco típico do estilo é o paternalismo e a perda de precisão técnica quando o afeto se sobrepõe ao método.',
        autopoliciamento: 'Evitar o paternalismo e o excesso de envolvimento: desenvolver o equilíbrio entre o afeto e a precisão técnica.',
        comoSecundario: 'atua como o "aquecedor" do estilo principal: garante que a execução não perca o calor humano, suavizando a frieza técnica e protegendo o vínculo com o cliente.'
    },
    C: {
        titulo: 'Estilo Centrado na Comunicação',
        descricao: [
            'O Estilo Centrado na Comunicação coloca o processo comunicativo como o eixo em torno do qual orbitam a atenção e o procedimento. Baseia-se na premissa de que informação é confiança: o profissional atua como mediador de significados, utilizando a palavra — verbal e não verbal — para tornar conscientes as questões levantadas durante a prestação do serviço.',
            'Este estilo atende à necessidade de segurança do cliente: a comunicação eficaz esclarece dúvidas, reduz ansiedades e cria um ambiente emocional seguro. Comunicar, nesse estilo, não é apenas falar: é falar, ouvir, interpretar, ajustar, descrever, perguntar, esclarecer, acolher e orientar — com a escuta ativa como a parte mais importante do processo.',
            'O profissional que domina a "gramática do atendimento" por meio da clareza, da interatividade e da escuta deixa de ser mero executor de tarefas e passa a atuar como arquiteto de experiências humanas significativas e duradouras.'
        ],
        adequado: 'A comunicação bem conduzida transforma a informação objetiva inicial em uma conversa reveladora de necessidades e preocupações, criando confiança e empatia que permitem realizar os procedimentos com assertividade e precisão.',
        inadequado: 'O excesso de informação traz confusão, demora e desconfiança; a falta gera ansiedade e medo do desconhecido. O risco típico do estilo é a prolixidade — comunicar todos os detalhes técnicos acreditando impressionar, sem praticar o ouvir.',
        autopoliciamento: 'Evitar a prolixidade: praticar o ato de ouvir como o ato comunicativo mais poderoso — "calar para ouvir".',
        comoSecundario: 'funciona como o canal de expressão do estilo principal: dá voz e clareza às intenções, alinhando expectativas e reduzindo as ansiedades do cliente ao longo do processo.'
    },
    P: {
        titulo: 'Estilo Centrado no Procedimento',
        descricao: [
            'O profissional que adota este estilo considera o procedimento sua "bíblia de conduta": a correta realização dos protocolos técnicos e administrativos é entendida como a principal variável de um ótimo atendimento. É uma das configurações mais robustas e tecnicamente orientadas — o profissional sente-se seguro e competente porque se preparou, treinou e se habilitou.',
            'Este estilo atende à necessidade de tratamento justo: o uso de protocolos oferece segurança, equidade e conformidade. O foco intenso no "o quê" do serviço garante resolução objetiva, minimiza erros e transmite competência, seriedade e domínio técnico — em áreas críticas, como a saúde, aumenta a confiança do cliente.',
            'A crença subjacente — de que o cliente, por ser leigo, não teria como contribuir com a execução — leva o estilo a tratar atenção e comunicação como variáveis secundárias, expressas apenas através da lente do procedimento.'
        ],
        adequado: 'A eficiência e a concentração minimizam erros técnicos e administrativos; os protocolos garantem segurança jurídica e tratamento equânime; o profissional transmite competência e seriedade.',
        inadequado: 'O exagero na impessoalidade e no distanciamento desumaniza o atendimento: o cliente sente-se tratado como um número ou um objeto. A ausência de rapport viola o contrato psicológico de justiça interpessoal e gera a percepção de atendimento "robótico".',
        autopoliciamento: 'Evitar a rigidez fria: lembrar que tratar bem as pessoas é uma habilidade que se aprimora com a prática — o protocolo resolve o problema, mas é a relação que fideliza a pessoa.',
        comoSecundario: 'dá sustentação técnica ao estilo principal: garante que o calor da relação não comprometa a exatidão, a conformidade e a segurança da entrega.'
    },
    E: {
        titulo: 'Estilo Equilibrado',
        descricao: [
            'O que caracteriza este estilo é o equilíbrio dinâmico: a atuação integrada das três variáveis — atenção, comunicação e procedimento — operando concomitantemente ao longo de todo o atendimento. O profissional dá a devida atenção do início ao término, busca e fornece informações que possibilitam uma interação efetiva e afetiva, e concentra-se na execução dos procedimentos sem se descuidar das reações do cliente.',
            'O pilar do estilo é a coerência entre gesto e palavra: é ela que permite uma percepção esclarecida por parte do cliente. Quando gesto e palavra entram em contradição, provocam dúvida, desconfiança e afastamento — o caminho do detrator.',
            'O Estilo Equilibrado é a referência recomendada pelo modelo — não como prescrição, mas como orientação: nas pesquisas da Abordagem ACP, seu uso está associado aos melhores desempenhos e às melhores avaliações por parte dos clientes. Em geral, sua adoção é fruto de aprendizado, construído sobre a observação cuidadosa de acertos, erros e feedbacks dos próprios clientes.'
        ],
        adequado: 'Orientação clara às necessidades de cada cliente, escuta ativa para identificar desejos e expectativas, redução de ansiedades com informações adequadas e comunicação não verbal que denota importância, dedicação e consideração pela pessoa.',
        inadequado: 'Não foram identificados aspectos inadequados relevantes no estilo em si — o desafio é sustentá-lo: manter a coerência entre gesto e palavra sob pressão e não regredir ao estilo de conforto nas situações difíceis.',
        autopoliciamento: 'Manter a coerência entre gesto e palavra em todas as situações — inclusive sob pressão — e seguir calibrando o uso das três variáveis à situação de cada cliente.',
        comoSecundario: 'atua como modulador do estilo principal: introduz flexibilidade e leitura situacional, aproximando a conduta do padrão de referência do modelo.'
    }
};

/* ---------- Fase 7: recomendações (texto síntese) ---------- */
ACP.FASE7 = {
    padrao: [
        'Ao longo da vida profissional, todos nós adquirimos um "jeito pessoal de atender" — um padrão construído a partir de experiências bem e mal sucedidas. Ter um padrão é bom: garante um comportamento previsível e testado. Mas há uma armadilha: a abordagem se repete e atinge o resultado esperado pelo profissional — nem sempre pelo cliente. Falta uma variável nessa equação: a situação.',
        'Vivemos um mundo marcado pela impermanência. O cliente também está mudando constantemente — ele é um "alvo móvel", com novas necessidades e expectativas a cada contato. Por isso, a chance do estilo preferido sempre corresponder às necessidades do cliente vai se reduzindo com o tempo, principalmente para quem tem preferências acentuadas.',
        'A grande mudança a ser trabalhada é adquirir versatilidade nas formas de atender. Para isso, duas competências complementares precisam ser desenvolvidas: a flexibilidade — lidar com situações complexas, variáveis e imprevistas de forma positiva, mantendo mente e sentimentos abertos, sem julgamentos precipitados — e a adaptação — modificar conscientemente o comportamento habitual para atender às circunstâncias e às necessidades das pessoas, tratando-as do jeito que elas gostam de ser tratadas.'
    ]
};

/* ---------- Critérios qualificadores (Fase 4 / regras) ---------- */
ACP.CRITERIOS = {
    LIMIAR: 15,
    forteApego: (d) => `A diferença de <strong>${d} pontos</strong> entre o estilo predominante e o secundário é igual ou superior a 15 pontos. Isso indica <strong>forte apego</strong> ao estilo predominante: a tendência é manter o seu uso mesmo quando a situação exige mudança, apoiada na crença pessoal de que esta é a melhor forma de atender. Sob pressão, esse apego se traduz em rigidez comportamental — e é exatamente aí que mora o principal foco de desenvolvimento.`,
    flexivel: (d) => `A diferença de <strong>${d} pontos</strong> entre o estilo predominante e o secundário é inferior a 15 pontos. Isso indica <strong>relativa flexibilidade</strong>: a tendência é transitar do primeiro para o segundo estilo sempre que a situação exigir. Não há uma preferência rígida — há o entendimento de que é preciso ajustar a conduta para melhor atender o cliente.`,
    equilibradoNatural: 'Todas as diferenças entre as pontuações dos quatro estilos são menores que 15 pontos. Este é o padrão do <strong>Equilibrado Natural (Adaptativo)</strong>: alta flexibilidade situacional, sem apego a nenhum estilo. Dependendo da percepção do comportamento do cliente e da situação, o profissional adota o estilo que melhor se adequa àquele atendimento — inclusive variando de estilo dentro de um mesmo atendimento.',
    equilibradoModelo: 'O Estilo Equilibrado é a primeira preferência do pesquisado. Nesse caso, as diferenças de pontuação perdem peso crítico: o profissional já se alinha ao padrão de referência do modelo, integrando de maneira fluida as três variáveis do atendimento.'
};


/* ---------- Explicação da premissa dos critérios (Fase 4) ---------- */
ACP.CRITERIOS.premissa = 'Como ler este diagnóstico: o modelo compara as diferenças de pontuação entre os estilos consecutivos. O limiar de <strong>15 pontos</strong> (cerca de 7,5% do total de 198) marca a fronteira entre uma inclinação leve e um padrão rígido de conduta. Diferença igual ou maior que 15 entre a 1ª e a 2ª preferência indica <strong>forte apego</strong> ao estilo predominante — a crença de que aquela é a melhor forma de atender, mantida mesmo quando a situação pede outra conduta. Diferença menor que 15 indica <strong>trânsito natural</strong> entre o primeiro e o segundo estilo. Quando todas as diferenças são menores que 15, o perfil é <strong>Adaptativo (Equilibrado Natural)</strong>. E quando o Estilo Equilibrado é a 1ª preferência, o profissional já se alinha à referência do modelo.';

/* ---------- Autopoliciamento detalhado por estilo (Fase 8) ---------- */
ACP.PERFIS.A.comoFazer = [
    'Antes de agir pelo afeto, pergunte-se: "o que o protocolo pede aqui?" — e cumpra-o antes de personalizar.',
    'Dê um limite de tempo consciente à conversa de acolhimento e faça a transição clara para a execução técnica.',
    'Quando sentir vontade de "resolver pelo cliente", devolva o protagonismo: pergunte o que ele prefere.'
];
ACP.PERFIS.C.comoFazer = [
    'Aplique a regra dos 30 segundos: fale, pare e pergunte — transforme explicação em diálogo.',
    'Antes de detalhar tecnicamente, pergunte ao cliente o quanto ele quer saber.',
    'Pratique o silêncio ativo: ouça até o fim, sem preparar a resposta enquanto o outro fala.'
];
ACP.PERFIS.P.comoFazer = [
    'A cada etapa técnica concluída, faça contato visual e diga uma frase de conexão com o cliente.',
    'Traduza um termo técnico por vez para a linguagem do cliente.',
    'Inclua no seu checklist um item não técnico: "como o cliente está se sentindo agora?".'
];
ACP.PERFIS.E.comoFazer = [
    'Sob pressão, verifique se gesto e palavra continuam coerentes — é o primeiro ponto que cede.',
    'A cada atendimento, reavalie conscientemente qual variável a situação está pedindo mais.',
    'Compartilhe sua prática com colegas — o equilíbrio se sustenta com feedback contínuo.'
];

/* ============================================================
   Detalhamento das 36 palavras (Fases 6 e 7):
   baixo = o que significa a pontuação baixa (0 a 2)
   alto  = o que significa a valorização excessiva (9 a 11)
   A faixa de equilíbrio de referência situa-se entre 4 e 6 pontos.
   ============================================================ */
ACP.DETALHE = {
    /* ---- Q1 · Início ---- */
    Q1_ABERTO:      { baixo: 'você adota uma postura mais reservada ou defensiva no primeiro contato, o que pode bloquear o rapport e travar a fluência da comunicação inicial.',
                      alto: 'a abertura excessiva pode dispersar o foco do atendimento, alongando conversas além do necessário e atrasando os trâmites do início.' },
    Q1_ACOLHEDOR:   { baixo: 'a recepção tende a ser percebida como fria — o cliente sente-se "um número", o que fere a sua necessidade de autoestima logo na entrada.',
                      alto: 'o acolhimento excessivo pode soar invasivo ou artificial (o "sorriso falso"), despertando desconfiança sobre o interesse por trás de tanta cordialidade.' },
    Q1_ATENCIOSO:   { baixo: 'o cliente pode perceber desinteresse pela sua pessoa — o pior sentimento que um atendimento desperta: sentir-se tratado como objeto.',
                      alto: 'o excesso de atenção incomoda com o tempo: o cliente passa a se perguntar que interesse haveria por trás de tanto zelo.' },
    Q1_CLARO:       { baixo: 'as informações iniciais tendem a ficar confusas, gerando insegurança sobre o que vai acontecer e como o serviço será conduzido.',
                      alto: 'a simplificação excessiva pode soar didática demais e infantilizar o cliente, além de alongar desnecessariamente o início.' },
    Q1_EXPLICITO:   { baixo: 'regras, etapas e condições ficam subentendidas; as expectativas desalinham no início e cobram o preço no término do atendimento.',
                      alto: 'o detalhamento excessivo de regras e condições logo na chegada pode intimidar o cliente e burocratizar o acolhimento.' },
    Q1_ENFATICO_C:  { baixo: 'os pontos essenciais do atendimento tendem a passar despercebidos pelo cliente por falta de destaque.',
                      alto: 'a ênfase constante em tudo soa como pressão ou alarme, gerando tensão desnecessária no primeiro contato.' },
    Q1_CONCENTRADO: { baixo: 'a baixa concentração nos procedimentos administrativos do início tem alto potencial de desatenção: erros nos registros obrigatórios e nas anotações sobre necessidades e expectativas, comprometendo as demais etapas do ciclo e gerando retrabalho.',
                      alto: 'a alta concentração nos procedimentos no início indica forte apego aos protocolos, com pouca ou nenhuma flexibilidade para perceber o estado emocional do cliente — dando a impressão de um tratamento desumanizado.' },
    Q1_FORMAL:      { baixo: 'você não valoriza as formalidades e os padrões institucionais estabelecidos, o que pode comprometer a imagem de competência técnica sua e da organização.',
                      alto: 'o excesso de formalidade pode ser percebido pelo cliente como desvalorização da sua pessoa, afastamento e frieza, despertando sentimentos de rejeição e antipatia.' },
    Q1_IMPESSOAL:   { baixo: 'você não valoriza a impessoalidade no tratamento — pelo contrário, valoriza um atendimento pessoal e personalizado; o cuidado é não deixar a atenção à pessoa se sobrepor à isenção e aos procedimentos.',
                      alto: 'a impessoalidade altamente valorizada pode levar o cliente a perceber um atendimento distante e desumano, como se fosse realizado por um robô.' },
    Q1_FLEXIVEL:    { baixo: 'a tendência é usar o mesmo padrão de recepção para todos, ignorando que cada cliente tem necessidades e expectativas próprias.',
                      alto: 'a flexibilidade excessiva vira falta de padrão — cada atendimento de um jeito — comprometendo a previsibilidade e a imagem institucional.' },
    Q1_INTERESSADO: { baixo: 'há risco de supor ou julgar a demanda sem ouvir, levando a um diagnóstico errado do que o cliente realmente precisa.',
                      alto: 'o interesse excessivo pode parecer invasivo, entrando em terrenos que o cliente não quis abrir.' },
    Q1_CORDIAL_E:   { baixo: 'a aspereza no primeiro contato cria uma barreira difícil de reverter nos momentos seguintes do atendimento.',
                      alto: 'a cordialidade excessiva pode ser lida como bajulação comercial — e o cliente passa a desconfiar da intenção.' },
    /* ---- Q2 · Durante ---- */
    Q2_COMPREENSIVO:{ baixo: 'as reações emocionais do cliente durante a execução tendem a ser ignoradas, transformando o atendimento em linha de produção.',
                      alto: 'a compreensão excessiva pode deixar você refém das emoções do cliente, atrasando ou distorcendo a execução técnica.' },
    Q2_CUIDADOSO:   { baixo: 'a execução sem zelo é percebida pelo cliente mesmo sem conhecimento técnico — e interpretada como incompetência.',
                      alto: 'o cuidado excessivo vira lentidão e hesitação, que o cliente interpreta como insegurança técnica.' },
    Q2_RESPEITOSO:  { baixo: 'o desrespeito, ainda que sutil, viola a necessidade de autoestima — um "pecado mortal" do atendimento.',
                      alto: 'a reverência exagerada cria uma distância cerimoniosa que trava a naturalidade da relação.' },
    Q2_DESCRITIVO:  { baixo: 'sem descrição do que está sendo feito, o cliente fica refém do desconhecido — e o medo cresce no silêncio.',
                      alto: 'descrever demais cada passo vira prolixidade técnica: confunde e assusta em vez de tranquilizar.' },
    Q2_INTERATIVO:  { baixo: 'o monólogo técnico exclui o cliente do próprio atendimento, gerando sensação de desvalorização.',
                      alto: 'a interação constante dispersa o foco da execução e alonga o atendimento além do necessário.' },
    Q2_OUVINTE:     { baixo: 'perde-se a informação que ajustaria o procedimento à real necessidade — a falha mais comum e mais custosa do atendimento.',
                      alto: 'só ouvir, sem conduzir, deixa o atendimento sem direção; o cliente espera também orientação e posicionamento.' },
    Q2_DISTANTE:    { baixo: 'você não valoriza o distanciamento — prefere proximidade com o cliente; o cuidado é que o envolvimento emocional muito forte pode comprometer a execução dos procedimentos técnicos requeridos.',
                      alto: 'o distanciamento muito valorizado é percebido como frieza e desinteresse pela pessoa que está sendo atendida.' },
    Q2_EFICIENTE:   { baixo: 'a baixa eficiência é percebida pelo cliente em ações que se repetem, desperdício de materiais e movimentos desnecessários — uma percepção sutil que se amplia ao longo do processo.',
                      alto: 'a eficiência valorizada ao extremo gera percepção de rigidez, inflexibilidade e até uma certa desconfiança.' },
    Q2_OBJETIVO:    { baixo: 'o atendimento tende a se perder em desvios, e o cliente sente que o seu tempo não é respeitado.',
                      alto: 'a objetividade extrema atropela as reações do cliente — sensação de estar numa esteira, não num atendimento.' },
    Q2_RAPIDO_E:    { baixo: 'indica um atendimento lento e moroso, que pode gerar impaciência e reações mais exacerbadas dos clientes.',
                      alto: 'a rapidez excessiva é percebida como descaso ou desprezo; no momento da execução técnica, o cliente se sente inseguro e desconfiado da competência do profissional e da organização.' },
    Q2_PRECISO:     { baixo: 'a imprecisão — no gesto ou na informação — planta a dúvida sobre a competência do profissional.',
                      alto: 'o perfeccionismo excessivo trava decisões e alonga o processo sem ganho perceptível para o cliente.' },
    Q2_SOLICITO:    { baixo: 'a indisponibilidade percebida faz o cliente desistir de perguntar — e, muitas vezes, de voltar.',
                      alto: 'a solicitude excessiva soa servil e pode incomodar, tirando a naturalidade da relação.' },
    /* ---- Q3 · Término ---- */
    Q3_AUTENTICO:   { baixo: 'o fechamento tende a acontecer atrás de uma fachada profissional; a incoerência entre gesto e palavra invalida o discurso e gera desconfiança.',
                      alto: 'a autenticidade sem filtro pode virar franqueza dura em momentos que pedem delicadeza — especialmente na entrega de más notícias.' },
    Q3_CORDIAL_A:   { baixo: 'um fechamento seco apaga a boa impressão construída — pela "Regra do Pico-Fim", a memória da experiência é marcada pelo final.',
                      alto: 'prolongar demais a despedida atrasa o encerramento e pode constranger o cliente.' },
    Q3_EMPATICO:    { baixo: 'entregar resultados sem empatia — sobretudo notícias difíceis — pode transformar o cliente em detrator.',
                      alto: 'a empatia excessiva pode contaminar você emocionalmente e comprometer a objetividade da informação a ser dada.' },
    Q3_ACESSIVEL:   { baixo: 'fechar as portas ao final interrompe a jornada do cliente e impede a fidelização — o atendimento só termina quando o objetivo dele é atingido.',
                      alto: 'a disponibilidade ilimitada gera dependência do cliente e compromete a agenda e a sustentabilidade do serviço.' },
    Q3_ELOQUENTE:   { baixo: 'um fechamento hesitante deixa dúvidas sobre o resultado — mesmo quando o serviço foi bem executado.',
                      alto: 'a eloquência excessiva vira discurso: o cliente quer clareza sobre o resultado, não retórica.' },
    Q3_ESPONTANEO:  { baixo: 'o encerramento mecânico, de script, desfaz a percepção de cuidado construída ao longo da relação.',
                      alto: 'a espontaneidade demais pode escapar do padrão institucional e gerar uma informalidade inadequada ao contexto.' },
    Q3_DIRETO:      { baixo: 'indica comportamentos evasivos, cheios de rodeios, percebidos pelo cliente como indiretos, incompletos ou dispersos — o que alimenta desconfiança e ansiedade.',
                      alto: 'o foco extremo no procedimento, sem considerar as reações do cliente — como se ele fosse um objeto a ser reparado — gera ansiedade, indignação e, em certos casos, reações emocionais intensas.' },
    Q3_PROTOCOLAR:  { baixo: 'indica que você segue o mínimo necessário dos protocolos técnicos e administrativos, o que pode gerar erros procedimentais, não conformidades e a percepção de violação da equidade e do tratamento justo.',
                      alto: 'o forte apego aos protocolos gera um comportamento excessivamente burocrático, em que a execução rigorosa das normas pode ser percebida pelo cliente como desprezo pelas suas necessidades.' },
    Q3_RAPIDO_P:    { baixo: 'a lentidão no encerramento gera sensação de descaso e até de incompetência administrativa, despertando desconfiança inclusive do resultado técnico já entregue.',
                      alto: 'a pressa no término pode indicar a intenção de "se livrar" do cliente, sem oferecer todas as recomendações necessárias nem criar espaço para perguntas e explicações.' },
    Q3_CONSISTENTE: { baixo: 'a queda de padrão no final revela que o cuidado era protocolo, não valor — e o cliente percebe.',
                      alto: 'a consistência rígida impede os ajustes finais que a situação de cada cliente pede.' },
    Q3_PRESTATIVO:  { baixo: 'o cliente sai com o serviço feito, mas sem saber como sustentar o resultado depois da porta.',
                      alto: 'o excesso de orientações no fechamento sobrecarrega e confunde — pouco é retido pelo cliente.' },
    Q3_ENFATICO_E:  { baixo: 'recomendações ditas sem ênfase são esquecidas — e o resultado se perde no pós-atendimento.',
                      alto: 'a ênfase dramática no fechamento pode assustar e gerar ansiedade desnecessária.' }
};
