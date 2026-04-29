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
drop policy if exists "Admin/Superadmin full access to subscriptions" on subscriptions;
create policy "Admin/Superadmin full access to subscriptions" on subscriptions for all using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('superadmin', 'admin'))
);

drop policy if exists "Employees can view own subscriptions" on subscriptions;
create policy "Employees can view own subscriptions" on subscriptions for select using (owner_id = auth.uid());

-- Leave Requests RLS
alter table leave_requests enable row level security;

drop policy if exists "Employees can view own leaves" on leave_requests;
create policy "Employees can view own leaves" on leave_requests for select using (employee_id = auth.uid());

drop policy if exists "Employees can insert own leaves" on leave_requests;
create policy "Employees can insert own leaves" on leave_requests for insert with check (employee_id = auth.uid());

drop policy if exists "Admin/Superadmin full access to leaves" on leave_requests;
create policy "Admin/Superadmin full access to leaves" on leave_requests for all using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('superadmin', 'admin'))
);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
