-- TBY Badminton Slot Booking - Supabase schema
-- Chạy toàn bộ trong Supabase > SQL Editor > New query

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  venue text not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  level_range text not null default 'Yếu+ → TB-',
  male_slots int not null default 5 check (male_slots >= 0),
  female_slots int not null default 5 check (female_slots >= 0),
  male_fee int not null default 0,
  female_fee int not null default 0,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  gender text not null check (gender in ('male','female')),
  level text not null,
  phone text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.admin_users enable row level security;

-- View công khai: không lộ SĐT / ghi chú.
create or replace view public.events_public
with (security_invoker = true)
as
select
  e.*,
  count(r.id) filter (where r.gender='male')::int as male_count,
  count(r.id) filter (where r.gender='female')::int as female_count,
  coalesce(jsonb_agg(jsonb_build_object('full_name',r.full_name,'gender',r.gender,'level',r.level) order by r.created_at)
    filter (where r.id is not null),'[]'::jsonb) as players
from public.events e
left join public.registrations r on r.event_id=e.id
group by e.id;

grant select on public.events_public to anon, authenticated;

create policy "public read events" on public.events for select using (true);
create policy "public read safe registrations" on public.registrations for select using (true);

-- Admin được xác định bằng auth.uid() có trong admin_users.
create policy "admins read admin_users" on public.admin_users for select to authenticated using (user_id = auth.uid());
create policy "admins insert events" on public.events for insert to authenticated with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "admins update events" on public.events for update to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "admins delete events" on public.events for delete to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "admins manage registrations" on public.registrations for all to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

-- Hàm đăng ký có khóa dòng để tránh 2 người giành slot cuối cùng cùng lúc.
create or replace function public.register_player(
  event_id uuid,
  full_name text,
  gender text,
  level text,
  phone text,
  note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
  current_count int;
  new_id uuid;
begin
  if trim(coalesce(full_name,''))='' or trim(coalesce(phone,''))='' then
    raise exception 'Vui lòng nhập họ tên và số điện thoại/Zalo.';
  end if;
  if gender not in ('male','female') then raise exception 'Giới tính không hợp lệ.'; end if;

  select * into ev from public.events where id=event_id for update;
  if not found then raise exception 'Kèo không tồn tại.'; end if;
  if not ev.is_open then raise exception 'Kèo đã đóng đăng ký.'; end if;
  if ev.event_date < current_date then raise exception 'Kèo này đã diễn ra.'; end if;

  select count(*) into current_count from public.registrations where registrations.event_id=register_player.event_id and registrations.gender=register_player.gender;
  if gender='male' and current_count >= ev.male_slots then raise exception 'Slot nam đã đủ.'; end if;
  if gender='female' and current_count >= ev.female_slots then raise exception 'Slot nữ đã đủ.'; end if;

  insert into public.registrations(event_id,full_name,gender,level,phone,note)
  values(event_id,trim(full_name),gender,level,trim(phone),nullif(trim(coalesce(note,'')),''))
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.register_player(uuid,text,text,text,text,text) to anon, authenticated;

-- QUAN TRỌNG sau khi admin đăng nhập lần đầu:
-- 1) Authentication > Users > copy UUID của admin
-- 2) chạy: insert into public.admin_users(user_id) values ('UUID-ADMIN');
