-- ============================================================
-- HOMOLOGAÇÃO — Migração "Login do gestor por e-mail e senha"
-- Rodar UMA vez no phpMyAdmin, no banco da HOMOLOGAÇÃO.
-- Puramente aditiva: cria só a tabela de contas de gestor.
-- ============================================================
CREATE TABLE IF NOT EXISTS ipa_gestores (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nome       VARCHAR(120) NOT NULL,
    email      VARCHAR(190) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    ativo      TINYINT(1)   NOT NULL DEFAULT 1,
    UNIQUE KEY uq_hml_gestor_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
