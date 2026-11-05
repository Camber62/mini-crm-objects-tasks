-- Мини-CRM «Объекты и задачи»
-- Права доступа, переходы статусов и история закрыты на уровне базы (RLS + триггеры + RPC).

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('assigner', 'executor');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.user_role not null
);

create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  object_id uuid not null references public.objects (id) on delete cascade,
  assignee_id uuid not null references public.profiles (id),
  status public.task_status not null default 'new',
  author_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  from_status public.task_status,
  to_status public.task_status not null,
  changed_by uuid not null references public.profiles (id),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists objects_created_at_idx on public.objects (created_at desc);
create index if not exists tasks_object_id_idx on public.tasks (object_id);
create index if not exists tasks_assignee_id_idx on public.tasks (assignee_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists task_status_history_task_id_idx on public.task_status_history (task_id, created_at);

-- ---------------------------------------------------------------------------
-- Вспомогательные функции для RLS (security definer — без рекурсии политик)
-- ---------------------------------------------------------------------------

create or replace function public.is_assigner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'assigner'
  );
$$;

create or replace function public.executor_has_task_on_object(p_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks
    where object_id = p_object_id and assignee_id = auth.uid()
  );
$$;

create or replace function public.can_read_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_assigner() or exists (
    select 1 from public.tasks
    where id = p_task_id and assignee_id = auth.uid()
  );
$$;

revoke all on function public.is_assigner() from public, anon;
revoke all on function public.executor_has_task_on_object(uuid) from public, anon;
revoke all on function public.can_read_task(uuid) from public, anon;
grant execute on function public.is_assigner() to authenticated;
grant execute on function public.executor_has_task_on_object(uuid) to authenticated;
grant execute on function public.can_read_task(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Переход статуса: единственный легальный способ сменить статус задачи
-- ---------------------------------------------------------------------------

create or replace function public.change_task_status(
  p_task_id uuid,
  p_new_status public.task_status,
  p_comment text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'Необходима авторизация' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    raise exception 'Профиль не найден' using errcode = '42501';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;

  if v_task.status = p_new_status then
    raise exception 'Статус уже установлен';
  end if;

  if v_task.status = 'new' and p_new_status = 'in_progress' then
    if v_role <> 'executor' or v_task.assignee_id <> auth.uid() then
      raise exception 'В работу может взять только назначенный исполнитель';
    end if;
  elsif v_task.status = 'in_progress' and p_new_status = 'review' then
    if v_role <> 'executor' or v_task.assignee_id <> auth.uid() then
      raise exception 'На проверку может отправить только назначенный исполнитель';
    end if;
  elsif v_task.status = 'review' and p_new_status = 'accepted' then
    if v_role <> 'assigner' then
      raise exception 'Принять задачу может только постановщик';
    end if;
  elsif v_task.status = 'review' and p_new_status = 'rework' then
    if v_role <> 'assigner' then
      raise exception 'Вернуть на доработку может только постановщик';
    end if;
    if p_comment is null or length(trim(p_comment)) = 0 then
      raise exception 'Комментарий обязателен при возврате на доработку';
    end if;
  elsif v_task.status = 'rework' and p_new_status = 'in_progress' then
    if v_role <> 'executor' or v_task.assignee_id <> auth.uid() then
      raise exception 'С доработки в работу может взять только назначенный исполнитель';
    end if;
  else
    raise exception 'Переход статуса запрещён';
  end if;

  perform set_config('app.allow_status_change', 'true', true);
  perform set_config('app.transition_comment', coalesce(p_comment, ''), true);

  update public.tasks
  set status = p_new_status
  where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$;

revoke all on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Триггеры: валидация полей и неизменяемая история
-- ---------------------------------------------------------------------------

create or replace function public.enforce_task_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if not public.is_assigner() then
      raise exception 'Создавать задачи может только постановщик';
    end if;
    if new.author_id <> auth.uid() then
      raise exception 'Автор задачи должен быть текущим пользователем';
    end if;
  end if;
  if new.status <> 'new' then
    raise exception 'Новая задача должна быть в статусе «Новая»';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = new.assignee_id and role = 'executor'
  ) then
    raise exception 'Исполнителем может быть только пользователь с ролью исполнителя';
  end if;
  return new;
end;
$$;

create or replace function public.record_task_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_status_history (task_id, from_status, to_status, changed_by, comment)
  values (new.id, null, 'new', coalesce(auth.uid(), new.author_id), null);
  return new;
end;
$$;

create or replace function public.enforce_task_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_id is distinct from old.author_id then
    raise exception 'Автор задачи не может быть изменён';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'Дата создания не может быть изменена';
  end if;
  if new.object_id is distinct from old.object_id then
    raise exception 'Объект задачи не может быть изменён';
  end if;
  if new.status is distinct from old.status then
    if current_setting('app.allow_status_change', true) is distinct from 'true' then
      raise exception 'Статус можно менять только через разрешённые действия';
    end if;
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    if old.status = 'accepted' then
      raise exception 'Нельзя менять исполнителя у принятой задачи';
    end if;
    if not exists (
      select 1 from public.profiles
      where id = new.assignee_id and role = 'executor'
    ) then
      raise exception 'Исполнителем может быть только пользователь с ролью исполнителя';
    end if;
  end if;
  if old.status = 'accepted' and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
  ) then
    raise exception 'Принятую задачу нельзя редактировать';
  end if;
  return new;
