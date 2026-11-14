-- ============================================================
-- IPA HOMOLOGAÇÃO — esquema (banco SEPARADO da produção)
-- Importar uma vez via phpMyAdmin no banco da homologação.
-- ============================================================
CREATE TABLE IF NOT EXISTS ipa_respostas (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cliente_id    VARCHAR(48)  NOT NULL,
    token         CHAR(32)     NOT NULL,
    organizacao   VARCHAR(200) NOT NULL,
    nome          VARCHAR(200) NOT NULL,
    funcao        VARCHAR(200) NOT NULL,
    consentimento VARCHAR(48)  NOT NULL,
    respostas     TEXT         NOT NULL,
    score_a       TINYINT UNSIGNED NOT NULL,
    score_c       TINYINT UNSIGNED NOT NULL,
    score_p       TINYINT UNSIGNED NOT NULL,
    score_e       TINYINT UNSIGNED NOT NULL,
    total         SMALLINT UNSIGNED NOT NULL,
    predominante  VARCHAR(32)  NOT NULL,
    regra         VARCHAR(32)  NOT NULL,
    ia_json       LONGTEXT     NULL,     -- textos do relatório escritos pela IA
    relatorio     LONGTEXT     NULL,     -- HTML final arquivado
    ip            VARCHAR(45)  NULL,
    UNIQUE KEY uq_cliente (cliente_id),
    UNIQUE KEY uq_token (token),
    KEY idx_pessoa (nome, organizacao, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ipa_respostas_palavras (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    resposta_id INT UNSIGNED NOT NULL,
    quadro      TINYINT UNSIGNED NOT NULL,
    palavra_id  VARCHAR(24) NOT NULL,
    estilo      CHAR(1) NOT NULL,
    peso        TINYINT UNSIGNED NOT NULL,
    CONSTRAINT fk_resp_hml FOREIGN KEY (resposta_id) REFERENCES ipa_respostas(id) ON DELETE CASCADE,
    KEY idx_resposta (resposta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Funcionários cadastrados pelo gestor (link pessoal de preenchimento) */
CREATE TABLE IF NOT EXISTS ipa_funcionarios (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nome         VARCHAR(200) NOT NULL,
    email        VARCHAR(190) NOT NULL,
    organizacao  VARCHAR(200) NOT NULL,
    funcao       VARCHAR(120) NOT NULL,        -- cargo/função
    area_atuacao VARCHAR(120) NOT NULL,
    segmento     VARCHAR(120) NOT NULL,
    obs          VARCHAR(500) NULL,
    codigo       VARCHAR(32)  NOT NULL,        -- link pessoal (?f=)
    ativo        TINYINT(1)   NOT NULL DEFAULT 1,
    UNIQUE KEY uq_func_email (email),
    UNIQUE KEY uq_func_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE ipa_respostas ADD COLUMN funcionario_id INT UNSIGNED NULL;
ALTER TABLE ipa_respostas ADD KEY idx_resp_func (funcionario_id);
