-- ===========================================
-- OAuth 2.1 for the Claude connector (MCP server at /api/mcp)
-- ===========================================
-- Only the server (service role) reads or writes these tables. RLS is enabled with
-- no policies, which denies all access through the anon/authenticated keys, except
-- that users can list and revoke their own connections (oauth_grants).
-- Secrets (client secrets, codes, tokens) are stored only as SHA-256 hashes.

-- Apps registered through dynamic client registration (RFC 7591)
create table public.oauth_clients (
  client_id text primary key,
  client_secret_hash text, -- null for public clients, which rely on PKCE alone
  client_name text,
  redirect_uris text[] not null,
  created_at timestamptz default now() not null
);

alter table public.oauth_clients enable row level security;

-- One row per approved connection; deleting it revokes every code and token issued under it
create table public.oauth_grants (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  client_id text references public.oauth_clients(client_id) on delete cascade not null,
  client_name text,
  scope text not null,
  created_at timestamptz default now() not null,
  last_used_at timestamptz
);

alter table public.oauth_grants enable row level security;

create policy "Users can view own connections"
  on public.oauth_grants for select using (auth.uid() = user_id);

create policy "Users can revoke own connections"
  on public.oauth_grants for delete using (auth.uid() = user_id);

-- Consent screens awaiting a decision; the random id doubles as a CSRF token
create table public.oauth_authorization_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  client_id text references public.oauth_clients(client_id) on delete cascade not null,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null,
  state text,
  resource text,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null
);

alter table public.oauth_authorization_requests enable row level security;

create table public.oauth_codes (
  code_hash text primary key,
  grant_id uuid references public.oauth_grants(id) on delete cascade not null,
  redirect_uri text not null,
  code_challenge text not null,
  resource text,
  expires_at timestamptz not null,
  used_at timestamptz
);

alter table public.oauth_codes enable row level security;

create table public.oauth_tokens (
  token_hash text primary key,
  grant_id uuid references public.oauth_grants(id) on delete cascade not null,
  kind text not null check (kind in ('access', 'refresh')),
  expires_at timestamptz not null,
  used_at timestamptz, -- refresh tokens: set when rotated; a second use revokes the grant
  created_at timestamptz default now() not null
);

alter table public.oauth_tokens enable row level security;

create index idx_oauth_grants_user on public.oauth_grants(user_id);
create index idx_oauth_codes_grant on public.oauth_codes(grant_id);
create index idx_oauth_tokens_grant on public.oauth_tokens(grant_id);
create index idx_oauth_tokens_expires on public.oauth_tokens(expires_at);
create index idx_oauth_requests_expires on public.oauth_authorization_requests(expires_at);
