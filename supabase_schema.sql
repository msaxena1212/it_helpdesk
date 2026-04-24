-- IT Helpdesk CRM Master Synchronized Schema (Supabase)
-- Finalized on 2026-04-23

-- 1. Profiles Table (Linked to Auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  role text check (role in ('employee', 'admin', 'superadmin')) default 'employee',
  department text default 'General',
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Assets Table
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  device_name text not null,
  device_id text unique not null,
  assigned_to uuid references profiles(id),
  warranty_expiry date,
  purchase_date date,
  status text check (status in ('active', 'repair', 'retired', 'missing')) default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Tickets Table
create table if not exists tickets (
  id text primary key default ('TC-' || lpad(floor(random() * 100000)::text, 5, '0')),
  title text not null,
  description text,
  issue_type text,
  sub_type text,
  priority text check (priority in ('Low', 'Medium', 'High', 'Critical')) default 'Medium',
  status text check (status in ('Open', 'Assigned', 'In Progress', 'Waiting for User', 'Resolved', 'Closed')) default 'Open',
  employee_id uuid references profiles(id),
  guest_name text,
  guest_email text,
  assigned_to uuid references profiles(id),
  device_id uuid references assets(id),
  is_blocked boolean default false,
  issue_start_date date,
  frequency text,
  sla_deadline timestamp with time zone,
  sla_breached boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Ticket Comments (Conversations)
create table if not exists ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id text references tickets(id) on delete cascade,
  user_id uuid references profiles(id),
  comment text not null,
  attachment_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Internal Notes (Admin only)
create table if not exists internal_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id text references tickets(id) on delete cascade,
  admin_id uuid references profiles(id),
  note text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Status History (Audit Trail)
create table if not exists ticket_status_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id text references tickets(id) on delete cascade,
  old_status text,
  new_status text,
  changed_by uuid references profiles(id),
  changed_at timestamp with time zone default timezone('utc'::text, now())
);

-- 7. Notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  type text,
  title text,
  message text,
  severity text check (severity in ('Info', 'Warning', 'Critical')) default 'Info',
  ticket_id text references tickets(id),
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 8. Activity Logs
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_id text references tickets(id) on delete cascade,
  action text not null,
  performed_by uuid references profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 9. SLA Configuration
create table if not exists sla_config (
  id uuid primary key default gen_random_uuid(),
  department text default 'General',
  priority text,
  resolution_hours int,
  unique(department, priority)
);

-- 10. Asset History (Lifecycle Tracking)
create table if not exists asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id) on delete cascade,
  employee_id uuid references profiles(id),
  action text check (action in ('allocate', 'deallocate', 'reallocate', 'register', 'audit', 'missing')),
  performed_by uuid references profiles(id),
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create index if not exists idx_asset_history_asset on asset_history(asset_id);
create index if not exists idx_asset_history_employee on asset_history(employee_id);

-- 11. Row Level Security (RLS)
alter table profiles enable row level security;
alter table tickets enable row level security;
alter table ticket_comments enable row level security;
alter table internal_notes enable row level security;
alter table assets enable row level security;
alter table asset_history enable row level security;
alter table notifications enable row level security;

-- Policies: Profiles
create policy "Profiles are viewable by authenticated users" on profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Policies: Assets & History
create policy "Assets are viewable by authenticated users" on assets for select using (auth.role() = 'authenticated');
create policy "Admins can manage assets" on assets for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'superadmin')));
create policy "Asset history viewable by authenticated" on asset_history for select using (auth.role() = 'authenticated');
create policy "Admins can insert asset history" on asset_history for insert with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'superadmin')));

-- Policies: Tickets
create policy "Employees can view own tickets" on tickets for select using (auth.uid() = employee_id);
create policy "Public can insert guest tickets" on tickets for insert with check (
  (auth.uid() is null and employee_id is null) or 
  (auth.uid() = employee_id) or
  (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'superadmin')))
);

-- Policies: Comments & Notes
create policy "Users can view comments" on ticket_comments for select using (exists (select 1 from tickets where id = ticket_id));
create policy "Users can insert comments" on ticket_comments for insert with check (auth.uid() = user_id);
create policy "Admins can view internal notes" on internal_notes for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'superadmin')));
create policy "Admins can insert internal notes" on internal_notes for insert with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'superadmin')));

-- Seed Initial SLA Data
insert into sla_config (department, priority, resolution_hours) values
('General', 'Critical', 4), ('General', 'High', 8), ('General', 'Medium', 24), ('General', 'Low', 72),
('Engineering', 'Critical', 2), ('Engineering', 'High', 4)
on conflict (department, priority) do nothing;

-- Auth Sync Function
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email, coalesce(new.raw_user_meta_data->>'role', 'employee'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Promote superadmin email
update public.profiles set role = 'superadmin' where email = 'superadmin@elitemindz.co';
