# Sentinela Infância — Guia de Deploy

## Sobre o Sistema

O **Sentinela Infância** é o sistema de controle operacional de visitantes da **Cidade Mais Infância**, desenvolvido para gerenciar check-in, distribuição de cordões por faixa etária, listas especiais (aniversariantes e instituições) e relatórios de operação em tempo real.

### Funcionalidades Principais

| Módulo | Descrição |
|--------|-----------|
| **Check-in de Visitantes** | 6 guichês simultâneos com sincronização em tempo real |
| **Cadastro Manual** | Para visitantes sem agendamento, com controle de acompanhantes |
| **Listas Especiais** | Importação de aniversariantes e instituições via Excel |
| **Dashboard Admin** | Métricas em tempo real, gráficos e alertas operacionais |
| **Relatórios** | Relatório final de operação com contagem de cordões |
| **Histórico & Geo** | Gráficos comparativos e distribuição geográfica |
| **Alertas** | Capacidade, PCD, guichê inativo, marcos de atendimento |
| **Gestão de Usuários** | Admin, Coordenador, Recreador, Observador |

### Cores de Cordão (Regra de Negócio)

| Cor | Faixa Etária |
|-----|-------------|
| 🔵 Azul | 0-3 anos |
| 🟢 Verde | 4-6 anos |
| 🟡 Amarelo | 7-9 anos |
| 🔴 Vermelho | 10-12 anos |
| 🩷 Rosa | Adulto/Responsável |
| ⚪ Cinza | Terceirizado |
| ⚫ Preto | Serviço |

---

## Opções de Deploy

### Opção 1: Lovable Cloud (Recomendado)

A forma mais rápida. O Lovable Cloud provisiona Supabase automaticamente.

