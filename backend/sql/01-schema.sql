-- =====================================================================
-- VIPEDia / IPA — esquema inicial
-- Banco.....: itthri79_vipedia
-- Usuário...: itthri79_vipedia_user
-- Alvo......: MySQL 8.0+ ou MariaDB 10.4+ (InnoDB, utf8mb4)
-- ---------------------------------------------------------------------
-- COMO APLICAR (cPanel):
--   1. phpMyAdmin > selecionar o banco itthri79_vipedia
--   2. aba "Importar" > escolher este arquivo > Executar
--   3. depois aplicar 02-dados-iniciais.sql (instrumento e 36 palavras)
--
-- O script é idempotente: pode ser reaplicado sem erro em banco vazio.
-- A ordem das tabelas respeita as dependências de chave estrangeira.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 1. ACESSO — quem entra e o que enxerga
-- =====================================================================

CREATE TABLE IF NOT EXISTS empresas (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome           VARCHAR(160) NOT NULL,
  slug           VARCHAR(60)  NOT NULL COMMENT 'identificador curto usado em URLs',
  cnpj           VARCHAR(18)  NULL,
  contato_nome   VARCHAR(120) NULL,
  contato_email  VARCHAR(160) NULL,
  contato_fone   VARCHAR(30)  NULL,
  status         ENUM('ativa','suspensa','encerrada') NOT NULL DEFAULT 'ativa',
  observacoes    TEXT NULL,
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_empresas_slug (slug),
  KEY ix_empresas_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Organizações clientes. É a fronteira de isolamento de todos os dados.';


CREATE TABLE IF NOT EXISTS usuarios (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empresa_id        INT UNSIGNED NULL COMMENT 'NULL = administrador geral (VIPEDia)',
  nome              VARCHAR(120) NOT NULL,
  email             VARCHAR(160) NOT NULL,
  senha_hash        VARCHAR(255) NOT NULL COMMENT 'password_hash() — bcrypt/argon2id, nunca senha em claro',
  papel             ENUM('admin_geral','admin_empresa','consultor','gestor') NOT NULL,
  status            ENUM('ativo','inativo','bloqueado') NOT NULL DEFAULT 'ativo',
  trocar_senha      TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = senha definida pelo admin, troca obrigatória no 1º acesso',
  ultimo_login_em   DATETIME NULL,
  tentativas_falhas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_ate     DATETIME NULL COMMENT 'preenchido após excesso de tentativas',
  criado_por        INT UNSIGNED NULL,
  criado_em         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_email (email),
  KEY ix_usuarios_empresa (empresa_id),
  KEY ix_usuarios_papel (papel),
  -- impede administrador de empresa sem empresa (que enxergaria tudo)
  CONSTRAINT ck_usuarios_escopo CHECK (
    (papel  = 'admin_geral' AND empresa_id IS NULL) OR
    (papel <> 'admin_geral' AND empresa_id IS NOT NULL)
  ),
  CONSTRAINT fk_usuarios_empresa FOREIGN KEY (empresa_id)
    REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_usuarios_criador FOREIGN KEY (criado_por)
    REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Contas de acesso. O papel + empresa_id define todo o alcance de leitura.';


CREATE TABLE IF NOT EXISTS usuario_tokens (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT UNSIGNED NOT NULL,
  tipo        ENUM('definir_senha','recuperar_senha') NOT NULL,
  token_hash  CHAR(64) NOT NULL COMMENT 'SHA-256 do token; o token só existe no e-mail enviado',
  expira_em   DATETIME NOT NULL,
  usado_em    DATETIME NULL,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuario_tokens_hash (token_hash),
  KEY ix_usuario_tokens_usuario (usuario_id, tipo),
  CONSTRAINT fk_usuario_tokens_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Links de primeiro acesso e de recuperação de senha, com validade.';


CREATE TABLE IF NOT EXISTS sessoes (
  id           CHAR(64) PRIMARY KEY COMMENT 'SHA-256 do valor do cookie de sessão',
  usuario_id   INT UNSIGNED NOT NULL,
  ip           VARBINARY(16) NULL COMMENT 'INET6_ATON()',
  user_agent   VARCHAR(255) NULL,
  criada_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em    DATETIME NOT NULL,
  encerrada_em DATETIME NULL,
  KEY ix_sessoes_usuario (usuario_id),
  KEY ix_sessoes_expira (expira_em),
  CONSTRAINT fk_sessoes_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sessões ativas. Permite encerrar o acesso de alguém sem trocar senha de todos.';


-- =====================================================================
-- 2. INSTRUMENTO — o questionário como dado, não como código
-- =====================================================================

CREATE TABLE IF NOT EXISTS instrumentos (
  id                  SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo              VARCHAR(30) NOT NULL COMMENT 'ex.: IPA_ACP',
  versao              SMALLINT UNSIGNED NOT NULL,
  nome                VARCHAR(120) NOT NULL,
  qtd_quadros         TINYINT UNSIGNED NOT NULL DEFAULT 3,
  qtd_palavras_quadro TINYINT UNSIGNED NOT NULL DEFAULT 12,
  peso_max            TINYINT UNSIGNED NOT NULL DEFAULT 11,
  total_esperado      SMALLINT UNSIGNED NOT NULL DEFAULT 198 COMMENT 'soma A+C+P+E de uma aplicação válida',
  ativo               TINYINT(1) NOT NULL DEFAULT 1,
  criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_instrumentos_versao (codigo, versao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Versões do questionário. Permite evoluir o IPA sem invalidar o histórico.';


CREATE TABLE IF NOT EXISTS palavras (
  id             SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instrumento_id SMALLINT UNSIGNED NOT NULL,
  quadro         TINYINT UNSIGNED NOT NULL COMMENT '1=Início, 2=Durante, 3=Término',
  posicao        TINYINT UNSIGNED NOT NULL COMMENT '0..11, ordem de exibição no quadro',
  codigo         VARCHAR(30) NOT NULL COMMENT 'ex.: Q1_ABERTO',
  texto          VARCHAR(60) NOT NULL COMMENT 'palavra exibida ao respondente',
  estilo         ENUM('A','C','P','E') NOT NULL
                 COMMENT 'Atenção / Comunicação / Procedimento / Equilibrado — explícito, não deduzido da posição',
  UNIQUE KEY uq_palavras_codigo (instrumento_id, codigo),
  UNIQUE KEY uq_palavras_posicao (instrumento_id, quadro, posicao),
  KEY ix_palavras_estilo (instrumento_id, estilo),
  CONSTRAINT ck_palavras_quadro  CHECK (quadro  BETWEEN 1 AND 3),
  CONSTRAINT ck_palavras_posicao CHECK (posicao BETWEEN 0 AND 11),
  CONSTRAINT fk_palavras_instrumento FOREIGN KEY (instrumento_id)
    REFERENCES instrumentos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='As 36 palavras. O estilo vira dado — encerra a dedução por posição duplicada em dois arquivos.';


-- =====================================================================
-- 3. APLICAÇÃO — quem foi avaliado e o que respondeu
-- =====================================================================

CREATE TABLE IF NOT EXISTS participantes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empresa_id    INT UNSIGNED NOT NULL,
  nome          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NULL,
  funcao        VARCHAR(120) NULL,
  setor         VARCHAR(120) NULL,
  matricula     VARCHAR(40)  NULL,
  status        ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_participantes_email (empresa_id, email),
  KEY ix_participantes_empresa (empresa_id, status),
  KEY ix_participantes_nome (empresa_id, nome),
  CONSTRAINT fk_participantes_empresa FOREIGN KEY (empresa_id)
    REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='A pessoa avaliada. Liga autoavaliação e 360° ao mesmo registro e permite série histórica.';


CREATE TABLE IF NOT EXISTS ciclos_360 (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empresa_id       INT UNSIGNED NOT NULL,
  participante_id  INT UNSIGNED NOT NULL COMMENT 'o avaliado',
  titulo           VARCHAR(120) NULL,
  status           ENUM('rascunho','aberto','fechado','cancelado') NOT NULL DEFAULT 'rascunho',
  min_avaliadores  TINYINT UNSIGNED NOT NULL DEFAULT 3
                   COMMENT 'mínimo por relação para o resultado ser exibido — protege o anonimato',
  prazo            DATE NULL,
  criado_por       INT UNSIGNED NULL,
  criado_em        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fechado_em       DATETIME NULL,
  KEY ix_ciclos_empresa (empresa_id, status),
  KEY ix_ciclos_participante (participante_id),
  CONSTRAINT fk_ciclos_empresa FOREIGN KEY (empresa_id)
    REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_ciclos_participante FOREIGN KEY (participante_id)
    REFERENCES participantes(id) ON DELETE CASCADE,
  CONSTRAINT fk_ciclos_criador FOREIGN KEY (criado_por)
    REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Um ciclo 360° aberto para um avaliado.';


CREATE TABLE IF NOT EXISTS avaliacoes (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid                CHAR(36) NOT NULL COMMENT 'identificador público; substitui o ID frágil da planilha',
  empresa_id          INT UNSIGNED NOT NULL,
  participante_id     INT UNSIGNED NOT NULL,
  instrumento_id      SMALLINT UNSIGNED NOT NULL,
  tipo                ENUM('auto','360') NOT NULL DEFAULT 'auto',
  ciclo_id            BIGINT UNSIGNED NULL COMMENT 'preenchido quando tipo = 360',
  relacao             ENUM('gestor','par','liderado','cliente_interno','outro') NULL,
  status              ENUM('em_andamento','concluida','invalidada') NOT NULL DEFAULT 'em_andamento',

  score_a             SMALLINT UNSIGNED NULL,
  score_c             SMALLINT UNSIGNED NULL,
  score_p             SMALLINT UNSIGNED NULL,
  score_e             SMALLINT UNSIGNED NULL,
  total               SMALLINT UNSIGNED NULL,
  estilo_predominante ENUM('A','C','P','E') NULL,
  regra_flexibilidade ENUM('EQUILIBRADO_MODELO','EQUILIBRADO_NATURAL','FLEXIVEL','FORTE_APEGO') NULL,
  dif_1               SMALLINT NULL COMMENT 'diferença entre 1º e 2º estilos',
  dif_2               SMALLINT NULL,
  dif_3               SMALLINT NULL,

  iniciada_em         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluida_em        DATETIME NULL,
  ip_hash             CHAR(64) NULL COMMENT 'hash, não o IP — minimização LGPD',
  user_agent          VARCHAR(255) NULL,

  UNIQUE KEY uq_avaliacoes_uuid (uuid),
  KEY ix_avaliacoes_empresa (empresa_id, tipo, concluida_em),
  KEY ix_avaliacoes_participante (participante_id, tipo),
  KEY ix_avaliacoes_ciclo (ciclo_id),
  CONSTRAINT ck_avaliacoes_360 CHECK (
    (tipo = '360' AND ciclo_id IS NOT NULL AND relacao IS NOT NULL) OR
    (tipo = 'auto')
  ),
  CONSTRAINT fk_avaliacoes_empresa FOREIGN KEY (empresa_id)
    REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_avaliacoes_participante FOREIGN KEY (participante_id)
    REFERENCES participantes(id) ON DELETE CASCADE,
  CONSTRAINT fk_avaliacoes_instrumento FOREIGN KEY (instrumento_id)
    REFERENCES instrumentos(id),
  CONSTRAINT fk_avaliacoes_ciclo FOREIGN KEY (ciclo_id)
    REFERENCES ciclos_360(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Uma aplicação do instrumento (autoavaliação ou avaliação 360°).';


CREATE TABLE IF NOT EXISTS avaliacao_respostas (
  avaliacao_id BIGINT   UNSIGNED NOT NULL,
  palavra_id   SMALLINT UNSIGNED NOT NULL,
  quadro       TINYINT  UNSIGNED NOT NULL COMMENT 'denormalizado para viabilizar a restrição abaixo',
  peso         TINYINT  UNSIGNED NOT NULL COMMENT '0..11',
  PRIMARY KEY (avaliacao_id, palavra_id),
  -- a regra "cada peso 0..11 aparece uma única vez por quadro" deixa de ser
  -- código de aplicação e passa a ser garantia estrutural do banco
  UNIQUE KEY uq_respostas_peso_por_quadro (avaliacao_id, quadro, peso),
  KEY ix_respostas_palavra (palavra_id),
  CONSTRAINT ck_respostas_peso   CHECK (peso   BETWEEN 0 AND 11),
  CONSTRAINT ck_respostas_quadro CHECK (quadro BETWEEN 1 AND 3),
  CONSTRAINT fk_respostas_avaliacao FOREIGN KEY (avaliacao_id)
    REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_respostas_palavra FOREIGN KEY (palavra_id)
    REFERENCES palavras(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Os 36 pesos de uma aplicação, um por linha.';


CREATE TABLE IF NOT EXISTS relatorios (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  avaliacao_id  BIGINT UNSIGNED NULL COMMENT 'relatório individual',
  ciclo_id      BIGINT UNSIGNED NULL COMMENT 'relatório consolidado 360°',
  tipo          ENUM('individual','360','equipe') NOT NULL,
  html          MEDIUMTEXT NULL COMMENT 'relatório renderizado, autocontido',
  ia_status     ENUM('nao_solicitada','ok','falhou') NOT NULL DEFAULT 'nao_solicitada',
  ia_modelo     VARCHAR(60) NULL,
  ia_json       LONGTEXT NULL COMMENT 'JSON da análise (chaves interpretacao, momentos, talentos, ...)',
  pdf_caminho   VARCHAR(255) NULL COMMENT 'caminho no servidor, fora da pasta pública',
  gerado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_relatorios_avaliacao (avaliacao_id),
  KEY ix_relatorios_ciclo (ciclo_id),
  CONSTRAINT ck_relatorios_vinculo CHECK (
    (avaliacao_id IS NOT NULL AND ciclo_id IS NULL) OR
    (avaliacao_id IS NULL AND ciclo_id IS NOT NULL)
  ),
  CONSTRAINT fk_relatorios_avaliacao FOREIGN KEY (avaliacao_id)
    REFERENCES avaliacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_relatorios_ciclo FOREIGN KEY (ciclo_id)
    REFERENCES ciclos_360(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='O vínculo por chave estrangeira torna impossível o link órfão que existe hoje na planilha.';


-- =====================================================================
-- 4. 360° — convites com identidade travada
-- =====================================================================

CREATE TABLE IF NOT EXISTS convites_360 (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ciclo_id      BIGINT UNSIGNED NOT NULL,
  relacao       ENUM('gestor','par','liderado','cliente_interno','outro') NOT NULL,
  nome_convidado VARCHAR(120) NULL COMMENT 'controle interno da empresa; nunca exibido no resultado',
  email         VARCHAR(160) NULL COMMENT 'opcional — o convite também funciona por link',
  token_hash    CHAR(64) NOT NULL COMMENT 'SHA-256; o token só existe no link enviado',
  status        ENUM('pendente','enviado','respondido','expirado','cancelado') NOT NULL DEFAULT 'pendente',
  enviado_em    DATETIME NULL,
  respondido_em DATETIME NULL,
  expira_em     DATETIME NOT NULL,
  avaliacao_id  BIGINT UNSIGNED NULL COMMENT 'preenchido no momento da resposta',
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_convites_token (token_hash),
  UNIQUE KEY uq_convites_avaliacao (avaliacao_id) COMMENT 'uma resposta por convite',
  KEY ix_convites_ciclo (ciclo_id, status),
  CONSTRAINT fk_convites_ciclo FOREIGN KEY (ciclo_id)
    REFERENCES ciclos_360(id) ON DELETE CASCADE,
  CONSTRAINT fk_convites_avaliacao FOREIGN KEY (avaliacao_id)
    REFERENCES avaliacoes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Quem está sendo avaliado e em que relação vêm no convite — o avaliador não digita nada disso.';


-- =====================================================================
-- 5. CONFORMIDADE — LGPD e auditoria
-- =====================================================================

CREATE TABLE IF NOT EXISTS consentimentos (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  participante_id INT UNSIGNED NULL,
  avaliacao_id    BIGINT UNSIGNED NULL,
  texto_versao    VARCHAR(20) NOT NULL COMMENT 'versão do texto de consentimento aceito',
  aceito_em       DATETIME NOT NULL,
  ip_hash         CHAR(64) NULL,
  criado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_consentimentos_participante (participante_id),
  KEY ix_consentimentos_avaliacao (avaliacao_id),
  CONSTRAINT fk_consentimentos_participante FOREIGN KEY (participante_id)
    REFERENCES participantes(id) ON DELETE CASCADE,
  CONSTRAINT fk_consentimentos_avaliacao FOREIGN KEY (avaliacao_id)
    REFERENCES avaliacoes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Aceite com versão do texto e data — hoje é apenas uma coluna de texto na planilha.';


CREATE TABLE IF NOT EXISTS log_auditoria (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT UNSIGNED NULL,
  empresa_id  INT UNSIGNED NULL,
  acao        VARCHAR(60) NOT NULL COMMENT 'login_ok, login_falha, empresa_criada, relatorio_visto, ...',
  entidade    VARCHAR(40) NULL,
  entidade_id BIGINT UNSIGNED NULL,
  detalhes    LONGTEXT NULL COMMENT 'JSON livre com o contexto da ação',
  ip          VARBINARY(16) NULL,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_log_empresa_data (empresa_id, criado_em),
  KEY ix_log_usuario_data (usuario_id, criado_em),
  KEY ix_log_acao (acao, criado_em),
  CONSTRAINT fk_log_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_log_empresa FOREIGN KEY (empresa_id)
    REFERENCES empresas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Responde "quem viu o quê e quando" com fato, não com suposição.';
