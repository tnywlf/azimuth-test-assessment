-- ============================================
-- Azimuth Property Management - Supabase Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enable pgvector extension for AI vector embeddings
create extension if not exists "vector";

-- =====================
-- PROFILES TABLE
-- =====================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null check (role in ('tenant', 'landlord', 'agent')),
  avatar_url text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- PROPERTIES TABLE
-- =====================
create table if not exists public.properties (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  address text not null,
  city text,
  state text,
  zip_code text,
  property_type text default 'apartment' check (property_type in ('apartment', 'house', 'condo', 'commercial')),
  bedrooms integer default 0,
  bathrooms integer default 0,
  rent_amount numeric default 0,
  status text default 'available' check (status in ('available', 'occupied', 'maintenance')),
  landlord_id uuid references public.profiles(id) on delete cascade not null,
  agent_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- PROPERTY TENANTS (many-to-many)
-- =====================
create table if not exists public.property_tenants (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references public.properties(id) on delete cascade not null,
  tenant_id uuid references public.profiles(id) on delete cascade not null,
  lease_start date,
  lease_end date,
  status text default 'active' check (status in ('active', 'inactive', 'pending')),
  created_at timestamptz default now(),
  unique(property_id, tenant_id)
);

-- =====================
-- CONVERSATIONS
-- =====================
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- CONVERSATION PARTICIPANTS
-- =====================
create table if not exists public.conversation_participants (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(conversation_id, user_id)
);

-- =====================
-- MESSAGES
-- =====================
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- =====================
-- AI SUMMARIES
-- =====================
create table if not exists public.ai_summaries (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  summary text not null,
  created_at timestamptz default now()
);

-- =====================
-- NOTIFICATIONS (Push Notifications)
-- =====================
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in (
    'new_message',
    'property_assignment',
    'tenant_assigned',
    'tenant_removed',
    'maintenance_alert',
    'lease_update',
    'system'
  )),
  title text not null,
  body text not null,
  data jsonb default '{}',
  read boolean default false,
  created_at timestamptz default now()
);

-- =====================
-- CONVERSATION EMBEDDINGS (Vector DB for AI)
-- =====================
create table if not exists public.conversation_embeddings (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null unique,
  content text not null,
  embedding vector(1536),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- =====================
-- INDEXES
-- =====================
create index if not exists idx_properties_landlord on public.properties(landlord_id);
create index if not exists idx_properties_agent on public.properties(agent_id);
create index if not exists idx_property_tenants_property on public.property_tenants(property_id);
create index if not exists idx_property_tenants_tenant on public.property_tenants(tenant_id);
create index if not exists idx_conv_participants_conv on public.conversation_participants(conversation_id);
create index if not exists idx_conv_participants_user on public.conversation_participants(user_id);
create index if not exists idx_messages_conversation on public.messages(conversation_id);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_created on public.messages(conversation_id, created_at desc);

-- Notification indexes
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read) where read = false;
create index if not exists idx_notifications_created on public.notifications(user_id, created_at desc);

-- Vector similarity search index (IVFFlat for fast approximate nearest neighbor)
create index if not exists idx_conversation_embeddings_vector
  on public.conversation_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- =====================
-- ROW LEVEL SECURITY
-- =====================
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_tenants enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.notifications enable row level security;
alter table public.conversation_embeddings enable row level security;

-- Profiles policies
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Properties policies
create policy "properties_select" on public.properties for select using (true);
create policy "properties_insert" on public.properties for insert with check (true);
create policy "properties_update" on public.properties for update using (
  landlord_id = auth.uid() or agent_id = auth.uid()
);
create policy "properties_delete" on public.properties for delete using (
  landlord_id = auth.uid()
);

-- Property tenants policies
create policy "property_tenants_select" on public.property_tenants for select using (true);
create policy "property_tenants_insert" on public.property_tenants for insert with check (true);
create policy "property_tenants_delete" on public.property_tenants for delete using (true);

-- Conversations policies
create policy "conversations_select" on public.conversations for select using (
  exists (
    select 1 from public.conversation_participants
    where conversation_id = id and user_id = auth.uid()
  )
);
create policy "conversations_insert" on public.conversations for insert with check (true);
create policy "conversations_update" on public.conversations for update using (
  exists (
    select 1 from public.conversation_participants
    where conversation_id = id and user_id = auth.uid()
  )
);

-- Conversation participants policies
create policy "conv_participants_select" on public.conversation_participants for select using (true);
create policy "conv_participants_insert" on public.conversation_participants for insert with check (true);

-- Messages policies
create policy "messages_select" on public.messages for select using (
  exists (
    select 1 from public.conversation_participants
    where conversation_id = messages.conversation_id and user_id = auth.uid()
  )
);
create policy "messages_insert" on public.messages for insert with check (
  exists (
    select 1 from public.conversation_participants
    where conversation_id = messages.conversation_id and user_id = auth.uid()
  )
);

-- AI summaries policies
create policy "ai_summaries_select" on public.ai_summaries for select using (
  exists (
    select 1 from public.conversation_participants
    where conversation_id = ai_summaries.conversation_id and user_id = auth.uid()
  )
);
create policy "ai_summaries_insert" on public.ai_summaries for insert with check (true);

-- Notifications policies (users can only see their own)
create policy "notifications_select" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_insert" on public.notifications
  for insert with check (true);
create policy "notifications_update" on public.notifications
  for update using (user_id = auth.uid());
create policy "notifications_delete" on public.notifications
  for delete using (user_id = auth.uid());

-- Conversation embeddings policies
create policy "conv_embeddings_select" on public.conversation_embeddings
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = conversation_embeddings.conversation_id
      and user_id = auth.uid()
    )
  );
create policy "conv_embeddings_insert" on public.conversation_embeddings
  for insert with check (true);
create policy "conv_embeddings_update" on public.conversation_embeddings
  for update using (true);

-- =====================
-- REALTIME
-- =====================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

-- =====================
-- TRIGGERS
-- =====================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger on_properties_updated
  before update on public.properties
  for each row execute function public.handle_updated_at();

create trigger on_conversations_updated
  before update on public.conversations
  for each row execute function public.handle_updated_at();

-- =====================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- =====================
-- This function is called by the backend to find similar conversations.
-- It filters by user participation to ensure users only see their own conversations.
create or replace function public.match_conversations(
  query_embedding text,
  match_threshold float default 0.5,
  match_count int default 5,
  p_user_id uuid default null
)
returns table (
  conversation_id uuid,
  content text,
  similarity float,
  metadata jsonb
)
language plpgsql
as $$
begin
  return query
    select
      ce.conversation_id,
      ce.content,
      1 - (ce.embedding <=> query_embedding::vector) as similarity,
      ce.metadata
    from public.conversation_embeddings ce
    where
      -- Only return conversations the user participates in
      (p_user_id is null or exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = ce.conversation_id
        and cp.user_id = p_user_id
      ))
      -- Filter by similarity threshold
      and 1 - (ce.embedding <=> query_embedding::vector) > match_threshold
    order by ce.embedding <=> query_embedding::vector
    limit match_count;
end;
$$;
