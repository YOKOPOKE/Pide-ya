-- Create table for storing WhatsApp conversation state
create table if not exists whatsapp_sessions (
    phone text primary key,
    state jsonb default '{}'::jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS (although mostly used by service role)
alter table whatsapp_sessions enable row level security;

-- Create policy for text role (Edge Functions)
create policy "Service role can manage sessions"
    on whatsapp_sessions
    for all
    using (true)
    with check (true);