1. Abra o projeto no [Lovable](https://lovable.dev)
2. Ative o **Lovable Cloud** nas configurações
3. Execute o `sentinela_database_schema.sql` no SQL Editor do Cloud
4. Publique via **Share → Publish**

### Opção 2: Supabase + Vercel/Netlify

Para hospedar na nuvem com seu próprio Supabase.

#### 1. Criar projeto Supabase
```
1. Acesse https://supabase.com e crie uma conta
2. Crie um novo projeto (Free tier é suficiente)
3. Anote a URL e a Anon Key (Settings → API)
```

#### 2. Executar o schema SQL
```
1. No Supabase Dashboard → SQL Editor
2. Cole o conteúdo de sentinela_database_schema.sql
3. Execute
```

#### 3. Criar o primeiro admin
```sql
-- No SQL Editor do Supabase:

-- 1. Crie um usuário em Authentication → Users → Add User
--    Email: admin@sentinela.local | Senha: sua-senha-segura

-- 2. Depois de criado, copie o UUID e execute:
INSERT INTO public.user_roles (user_id, role)
VALUES ('UUID_DO_USUARIO_AQUI', 'admin');
```

#### 4. Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

#### 5. Build e deploy
```bash
npm install
npm run build
# O resultado fica em dist/ — faça deploy no Vercel, Netlify ou servidor
```

### Opção 3: Auto-Hospedagem Local / Intranet

Para rodar na rede interna sem internet.

#### 1. Instalar Supabase Local

```bash
# Pré-requisitos: Docker e Docker Compose
# Instale o Supabase CLI:
npm install -g supabase

# Inicialize o Supabase local
supabase init
supabase start

# Anote a URL local (geralmente http://localhost:54321)
# e a anon key exibida no terminal
```

#### 2. Aplicar o schema
```bash
# Copie o schema para uma migration
cp sentinela_database_schema.sql supabase/migrations/001_schema_inicial.sql

# Aplique
supabase db reset
```

#### 3. Criar admin local
```bash
# Acesse http://localhost:54323 (Studio local)
# Authentication → Add User → admin@local / sua-senha

# Depois no SQL Editor:
INSERT INTO public.user_roles (user_id, role)
VALUES ('UUID_DO_ADMIN', 'admin');
```

#### 4. Configurar e rodar o frontend
```bash
# .env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=sua_anon_key_local

# Rodar em desenvolvimento
npm run dev

# Ou build para produção
npm run build
# Sirva a pasta dist/ com qualquer servidor web (nginx, apache, serve)
npx serve dist -l 3000
```

#### 5. Configurar como Intranet

Para acesso por outros computadores na rede local:

```bash
# Descubra o IP da máquina:
# Windows: ipconfig
# Linux/Mac: ifconfig ou ip addr

# Configure o Vite para aceitar conexões externas:
# Em vite.config.ts, o host já está como "::" (aceita todas interfaces)

# Outros computadores acessam via:
# http://192.168.X.X:8080  (desenvolvimento)
# http://192.168.X.X:3000  (produção com serve)
```

### Opção 4: GitHub + GitHub Pages (Modo localStorage)

O sistema atual funciona **100% com localStorage** (sem banco de dados externo). Para um deploy rápido de demonstração:

```bash
# 1. Suba para o GitHub
git init
git add .
git commit -m "Sentinela Infância v2.0"
git remote add origin https://github.com/SEU-USUARIO/sentinela-infancia.git
git push -u origin main

# 2. No GitHub: Settings → Pages → Source: GitHub Actions
# 3. Crie .github/workflows/deploy.yml (ver abaixo)
```

**GitHub Actions para deploy:**
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

---

## Estrutura do Banco de Dados

### Diagrama de Tabelas

```
auth.users
  └── profiles (1:1)
  └── user_roles (1:N)

grupos_visita
  └── responsaveis (1:1)
       └── criancas (1:N)
       └── acompanhantes (1:N)
  └── checkins (1:N)
       └── checkin_cordoes (1:N)

listas_aniversariantes
  └── convidados_aniversario (1:N)

listas_instituicoes
  └── adultos_instituicao (1:N)
  └── criancas_instituicao (1:N)

configuracao_alertas (singleton)
log_alertas
```

### Views Analíticas

| View | Descrição |
|------|-----------|
| `v_dashboard_hoje` | Métricas consolidadas do dia atual |
| `v_distribuicao_geo` | Bairros, cidades e estados dos visitantes |
| `v_performance_guiche` | Atendimentos por guichê por dia |
| `v_contagem_cordoes` | Cordões entregues por cor por dia |
| `v_fluxo_horario` | Distribuição de check-ins por hora |
| `v_resumo_listas_especiais` | Consolidado de aniversariantes e instituições |
| `v_relatorio_operacao` | Resumo diário com duração da operação |

---

## Perfis de Acesso

| Perfil | Permissões |
|--------|------------|
| **Admin** | Acesso total: dashboard, importação, usuários, relatórios, configurações, listas especiais, gráficos históricos |
| **Coordenador** | Painel em tempo real, alertas operacionais, visão de todos os guichês e métricas de performance |
| **Recreador** | Check-in de visitantes no guichê, cadastro manual, visualização de cordões e detalhes do visitante |
| **Observador** | Visualização como recreador sem ocupar guichê. Check-ins são teste e não contam no relatório oficial |

---

## Regras de Negócio Principais

1. **Cordões por idade**: Cor determinada automaticamente pela faixa etária
2. **Adultos por criança**: Cada criança dá direito a **2 adultos** (responsável + 1 acompanhante)
3. **Sincronização**: Dados sincronizados entre guichês via storage events + polling 3s
4. **Listas especiais**: Aniversariantes e instituições são importados via Excel e têm controle separado
5. **Alertas**: Capacidade (75%/90%), PCD, guichê inativo, alto volume, marcos

---

## Tecnologias

- **Frontend**: React 18, TypeScript 5, Vite 5, Tailwind CSS 3, shadcn/ui
- **Gráficos**: Recharts
- **Animações**: Framer Motion
- **Importação**: PapaParse (CSV), SheetJS (Excel)
- **Backend**: Supabase (PostgreSQL 15+, Auth, RLS)

---

## Suporte

Para dúvidas ou problemas, entre em contato com a equipe de TI.

**Desenvolvido para a Cidade Mais Infância — Governo do Estado do Ceará**
