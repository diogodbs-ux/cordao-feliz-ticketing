-- ═══════════════════════════════════════════════════════════════════════
-- SENTINELA INFÂNCIA — Script de Criação do Banco de Dados
-- Sistema de Check-in e Controle de Visitantes
-- Cidade Mais Infância — Governo do Estado do Ceará
-- ═══════════════════════════════════════════════════════════════════════
-- Versão: 2.0
-- Data: 2026-04-04
-- Compatível com: Supabase (PostgreSQL 15+)
-- ═══════════════════════════════════════════════════════════════════════
--
-- INSTRUÇÕES:
--   1. Crie um projeto no Supabase (https://supabase.com)
--   2. Acesse o SQL Editor do projeto
--   3. Cole este script inteiro e execute
--   4. O sistema estará pronto para uso
--
-- ESTRUTURA:
--   • 4 enums (cores de cordão, origens, perfis, tipos de lista)
--   • 15 tabelas principais
--   • 7 views analíticas
--   • RLS (Row Level Security) em todas as tabelas
--   • Funções auxiliares e triggers
--   • Dados iniciais (admin padrão)
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────
-- 1. LIMPEZA (caso esteja recriando)
-- ─────────────────────────────────────────────

-- Drop views
DROP VIEW IF EXISTS v_dashboard_hoje CASCADE;
DROP VIEW IF EXISTS v_distribuicao_geo CASCADE;
DROP VIEW IF EXISTS v_performance_guiche CASCADE;
DROP VIEW IF EXISTS v_contagem_cordoes CASCADE;
DROP VIEW IF EXISTS v_fluxo_horario CASCADE;
DROP VIEW IF EXISTS v_resumo_listas_especiais CASCADE;
DROP VIEW IF EXISTS v_relatorio_operacao CASCADE;

-- Drop tables (order matters due to FK)
DROP TABLE IF EXISTS log_alertas CASCADE;
DROP TABLE IF EXISTS configuracao_alertas CASCADE;
DROP TABLE IF EXISTS convidados_aniversario CASCADE;
DROP TABLE IF EXISTS listas_aniversariantes CASCADE;
DROP TABLE IF EXISTS adultos_instituicao CASCADE;
DROP TABLE IF EXISTS criancas_instituicao CASCADE;
DROP TABLE IF EXISTS listas_instituicoes CASCADE;
DROP TABLE IF EXISTS checkin_cordoes CASCADE;
DROP TABLE IF EXISTS checkins CASCADE;
DROP TABLE IF EXISTS acompanhantes CASCADE;
DROP TABLE IF EXISTS criancas CASCADE;
DROP TABLE IF EXISTS responsaveis CASCADE;
DROP TABLE IF EXISTS grupos_visita CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.has_role CASCADE;
DROP FUNCTION IF EXISTS public.get_cordao_cor CASCADE;
DROP FUNCTION IF EXISTS public.calc_vagas_acompanhante CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.atualizar_updated_at CASCADE;
DROP FUNCTION IF EXISTS public.atualizar_stats_checkin CASCADE;

-- Drop enums
DROP TYPE IF EXISTS public.cordao_color CASCADE;
DROP TYPE IF EXISTS public.origem_visitante CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.tipo_lista_especial CASCADE;


-- ─────────────────────────────────────────────
-- 2. ENUMS
-- ─────────────────────────────────────────────

CREATE TYPE public.cordao_color AS ENUM (
  'azul',       -- 0-3 anos
  'verde',      -- 4-6 anos
  'amarelo',    -- 7-9 anos
  'vermelho',   -- 10-12 anos
  'rosa',       -- Adulto/Responsável
  'cinza',      -- Terceirizado
  'preto'       -- Serviço
);

CREATE TYPE public.origem_visitante AS ENUM (
  'agendamento',       -- Importado do CSV do sistema de agendamento
  'lista_adicional',   -- Lista de convidados extras
  'manual',            -- Cadastro manual no guichê
  'problema_sistema'   -- Contingência por falha no sistema externo
);

CREATE TYPE public.app_role AS ENUM (
  'admin',        -- Acesso total: dashboard, importação, usuários, relatórios, config
  'coordenador',  -- Painel em tempo real, alertas, visão de todos os guichês
  'recreador',    -- Check-in no guichê, cadastro manual, visualização de cordões
  'observador'    -- Visualização como recreador, sem ocupar guichê (modo teste)
);

CREATE TYPE public.tipo_lista_especial AS ENUM (
  'aniversariante',
  'instituicao'
);


-- ─────────────────────────────────────────────
-- 3. FUNÇÕES AUXILIARES
-- ─────────────────────────────────────────────

-- Determina a cor do cordão com base na idade da criança
CREATE OR REPLACE FUNCTION public.get_cordao_cor(idade INTEGER)
RETURNS cordao_color
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN idade BETWEEN 0  AND 3  THEN 'azul'::cordao_color
    WHEN idade BETWEEN 4  AND 6  THEN 'verde'::cordao_color
    WHEN idade BETWEEN 7  AND 9  THEN 'amarelo'::cordao_color
    WHEN idade BETWEEN 10 AND 12 THEN 'vermelho'::cordao_color
    ELSE 'rosa'::cordao_color
  END;
$$;

-- Calcula vagas disponíveis para acompanhantes
-- Regra: 1 criança = 2 adultos (responsável + acompanhantes)
CREATE OR REPLACE FUNCTION public.calc_vagas_acompanhante(
  num_criancas INTEGER,
  num_acompanhantes INTEGER
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(0, (num_criancas * 2) - 1 - num_acompanhantes);
$$;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.atualizar_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Função de verificação de papel (security definer para evitar recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;


-- ─────────────────────────────────────────────
-- 4. TABELAS PRINCIPAIS
-- ─────────────────────────────────────────────

-- 4.1 Perfis de usuário (ligado ao auth.users do Supabase)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  email       TEXT,
  guiche      SMALLINT CHECK (guiche IS NULL OR (guiche >= 1 AND guiche <= 6)),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

-- 4.2 Papéis de usuário (tabela separada por segurança)
CREATE TABLE public.user_roles (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role     app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4.3 Grupos de visita (entidade central)
CREATE TABLE public.grupos_visita (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_realizado  BOOLEAN NOT NULL DEFAULT false,
  checkin_data       DATE,
  checkin_hora       TIME,
  guiche             SMALLINT CHECK (guiche IS NULL OR (guiche >= 1 AND guiche <= 6)),
  atendido_por       UUID REFERENCES public.profiles(id),
  origem             origem_visitante NOT NULL DEFAULT 'agendamento',
  observacao         TEXT,
  data_agendamento   DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.grupos_visita ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER grupos_visita_updated_at
  BEFORE UPDATE ON public.grupos_visita
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

-- 4.4 Responsáveis (1:1 com grupo_visita)
CREATE TABLE public.responsaveis (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_visita_id   UUID NOT NULL UNIQUE REFERENCES public.grupos_visita(id) ON DELETE CASCADE,
  protocolo         TEXT,
  nome              TEXT NOT NULL,
  contato           TEXT,
  email             TEXT,
  bairro            TEXT,
  cidade            TEXT DEFAULT 'FORTALEZA',
  uf                TEXT DEFAULT 'CE' CHECK (length(uf) = 2),
  tipo_agendamento  TEXT DEFAULT 'FAMILIAR',
  nome_instituicao  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_responsaveis_protocolo ON public.responsaveis(protocolo);
CREATE INDEX idx_responsaveis_nome ON public.responsaveis(nome);
CREATE INDEX idx_responsaveis_cidade ON public.responsaveis(cidade);
CREATE INDEX idx_responsaveis_uf ON public.responsaveis(uf);
CREATE INDEX idx_responsaveis_bairro ON public.responsaveis(bairro);

CREATE TRIGGER responsaveis_updated_at
  BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

-- 4.5 Crianças (N:1 com responsável)
CREATE TABLE public.criancas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responsavel_id   UUID NOT NULL REFERENCES public.responsaveis(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  idade            SMALLINT NOT NULL CHECK (idade >= 0 AND idade <= 17),
  genero           TEXT,
  pcd              BOOLEAN NOT NULL DEFAULT false,
  pcd_descricao    TEXT,
  cordao_cor       cordao_color NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.criancas ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_criancas_responsavel ON public.criancas(responsavel_id);
CREATE INDEX idx_criancas_cordao_cor ON public.criancas(cordao_cor);

-- 4.6 Acompanhantes (N:1 com responsável)
CREATE TABLE public.acompanhantes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responsavel_id  UUID NOT NULL REFERENCES public.responsaveis(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  parentesco      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.acompanhantes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_acompanhantes_responsavel ON public.acompanhantes(responsavel_id);

-- 4.7 Registros de check-in (log imutável)
CREATE TABLE public.checkins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_visita_id   UUID NOT NULL REFERENCES public.grupos_visita(id) ON DELETE CASCADE,
  responsavel_nome  TEXT NOT NULL,
  total_criancas    SMALLINT NOT NULL DEFAULT 0,
  guiche            SMALLINT NOT NULL CHECK (guiche >= 1 AND guiche <= 6),
  atendido_por      TEXT NOT NULL,
  atendido_por_id   UUID REFERENCES public.profiles(id),
  data_hora         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_checkins_data ON public.checkins(data_hora);
CREATE INDEX idx_checkins_guiche ON public.checkins(guiche);
CREATE INDEX idx_checkins_grupo ON public.checkins(grupo_visita_id);

-- 4.8 Cordões entregues por check-in (detalhamento)
CREATE TABLE public.checkin_cordoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id  UUID NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  cor         cordao_color NOT NULL,
  quantidade  SMALLINT NOT NULL CHECK (quantidade > 0)
);

ALTER TABLE public.checkin_cordoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cordoes_checkin ON public.checkin_cordoes(checkin_id);


-- ─────────────────────────────────────────────
-- 5. LISTAS ESPECIAIS
-- ─────────────────────────────────────────────

-- 5.1 Lista de Aniversariantes
CREATE TABLE public.listas_aniversariantes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_aniversariante   TEXT NOT NULL,
  data_nascimento       TEXT,
  responsavel_nome      TEXT NOT NULL,
  responsavel_cpf       TEXT,
  responsavel_celular   TEXT,
  responsavel_email     TEXT,
  data_visita           DATE NOT NULL,
  total_presentes       SMALLINT DEFAULT 0,
  checkin_realizado     BOOLEAN NOT NULL DEFAULT false,
  checkin_data          DATE,
  checkin_hora          TIME,
  guiche                SMALLINT,
  atendido_por          TEXT,
  observacao            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listas_aniversariantes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_aniv_data_visita ON public.listas_aniversariantes(data_visita);

CREATE TRIGGER aniversariantes_updated_at
  BEFORE UPDATE ON public.listas_aniversariantes
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

-- 5.2 Convidados de aniversário (N:1 com lista_aniversariante)
CREATE TABLE public.convidados_aniversario (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id         UUID NOT NULL REFERENCES public.listas_aniversariantes(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  idade            SMALLINT,
  tipo             TEXT NOT NULL CHECK (tipo IN ('crianca', 'acompanhante')),
  pcd              BOOLEAN NOT NULL DEFAULT false,
  pcd_descricao    TEXT,
  cordao_cor       cordao_color,
  presente         BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.convidados_aniversario ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_convidados_lista ON public.convidados_aniversario(lista_id);

-- 5.3 Lista de Instituições
CREATE TABLE public.listas_instituicoes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_instituicao     TEXT NOT NULL,
  tipo_instituicao     TEXT,
  cnpj                 TEXT,
  endereco             TEXT,
  bairro               TEXT,
  cidade               TEXT,
  estado               TEXT DEFAULT 'CE',
  data_visita          DATE NOT NULL,
  responsavel_nome     TEXT NOT NULL,
  responsavel_cpf      TEXT,
  responsavel_celular  TEXT,
  responsavel_email    TEXT,
  total_presentes      SMALLINT DEFAULT 0,
  checkin_realizado     BOOLEAN NOT NULL DEFAULT false,
  checkin_data          DATE,
  checkin_hora          TIME,
  guiche                SMALLINT,
  atendido_por          TEXT,
  observacao            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listas_instituicoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_inst_data_visita ON public.listas_instituicoes(data_visita);
CREATE INDEX idx_inst_cidade ON public.listas_instituicoes(cidade);

CREATE TRIGGER instituicoes_updated_at
  BEFORE UPDATE ON public.listas_instituicoes
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

-- 5.4 Adultos de instituição (N:1)
CREATE TABLE public.adultos_instituicao (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id    UUID NOT NULL REFERENCES public.listas_instituicoes(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  cpf         TEXT,
  presente    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.adultos_instituicao ENABLE ROW LEVEL SECURITY;

-- 5.5 Crianças de instituição (N:1)
CREATE TABLE public.criancas_instituicao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id        UUID NOT NULL REFERENCES public.listas_instituicoes(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  idade           SMALLINT NOT NULL CHECK (idade >= 0 AND idade <= 17),
  genero          TEXT,
  pcd             BOOLEAN NOT NULL DEFAULT false,
  pcd_descricao   TEXT,
  cordao_cor      cordao_color NOT NULL,
  presente        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.criancas_instituicao ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────
-- 6. CONFIGURAÇÕES E LOGS
-- ─────────────────────────────────────────────

-- 6.1 Configuração de alertas (singleton por organização)
CREATE TABLE public.configuracao_alertas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capacidade_maxima     INTEGER NOT NULL DEFAULT 500,
  alerta_capacidade_75  BOOLEAN NOT NULL DEFAULT true,
  alerta_capacidade_90  BOOLEAN NOT NULL DEFAULT true,
  alerta_pcd            BOOLEAN NOT NULL DEFAULT true,
  alerta_guiche_inativo BOOLEAN NOT NULL DEFAULT true,
  alerta_alto_volume    BOOLEAN NOT NULL DEFAULT true,
  alerta_milestones     BOOLEAN NOT NULL DEFAULT true,
  alerta_pendentes      BOOLEAN NOT NULL DEFAULT true,
  milestones            INTEGER[] NOT NULL DEFAULT '{50,100,200,300,400,500}',
  limiar_alto_volume    NUMERIC(3,1) NOT NULL DEFAULT 1.5,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracao_alertas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER config_alertas_updated_at
  BEFORE UPDATE ON public.configuracao_alertas
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

-- 6.2 Log de alertas gerados
CREATE TABLE public.log_alertas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL,
  severidade  TEXT NOT NULL CHECK (severidade IN ('info', 'warning', 'critical')),
  titulo      TEXT NOT NULL,
  mensagem    TEXT,
  visto_por   UUID REFERENCES public.profiles(id),
  visto_em    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.log_alertas ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_alertas_data ON public.log_alertas(created_at);


-- ─────────────────────────────────────────────
-- 7. POLÍTICAS DE SEGURANÇA (RLS)
-- ─────────────────────────────────────────────

-- Profiles: usuários autenticados podem ver todos; apenas próprio perfil edita
CREATE POLICY "Profiles são visíveis para autenticados"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuário edita próprio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- User Roles: apenas admins gerenciam; todos autenticados leem
CREATE POLICY "Roles visíveis para autenticados"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins gerenciam roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Grupos de visita: todos autenticados leem e escrevem (operação de guichê)
CREATE POLICY "Grupos visíveis para autenticados"
  ON public.grupos_visita FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados criam/atualizam grupos"
  ON public.grupos_visita FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Autenticados atualizam grupos"
  ON public.grupos_visita FOR UPDATE
  TO authenticated
  USING (true);

-- Responsáveis: mesma política dos grupos
CREATE POLICY "Responsáveis visíveis" ON public.responsaveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Responsáveis insert" ON public.responsaveis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Responsáveis update" ON public.responsaveis FOR UPDATE TO authenticated USING (true);

-- Crianças
CREATE POLICY "Crianças visíveis" ON public.criancas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Crianças insert" ON public.criancas FOR INSERT TO authenticated WITH CHECK (true);

-- Acompanhantes
CREATE POLICY "Acompanhantes visíveis" ON public.acompanhantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Acompanhantes insert" ON public.acompanhantes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Acompanhantes delete" ON public.acompanhantes FOR DELETE TO authenticated USING (true);

-- Checkins (log imutável - apenas insert e select)
CREATE POLICY "Checkins visíveis" ON public.checkins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Checkins insert" ON public.checkins FOR INSERT TO authenticated WITH CHECK (true);

-- Checkin cordões
CREATE POLICY "Cordões visíveis" ON public.checkin_cordoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cordões insert" ON public.checkin_cordoes FOR INSERT TO authenticated WITH CHECK (true);

-- Listas aniversariantes
CREATE POLICY "Aniv visíveis" ON public.listas_aniversariantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Aniv insert" ON public.listas_aniversariantes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Aniv update" ON public.listas_aniversariantes FOR UPDATE TO authenticated USING (true);

-- Convidados aniversário
CREATE POLICY "Convidados visíveis" ON public.convidados_aniversario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Convidados insert" ON public.convidados_aniversario FOR INSERT TO authenticated WITH CHECK (true);

-- Listas instituições
CREATE POLICY "Inst visíveis" ON public.listas_instituicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inst insert" ON public.listas_instituicoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Inst update" ON public.listas_instituicoes FOR UPDATE TO authenticated USING (true);

-- Adultos instituição
CREATE POLICY "Adultos inst visíveis" ON public.adultos_instituicao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Adultos inst insert" ON public.adultos_instituicao FOR INSERT TO authenticated WITH CHECK (true);

-- Crianças instituição
CREATE POLICY "Criancas inst visíveis" ON public.criancas_instituicao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Criancas inst insert" ON public.criancas_instituicao FOR INSERT TO authenticated WITH CHECK (true);

-- Configuração alertas: todos leem, admins editam
CREATE POLICY "Config alertas visível" ON public.configuracao_alertas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Config alertas admin" ON public.configuracao_alertas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Log alertas
CREATE POLICY "Log alertas visível" ON public.log_alertas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Log alertas insert" ON public.log_alertas FOR INSERT TO authenticated WITH CHECK (true);


-- ─────────────────────────────────────────────
-- 8. VIEWS ANALÍTICAS
-- ─────────────────────────────────────────────

-- 8.1 Dashboard do dia atual
CREATE OR REPLACE VIEW v_dashboard_hoje AS
SELECT
  COUNT(DISTINCT gv.id) AS total_grupos_atendidos,
  COALESCE(SUM(c_count.total_criancas), 0) AS total_criancas,
  COALESCE(SUM(c_count.total_criancas * 2), 0) AS total_adultos,
  COALESCE(SUM(c_count.total_criancas * 2 + c_count.total_criancas), 0) AS total_visitantes,
  COALESCE(SUM(c_count.total_pcd), 0) AS total_pcd,
  COUNT(DISTINCT gv.id) FILTER (WHERE gv.checkin_realizado = false) AS pendentes
FROM public.grupos_visita gv
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_criancas,
    COUNT(*) FILTER (WHERE cr.pcd = true) AS total_pcd
  FROM public.responsaveis r
  JOIN public.criancas cr ON cr.responsavel_id = r.id
  WHERE r.grupo_visita_id = gv.id
) c_count ON true
WHERE gv.data_agendamento = CURRENT_DATE
   OR (gv.data_agendamento IS NULL AND gv.created_at::date = CURRENT_DATE);

-- 8.2 Distribuição geográfica
CREATE OR REPLACE VIEW v_distribuicao_geo AS
SELECT
  'bairro' AS tipo,
  UPPER(TRIM(r.bairro)) AS nome,
  r.cidade,
  r.uf,
  COUNT(*) AS total
FROM public.responsaveis r
JOIN public.grupos_visita gv ON gv.id = r.grupo_visita_id
WHERE gv.checkin_realizado = true
  AND r.bairro IS NOT NULL AND r.bairro != ''
GROUP BY UPPER(TRIM(r.bairro)), r.cidade, r.uf

UNION ALL

SELECT
  'cidade' AS tipo,
  UPPER(TRIM(r.cidade)) AS nome,
  r.cidade,
  r.uf,
  COUNT(*) AS total
FROM public.responsaveis r
JOIN public.grupos_visita gv ON gv.id = r.grupo_visita_id
WHERE gv.checkin_realizado = true
  AND r.cidade IS NOT NULL AND r.cidade != ''
GROUP BY UPPER(TRIM(r.cidade)), r.cidade, r.uf

UNION ALL

SELECT
  'estado' AS tipo,
  UPPER(TRIM(r.uf)) AS nome,
  NULL,
  r.uf,
  COUNT(*) AS total
FROM public.responsaveis r
JOIN public.grupos_visita gv ON gv.id = r.grupo_visita_id
WHERE gv.checkin_realizado = true
  AND r.uf IS NOT NULL AND r.uf != ''
GROUP BY UPPER(TRIM(r.uf)), r.uf
ORDER BY total DESC;

-- 8.3 Performance por guichê
CREATE OR REPLACE VIEW v_performance_guiche AS
SELECT
  ch.guiche,
  COUNT(*) AS total_atendimentos,
  MIN(ch.data_hora) AS primeiro_checkin,
  MAX(ch.data_hora) AS ultimo_checkin,
  SUM(ch.total_criancas) AS total_criancas,
  ch.data_hora::date AS dia
FROM public.checkins ch
GROUP BY ch.guiche, ch.data_hora::date
ORDER BY dia DESC, ch.guiche;

-- 8.4 Contagem de cordões por dia
CREATE OR REPLACE VIEW v_contagem_cordoes AS
SELECT
  cc.cor,
  SUM(cc.quantidade) AS total,
  ch.data_hora::date AS dia
FROM public.checkin_cordoes cc
JOIN public.checkins ch ON ch.id = cc.checkin_id
GROUP BY cc.cor, ch.data_hora::date
ORDER BY dia DESC, cc.cor;

-- 8.5 Fluxo por hora
CREATE OR REPLACE VIEW v_fluxo_horario AS
SELECT
  EXTRACT(HOUR FROM ch.data_hora) AS hora,
  COUNT(*) AS total_checkins,
  SUM(ch.total_criancas) AS total_criancas,
  ch.data_hora::date AS dia
FROM public.checkins ch
GROUP BY EXTRACT(HOUR FROM ch.data_hora), ch.data_hora::date
ORDER BY dia DESC, hora;

-- 8.6 Resumo listas especiais
CREATE OR REPLACE VIEW v_resumo_listas_especiais AS
SELECT
  'aniversariante'::text AS tipo,
  la.nome_aniversariante AS nome,
  la.responsavel_nome,
  la.data_visita,
  (SELECT COUNT(*) FROM public.convidados_aniversario ca WHERE ca.lista_id = la.id AND ca.tipo = 'crianca') AS criancas,
  (SELECT COUNT(*) FROM public.convidados_aniversario ca WHERE ca.lista_id = la.id AND ca.tipo = 'acompanhante') AS adultos,
  la.checkin_realizado,
  la.checkin_data
FROM public.listas_aniversariantes la

UNION ALL

SELECT
  'instituicao'::text AS tipo,
  li.nome_instituicao AS nome,
  li.responsavel_nome,
  li.data_visita,
  (SELECT COUNT(*) FROM public.criancas_instituicao ci WHERE ci.lista_id = li.id) AS criancas,
  (SELECT COUNT(*) FROM public.adultos_instituicao ai WHERE ai.lista_id = li.id) AS adultos,
  li.checkin_realizado,
  li.checkin_data
FROM public.listas_instituicoes li
ORDER BY data_visita DESC;

-- 8.7 Relatório de operação diário
CREATE OR REPLACE VIEW v_relatorio_operacao AS
SELECT
  ch.data_hora::date AS dia,
  COUNT(DISTINCT ch.id) AS total_checkins,
  COUNT(DISTINCT ch.grupo_visita_id) AS total_grupos,
  SUM(ch.total_criancas) AS total_criancas,
  MIN(ch.data_hora) AS primeiro_checkin,
  MAX(ch.data_hora) AS ultimo_checkin,
  (MAX(ch.data_hora) - MIN(ch.data_hora)) AS duracao_operacao,
  COUNT(DISTINCT ch.guiche) AS guiches_ativos
FROM public.checkins ch
GROUP BY ch.data_hora::date
ORDER BY dia DESC;


-- ─────────────────────────────────────────────
-- 9. TRIGGER: Criar perfil ao cadastrar usuário
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────
-- 10. DADOS INICIAIS
-- ─────────────────────────────────────────────

-- Configuração padrão de alertas
INSERT INTO public.configuracao_alertas (
  capacidade_maxima,
  alerta_capacidade_75,
  alerta_capacidade_90,
  alerta_pcd,
  alerta_guiche_inativo,
  alerta_alto_volume,
  alerta_milestones,
  alerta_pendentes,
  milestones,
  limiar_alto_volume
) VALUES (
  500, true, true, true, true, true, true, true,
  '{50,100,200,300,400,500}', 1.5
);


-- ─────────────────────────────────────────────
-- 11. COMENTÁRIOS DE DOCUMENTAÇÃO
-- ─────────────────────────────────────────────

COMMENT ON TABLE public.profiles IS 'Perfis dos operadores do sistema (recreadores, coordenadores, admins)';
COMMENT ON TABLE public.user_roles IS 'Papéis de acesso. Separado do profiles por segurança (evita privilege escalation)';
COMMENT ON TABLE public.grupos_visita IS 'Entidade central: cada grupo familiar agendado para visita';
COMMENT ON TABLE public.responsaveis IS 'Dados do responsável pelo grupo de visita';
COMMENT ON TABLE public.criancas IS 'Crianças do grupo de visita, com faixa etária e cor de cordão';
COMMENT ON TABLE public.acompanhantes IS 'Adultos acompanhantes (além do responsável). Regra: 1 criança = 2 adultos';
COMMENT ON TABLE public.checkins IS 'Log imutável de check-ins realizados nos guichês';
COMMENT ON TABLE public.checkin_cordoes IS 'Detalhamento dos cordões entregues em cada check-in';
COMMENT ON TABLE public.listas_aniversariantes IS 'Grupos de aniversário (não passam pelo agendamento online)';
COMMENT ON TABLE public.convidados_aniversario IS 'Convidados individuais de cada grupo de aniversário';
COMMENT ON TABLE public.listas_instituicoes IS 'Grupos de instituições (CRAS, escolas, etc.)';
COMMENT ON TABLE public.adultos_instituicao IS 'Adultos acompanhantes das instituições';
COMMENT ON TABLE public.criancas_instituicao IS 'Crianças trazidas pelas instituições';
COMMENT ON TABLE public.configuracao_alertas IS 'Configurações de alertas operacionais (capacidade, PCD, volume)';
COMMENT ON TABLE public.log_alertas IS 'Histórico de alertas gerados pelo sistema';

COMMENT ON FUNCTION public.get_cordao_cor IS 'Retorna a cor do cordão com base na faixa etária da criança';
COMMENT ON FUNCTION public.calc_vagas_acompanhante IS 'Calcula vagas restantes para adultos acompanhantes';
COMMENT ON FUNCTION public.has_role IS 'Verifica se um usuário possui determinado papel (security definer para RLS)';

COMMENT ON VIEW v_dashboard_hoje IS 'Métricas consolidadas do dia atual para o dashboard';
COMMENT ON VIEW v_distribuicao_geo IS 'Distribuição geográfica dos visitantes por bairro, cidade e estado';
COMMENT ON VIEW v_performance_guiche IS 'Performance de cada guichê por dia';
COMMENT ON VIEW v_contagem_cordoes IS 'Contagem de cordões entregues por cor e por dia';
COMMENT ON VIEW v_fluxo_horario IS 'Distribuição de check-ins por hora do dia';
COMMENT ON VIEW v_resumo_listas_especiais IS 'Resumo consolidado de aniversariantes e instituições';
COMMENT ON VIEW v_relatorio_operacao IS 'Relatório diário de operação com totais e duração';


-- ═══════════════════════════════════════════════════════════════════════
-- SCRIPT CONCLUÍDO
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- PRÓXIMOS PASSOS:
--   1. No Supabase Dashboard > Authentication > Users, crie o primeiro
--      usuário administrador (email + senha)
--   2. No SQL Editor, insira o papel de admin para ele:
--      INSERT INTO public.user_roles (user_id, role)
--      VALUES ('<UUID_DO_USUARIO>', 'admin');
--   3. Configure as variáveis de ambiente no frontend:
--      VITE_SUPABASE_URL=https://seu-projeto.supabase.co
--      VITE_SUPABASE_ANON_KEY=sua_anon_key
--   4. Para auto-hospedagem local/intranet, consulte DEPLOY.md
-- ═══════════════════════════════════════════════════════════════════════
