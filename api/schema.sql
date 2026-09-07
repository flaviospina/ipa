-- ============================================================
-- IPA — Esquema MySQL (HostGator / cPanel)
-- Importar uma vez via phpMyAdmin: aba "Importar" > este arquivo
-- ============================================================

CREATE TABLE IF NOT EXISTS ipa_respostas (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cliente_id    VARCHAR(48)  NOT NULL,             -- id gerado pelo navegador (vincula o arquivamento)
    token         CHAR(32)     NOT NULL,             -- token secreto do link do relatório
    organizacao   VARCHAR(200) NOT NULL,
    nome          VARCHAR(200) NOT NULL,
    funcao        VARCHAR(200) NOT NULL,
    consentimento VARCHAR(48)  NOT NULL,             -- timestamp do aceite LGPD
    respostas     TEXT         NOT NULL,             -- JSON { "Q1_ABERTO": 11, ... } (36 palavras)
    score_a       TINYINT UNSIGNED NOT NULL,
    score_c       TINYINT UNSIGNED NOT NULL,
    score_p       TINYINT UNSIGNED NOT NULL,
    score_e       TINYINT UNSIGNED NOT NULL,
    total         SMALLINT UNSIGNED NOT NULL,        -- sempre 198 (validado no servidor)
    predominante  VARCHAR(20)  NOT NULL,
    regra         VARCHAR(32)  NOT NULL,
    relatorio     LONGTEXT     NULL,                 -- HTML completo do relatório (arquivado)
    ip            VARCHAR(45)  NULL,
    UNIQUE KEY uq_cliente (cliente_id),
    UNIQUE KEY uq_token (token),
    KEY idx_org (organizacao),
    KEY idx_criado (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Detalhe normalizado: uma linha por palavra respondida (36 por diagnóstico).
   Permite consultas SQL diretas (médias por palavra, distribuições etc.)
   sem depender do JSON da coluna `respostas`. */
CREATE TABLE IF NOT EXISTS ipa_respostas_palavras (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    resposta_id INT UNSIGNED NOT NULL,
    quadro      TINYINT UNSIGNED NOT NULL,             -- 1=Início, 2=Durante, 3=Término
    palavra_id  VARCHAR(24) NOT NULL,                  -- ex.: Q1_ABERTO
    estilo      CHAR(1) NOT NULL,                      -- A / C / P / E
    peso        TINYINT UNSIGNED NOT NULL,             -- 0..11
    CONSTRAINT fk_resp FOREIGN KEY (resposta_id) REFERENCES ipa_respostas(id) ON DELETE CASCADE,
    KEY idx_palavra (palavra_id),
    KEY idx_resposta (resposta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ipa_360 (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    avaliado      VARCHAR(200) NOT NULL,
    organizacao   VARCHAR(200) NOT NULL,
    relacao       VARCHAR(60)  NOT NULL,             -- Gestor(a) / Colega / Cliente / Outra (anônimo)
    respostas     TEXT         NOT NULL,             -- JSON (36 palavras)
    score_a       TINYINT UNSIGNED NOT NULL,
    score_c       TINYINT UNSIGNED NOT NULL,
    score_p       TINYINT UNSIGNED NOT NULL,
    score_e       TINYINT UNSIGNED NOT NULL,
    total         SMALLINT UNSIGNED NOT NULL,
    ip            VARCHAR(45)  NULL,
    KEY idx_avaliado (avaliado, organizacao),
    KEY idx_criado (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ipa_360_palavras (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    avaliacao_id INT UNSIGNED NOT NULL,
    quadro       TINYINT UNSIGNED NOT NULL,
    palavra_id   VARCHAR(24) NOT NULL,
    estilo       CHAR(1) NOT NULL,
    peso         TINYINT UNSIGNED NOT NULL,
    CONSTRAINT fk_360 FOREIGN KEY (avaliacao_id) REFERENCES ipa_360(id) ON DELETE CASCADE,
    KEY idx_palavra360 (palavra_id),
    KEY idx_avaliacao (avaliacao_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
