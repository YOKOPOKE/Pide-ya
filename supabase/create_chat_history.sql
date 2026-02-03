-- Create table for storing full chat history
create table if not exists chat_history (
    id uuid default gen_random_uuid() primary key,
    phone text not null,
    message text not null,
    sender text not null check (sender in ('user', 'bot')),
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Index for fast queries by phone number
create index if not exists idx_chat_history_phone on chat_history(phone);

-- Enable RLS
alter table chat_history enable row level security;

-- Policy for Service Role (Bot) to Full Access
create policy "Service role can manage chat history"
    on chat_history
    for all
    using (true)
    with check (true);
