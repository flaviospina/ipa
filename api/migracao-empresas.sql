-- ============================================================
-- IPA — Migração "Módulo Empresas" para BANCO JÁ EXISTENTE
-- Rodar UMA vez no phpMyAdmin (aba SQL do banco itthri79_vipedia).
-- Quem estiver instalando do zero NÃO precisa deste arquivo:
-- o schema.sql completo já inclui tudo.
-- ============================================================

CREATE TABLE IF NOT EXISTS ipa_empresas (
    id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nome      VARCHAR(120) NOT NULL,
    codigo    VARCHAR(32)  NOT NULL,
    ativo     TINYINT(1)   NOT NULL DEFAULT 1,
    UNIQUE KEY uq_emp_nome (nome),
    UNIQUE KEY uq_emp_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ipa_gestores (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    empresa_id INT UNSIGNED NOT NULL,
    nome       VARCHAR(120) NOT NULL,
    email      VARCHAR(190) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    ativo      TINYINT(1)   NOT NULL DEFAULT 1,
    UNIQUE KEY uq_gestor_email (email),
    CONSTRAINT fk_gestor_emp FOREIGN KEY (empresa_id) REFERENCES ipa_empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ipa_login_log (
    id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email     VARCHAR(190) NOT NULL DEFAULT '',
    ip        VARCHAR(45)  NOT NULL DEFAULT '',
    ok        TINYINT(1)   NOT NULL DEFAULT 0,
    KEY idx_login_janela (criado_em, ip),
    KEY idx_login_email (email, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE ipa_respostas ADD COLUMN empresa_id INT UNSIGNED NULL AFTER ip;
ALTER TABLE ipa_respostas ADD KEY idx_resp_empresa (empresa_id);
ALTER TABLE ipa_360 ADD COLUMN empresa_id INT UNSIGNED NULL AFTER ip;
ALTER TABLE ipa_360 ADD KEY idx_360_empresa (empresa_id);

-- (Opcional) vincular registros antigos a uma empresa criada depois:
-- UPDATE ipa_respostas SET empresa_id = (SELECT id FROM ipa_empresas WHERE nome = 'NOME EXATO')
--  WHERE organizacao = 'NOME EXATO' AND empresa_id IS NULL;
-- UPDATE ipa_360 SET empresa_id = (SELECT id FROM ipa_empresas WHERE nome = 'NOME EXATO')
--  WHERE organizacao = 'NOME EXATO' AND empresa_id IS NULL;