end;
$$;

create or replace function public.record_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.task_status_history (task_id, from_status, to_status, changed_by, comment)
    values (
      new.id,
      old.status,
      new.status,
      coalesce(auth.uid(), new.author_id),
      nullif(current_setting('app.transition_comment', true), '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_enforce_insert on public.tasks;
create trigger tasks_enforce_insert
before insert on public.tasks
for each row execute function public.enforce_task_insert();

drop trigger if exists tasks_record_created on public.tasks;
create trigger tasks_record_created
after insert on public.tasks
for each row execute function public.record_task_created();

drop trigger if exists tasks_enforce_update on public.tasks;
create trigger tasks_enforce_update
before update on public.tasks
for each row execute function public.enforce_task_update();

drop trigger if exists tasks_record_status_change on public.tasks;
create trigger tasks_record_status_change
after update on public.tasks
for each row execute function public.record_task_status_change();

create or replace function public.enforce_object_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    if not public.is_assigner() then
      raise exception 'Создавать объекты может только постановщик';
    end if;
    if new.created_by <> auth.uid() then
      raise exception 'Автор объекта должен быть текущим пользователем';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_object_update()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Автор объекта не может быть изменён';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'Дата создания объекта не может быть изменена';
  end if;
  return new;
end;
$$;

drop trigger if exists objects_enforce_insert on public.objects;
create trigger objects_enforce_insert
before insert on public.objects
for each row execute function public.enforce_object_insert();

drop trigger if exists objects_enforce_update on public.objects;
create trigger objects_enforce_update
before update on public.objects
for each row execute function public.enforce_object_update();

-- История: клиентский API не получит INSERT/UPDATE/DELETE (нет политик и нет GRANT).
-- Пишут только триггеры SECURITY DEFINER, они обходят RLS.

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

drop policy if exists objects_select on public.objects;
create policy objects_select on public.objects
  for select to authenticated
  using (public.is_assigner() or public.executor_has_task_on_object(id));

drop policy if exists objects_insert on public.objects;
create policy objects_insert on public.objects
  for insert to authenticated
  with check (public.is_assigner() and created_by = auth.uid());

drop policy if exists objects_update on public.objects;
create policy objects_update on public.objects
  for update to authenticated
  using (public.is_assigner())
  with check (public.is_assigner());

drop policy if exists objects_delete on public.objects;
create policy objects_delete on public.objects
  for delete to authenticated
  using (public.is_assigner());

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (public.is_assigner() or assignee_id = auth.uid());

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.is_assigner() and author_id = auth.uid());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_assigner())
  with check (public.is_assigner());

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.is_assigner());

drop policy if exists history_select on public.task_status_history;
create policy history_select on public.task_status_history
  for select to authenticated
  using (public.can_read_task(task_id));

-- Нет политик INSERT/UPDATE/DELETE на историю: клиентский API не сможет её менять.
-- Триггеры SECURITY DEFINER пишут историю от имени владельца и обходят RLS.

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.objects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select on public.task_status_history to authenticated;

revoke all on public.profiles from anon;
revoke all on public.objects from anon;
revoke all on public.tasks from anon;
revoke all on public.task_status_history from anon;

revoke all on function public.enforce_task_insert() from public, anon, authenticated;
revoke all on function public.record_task_created() from public, anon, authenticated;
revoke all on function public.enforce_task_update() from public, anon, authenticated;
revoke all on function public.record_task_status_change() from public, anon, authenticated;
revoke all on function public.enforce_object_insert() from public, anon, authenticated;
revoke all on function public.enforce_object_update() from public, anon, authenticated;
