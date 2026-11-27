-- Run in Supabase SQL Editor. Start with 50 text, 5 image and 0 video credits.
create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 email text,
 plan text not null default 'free',
 text_credits integer not null default 50,
 image_credits integer not null default 5,
 video_credits integer not null default 0,
 credits_reset_at timestamptz not null default (now()+interval '1 day'),
 created_at timestamptz not null default now()
);
create table if not exists public.credit_ledger(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('text','image','video','grant')),
 amount integer not null,
 note text,
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.credit_ledger enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using(auth.uid()=id);
drop policy if exists "read own ledger" on public.credit_ledger;
create policy "read own ledger" on public.credit_ledger for select using(auth.uid()=user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email) values(new.id,new.email)
 on conflict(id) do update set email=excluded.email;
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.consume_credit(p_user_id uuid,p_kind text)
returns boolean language plpgsql security definer set search_path=public as $$
declare current_credits integer; col text;
begin
 if auth.uid() is distinct from p_user_id then return false; end if;
 if p_kind not in ('text','image','video') then return false; end if;
 update public.profiles set
  text_credits=case when p_kind='text' then case when credits_reset_at<=now() then 50 else text_credits end - 1 else text_credits end,
  image_credits=case when p_kind='image' then case when credits_reset_at<=now() then 5 else image_credits end - 1 else image_credits end,
  video_credits=case when p_kind='video' then case when credits_reset_at<=now() then 0 else video_credits end - 1 else video_credits end,
  credits_reset_at=case when credits_reset_at<=now() then now()+interval '1 day' else credits_reset_at end
 where id=p_user_id
 and (case p_kind
  when 'text' then (case when credits_reset_at<=now() then 50 else text_credits end)>0
  when 'image' then (case when credits_reset_at<=now() then 5 else image_credits end)>0
  when 'video' then (case when credits_reset_at<=now() then 0 else video_credits end)>0
 end);
 if not found then return false; end if;
 insert into public.credit_ledger(user_id,kind,amount,note) values(p_user_id,p_kind,-1,'AI generation');
 return true;
end; $$;
revoke all on function public.consume_credit(uuid,text) from public;
grant execute on function public.consume_credit(uuid,text) to authenticated;

-- Production note: these are starter quotas, not a promise of unlimited free usage.
-- Add CAPTCHA, per-IP/user rate limits, daily reset design, refunds on provider failures,
-- payment-event idempotency and admin-only audited credit grants before public launch.
