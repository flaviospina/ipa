-- =====================================================================
-- VIPEDia / IPA — carga inicial
-- Aplicar DEPOIS de 01-schema.sql, no banco itthri79_vipedia
-- ---------------------------------------------------------------------
-- Conteúdo:
--   1. o instrumento IPA/ACP versão 2 (o mesmo schema v2 em produção)
--   2. as 36 palavras, com QUADRO, POSIÇÃO e ESTILO explícitos
--
-- As palavras foram geradas a partir de webapp/js/data.js, e conferidas
-- contra a regra posicional usada hoje no Apps Script e no engine.js
-- (0-2 = A, 3-5 = C, 6-8 = P, 9-11 = E): 36 palavras, zero divergência.
-- A partir daqui o estilo passa a ser DADO, e não dedução por posição.
-- =====================================================================

SET NAMES utf8mb4;

INSERT INTO instrumentos (codigo, versao, nome, qtd_quadros, qtd_palavras_quadro, peso_max, total_esperado, ativo)
VALUES ('IPA_ACP', 2, 'Indicador de Preferência de Conduta — Abordagem ACP', 3, 12, 11, 198, 1)
ON DUPLICATE KEY UPDATE nome = VALUES(nome), ativo = VALUES(ativo);

SET @instr = (SELECT id FROM instrumentos WHERE codigo = 'IPA_ACP' AND versao = 2);

-- quadro 1 = Início · quadro 2 = Durante · quadro 3 = Término
INSERT INTO palavras (instrumento_id, quadro, posicao, codigo, texto, estilo) VALUES
  (@instr, 1, 0, 'Q1_ABERTO', 'ABERTO', 'A'),
  (@instr, 1, 1, 'Q1_ACOLHEDOR', 'ACOLHEDOR', 'A'),
  (@instr, 1, 2, 'Q1_ATENCIOSO', 'ATENCIOSO', 'A'),
  (@instr, 1, 3, 'Q1_CLARO', 'CLARO', 'C'),
  (@instr, 1, 4, 'Q1_EXPLICITO', 'EXPLÍCITO', 'C'),
  (@instr, 1, 5, 'Q1_ENFATICO_C', 'ENFÁTICO', 'C'),
  (@instr, 1, 6, 'Q1_CONCENTRADO', 'CONCENTRADO', 'P'),
  (@instr, 1, 7, 'Q1_FORMAL', 'FORMAL', 'P'),
  (@instr, 1, 8, 'Q1_IMPESSOAL', 'IMPESSOAL', 'P'),
  (@instr, 1, 9, 'Q1_FLEXIVEL', 'FLEXÍVEL', 'E'),
  (@instr, 1, 10, 'Q1_INTERESSADO', 'INTERESSADO', 'E'),
  (@instr, 1, 11, 'Q1_CORDIAL_E', 'CORDIAL', 'E'),
  (@instr, 2, 0, 'Q2_COMPREENSIVO', 'COMPREENSIVO', 'A'),
  (@instr, 2, 1, 'Q2_CUIDADOSO', 'CUIDADOSO', 'A'),
  (@instr, 2, 2, 'Q2_RESPEITOSO', 'RESPEITOSO', 'A'),
  (@instr, 2, 3, 'Q2_DESCRITIVO', 'DESCRITIVO', 'C'),
  (@instr, 2, 4, 'Q2_INTERATIVO', 'INTERATIVO', 'C'),
  (@instr, 2, 5, 'Q2_OUVINTE', 'OUVINTE', 'C'),
  (@instr, 2, 6, 'Q2_DISTANTE', 'DISTANTE', 'P'),
  (@instr, 2, 7, 'Q2_EFICIENTE', 'EFICIENTE', 'P'),
  (@instr, 2, 8, 'Q2_OBJETIVO', 'OBJETIVO', 'P'),
  (@instr, 2, 9, 'Q2_RAPIDO_E', 'RÁPIDO', 'E'),
  (@instr, 2, 10, 'Q2_PRECISO', 'PRECISO', 'E'),
  (@instr, 2, 11, 'Q2_SOLICITO', 'SOLÍCITO', 'E'),
  (@instr, 3, 0, 'Q3_AUTENTICO', 'AUTÊNTICO', 'A'),
  (@instr, 3, 1, 'Q3_CORDIAL_A', 'CORDIAL', 'A'),
  (@instr, 3, 2, 'Q3_EMPATICO', 'EMPÁTICO', 'A'),
  (@instr, 3, 3, 'Q3_ACESSIVEL', 'ACESSÍVEL', 'C'),
  (@instr, 3, 4, 'Q3_ELOQUENTE', 'ELOQUENTE', 'C'),
  (@instr, 3, 5, 'Q3_ESPONTANEO', 'ESPONTÂNEO', 'C'),
  (@instr, 3, 6, 'Q3_DIRETO', 'DIRETO', 'P'),
  (@instr, 3, 7, 'Q3_PROTOCOLAR', 'PROTOCOLAR', 'P'),
  (@instr, 3, 8, 'Q3_RAPIDO_P', 'RÁPIDO', 'P'),
  (@instr, 3, 9, 'Q3_CONSISTENTE', 'CONSISTENTE', 'E'),
  (@instr, 3, 10, 'Q3_PRESTATIVO', 'PRESTATIVO', 'E'),
  (@instr, 3, 11, 'Q3_ENFATICO_E', 'ENFÁTICO', 'E')
ON DUPLICATE KEY UPDATE
  texto  = VALUES(texto),
  estilo = VALUES(estilo);   -- reaplicável: atualiza em vez de falhar por duplicidade

-- Conferência rápida após a carga (deve devolver 36, e 9 por estilo):
--   SELECT COUNT(*) FROM palavras;
--   SELECT estilo, COUNT(*) FROM palavras GROUP BY estilo;
