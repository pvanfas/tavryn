-- Stage 0009: One-Tap HMAC Approvals and Human Override Memory

-- 1. approval_tokens: secure, signed, single-use approval links
create table if not exists approval_tokens (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  negotiation_id uuid references negotiations(id) on delete set null,
  token_hash text not null unique,
  action text not null check (action in ('approve', 'reject', 'decide')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_approval_tokens_token_hash on approval_tokens(token_hash);
create index if not exists idx_approval_tokens_contract on approval_tokens(contract_id);

-- 2. override_memory: structured feedback from supervisor rejections
create table if not exists override_memory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  category text not null,
  reason_code text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_override_memory_business_vendor on override_memory(business_id, vendor_id);
create index if not exists idx_override_memory_category on override_memory(category);
