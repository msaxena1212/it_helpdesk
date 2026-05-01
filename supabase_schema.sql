-- IT Helpdesk CRM Master Synchronized Schema (Supabase)
-- Finalized on 2026-04-23

-- 0. Migration Patches (Ensure existing tables have new columns)
alter table profiles add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());
alter table tickets add column if not exists procurement_status text;
alter table tickets add column if not exists inventory_manager_id uuid references profiles(id);
alter table tickets add column if not exists inventory_remarks text;
alter table tickets add column if not exists procurement_supplier text;
alter table tickets add column if not exists procurement_cost numeric(10,2);
alter table tickets add column if not exists procurement_expected_date date;
alter table tickets add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- Update constraints if they don't exist
do $$ 
begin
  -- Update Tickets procurement status check
  if not exists (select 1 from information_schema.constraint_column_usage where table_name = 'tickets' and constraint_name = 'tickets_procurement_status_check') then
    alter table tickets add constraint tickets_procurement_status_check check (procurement_status in ('Requested', 'Procuring', 'Handover Pending', 'Completed'));
  end if;

  -- Update Profiles role check
  alter table profiles drop constraint if exists profiles_role_check;
  alter table profiles add constraint profiles_role_check check (role in ('employee', 'admin', 'superadmin', 'inventory_manager', 'devops'));
end $$;

-- 1. Profiles Table (Linked to Auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  role text check (role in ('employee', 'admin', 'superadmin', 'inventory_manager', 'devops')) default 'employee',
  department text default 'General',
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Trigger function for updated_at
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at before update on profiles for each row execute procedure handle_updated_at();

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
  status text check (status in ('Open', 'Assigned', 'In Progress', 'Waiting for User', 'Waiting for Inventory', 'Resolved', 'Closed')) default 'Open',
  procurement_status text check (procurement_status in ('Requested', 'Procuring', 'Handover Pending', 'Completed')),
  inventory_manager_id uuid references profiles(id),
  inventory_remarks text,
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

-- Helper function to avoid recursion in RLS
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer;

-- Policies: Profiles
drop policy if exists "Profiles are viewable by authenticated users" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Superadmins can manage all profiles" on profiles;
create policy "Profiles are viewable by authenticated users" on profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Superadmins can manage all profiles" on profiles for all using (get_user_role() = 'superadmin');

-- Policies: Assets & History
drop policy if exists "Assets are viewable by authenticated users" on assets;
drop policy if exists "Admins can manage assets" on assets;
drop policy if exists "Asset history viewable by authenticated" on asset_history;
drop policy if exists "Admins can insert asset history" on asset_history;
create policy "Assets are viewable by authenticated users" on assets for select using (auth.role() = 'authenticated');
create policy "Admins can manage assets" on assets for all using (get_user_role() in ('admin', 'superadmin', 'inventory_manager'));
create policy "Asset history viewable by authenticated" on asset_history for select using (auth.role() = 'authenticated');
create policy "Admins can insert asset history" on asset_history for insert with check (get_user_role() in ('admin', 'superadmin', 'inventory_manager'));

-- Policies: Tickets
drop policy if exists "Employees can view own tickets" on tickets;
drop policy if exists "Admins and Managers can view all tickets" on tickets;
drop policy if exists "Public can insert guest tickets" on tickets;
drop policy if exists "Admins and Managers can update tickets" on tickets;
drop policy if exists "Employees can update own tickets" on tickets;

create policy "Employees can view own tickets" on tickets for select using (auth.uid() = employee_id);
create policy "Admins and Managers can view all tickets" on tickets for select using (get_user_role() in ('admin', 'superadmin', 'inventory_manager', 'devops'));
create policy "Admins and Managers can update tickets" on tickets for update using (get_user_role() in ('admin', 'superadmin', 'inventory_manager', 'devops'));
create policy "Employees can update own tickets" on tickets for update using (auth.uid() = employee_id);

create policy "Public can insert guest tickets" on tickets for insert with check (
  (auth.uid() is null and employee_id is null) or 
  (auth.uid() = employee_id) or
  (get_user_role() in ('admin', 'superadmin', 'inventory_manager', 'devops'))
);

-- Policies: Comments & Notes
drop policy if exists "Users can view comments" on ticket_comments;
drop policy if exists "Users can insert comments" on ticket_comments;
drop policy if exists "Admins can view internal notes" on internal_notes;
drop policy if exists "Admins can insert internal notes" on internal_notes;
create policy "Users can view comments" on ticket_comments for select using (exists (select 1 from tickets where id = ticket_id));
create policy "Users can insert comments" on ticket_comments for insert with check (auth.uid() = user_id);
create policy "Admins can view internal notes" on internal_notes for select using (get_user_role() in ('admin', 'superadmin', 'devops'));
create policy "Admins can insert internal notes" on internal_notes for insert with check (get_user_role() in ('admin', 'superadmin', 'devops'));

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

-- Tickets update trigger
drop trigger if exists set_tickets_updated_at on tickets;
create trigger set_tickets_updated_at before update on tickets for each row execute procedure handle_updated_at();

-- 10. IT Subscriptions (Recurring Reminders & Payment)
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  cost numeric(10,2),
  billing_cycle text check (billing_cycle in ('Monthly', 'Yearly', 'Quarterly')),
  next_due_date date not null,
  owner_id uuid references profiles(id),
  status text check (status in ('Active', 'Cancelled')) default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 11. Leave Requests (Employee Self-Service)
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references profiles(id) on delete cascade not null,
  manager_id uuid references profiles(id),
  leave_type text check (leave_type in ('Sick', 'Casual', 'Privilege', 'Unpaid')) not null,
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text check (status in ('Pending', 'Approved', 'Rejected')) default 'Pending',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Trigger functions for new tables
drop trigger if exists set_subscriptions_updated_at on subscriptions;
create trigger set_subscriptions_updated_at before update on subscriptions for each row execute procedure handle_updated_at();

drop trigger if exists set_leave_requests_updated_at on leave_requests;
create trigger set_leave_requests_updated_at before update on leave_requests for each row execute procedure handle_updated_at();

-- Additional Alterations for Tickets table to support Deployment & GitLab requests
alter table tickets add column if not exists custom_fields jsonb default '{}'::jsonb;

-- RLS Policies for new tables

-- Subscriptions RLS
alter table subscriptions enable row level security;
drop policy if exists "Superadmin full access to subscriptions" on subscriptions;
create policy "Superadmin full access to subscriptions" on subscriptions for all using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'superadmin')
);

drop policy if exists "Employees can view own subscriptions" on subscriptions;
create policy "Employees can view own subscriptions" on subscriptions for select using (owner_id = auth.uid());

-- Leave Requests RLS
alter table leave_requests enable row level security;

drop policy if exists "Employees can view own leaves" on leave_requests;
create policy "Employees can view own leaves" on leave_requests for select using (employee_id = auth.uid());

drop policy if exists "Employees can insert own leaves" on leave_requests;
create policy "Employees can insert own leaves" on leave_requests for insert with check (employee_id = auth.uid());

drop policy if exists "Superadmin full access to leaves" on leave_requests;
create policy "Superadmin full access to leaves" on leave_requests for all using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'superadmin')
);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
