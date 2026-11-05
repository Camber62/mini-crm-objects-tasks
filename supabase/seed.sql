-- Демо-данные после создания пользователей в Authentication → Users.
-- Подставьте UUID из карточки каждого пользователя.

do $$
declare
  v_assigner uuid := '00000000-0000-0000-0000-000000000001'; -- постановщик
  v_executor_1 uuid := '00000000-0000-0000-0000-000000000002'; -- исполнитель 1
  v_executor_2 uuid := '00000000-0000-0000-0000-000000000003'; -- исполнитель 2
  v_object_1 uuid;
  v_object_2 uuid;
  v_object_3 uuid;
  v_task uuid;
begin
  insert into public.profiles (id, email, full_name, role) values
    (v_assigner, 'assigner@demo.local', 'Анна Постановщик', 'assigner'),
    (v_executor_1, 'executor1@demo.local', 'Иван Прораб', 'executor'),
    (v_executor_2, 'executor2@demo.local', 'Мария Мастер', 'executor')
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role;

  insert into public.objects (name, address, created_by)
  values ('ЖК «Северная долина», корпус 4', 'Санкт-Петербург, пр. Просвещения, 40', v_assigner)
  returning id into v_object_1;

  insert into public.objects (name, address, created_by)
  values ('Складской комплекс «Южный»', 'Москва, Киевское шоссе, 22-й км', v_assigner)
  returning id into v_object_2;

  insert into public.objects (name, address, created_by)
  values ('Офис на Лесной', 'Москва, ул. Лесная, 5', v_assigner)
  returning id into v_object_3;

  -- Новая
  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values (
    'Разметить оси 1-го этажа',
    'Проверить соответствие осей рабочему проекту, отметить отклонения.',
    v_object_1, v_executor_1, v_assigner, 'new'
  );

  -- В работе
  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values (
    'Приёмка монолита перекрытия',
    'Осмотреть перекрытие, зафиксировать раковины и несоответствия.',
    v_object_1, v_executor_1, v_assigner, 'new'
  ) returning id into v_task;
  perform set_config('app.allow_status_change', 'true', true);
  update public.tasks set status = 'in_progress' where id = v_task;

  -- На проверке
  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values (
    'Установка временного ограждения',
    'Поставить ограждение по периметру котлована, приложить фото.',
    v_object_2, v_executor_2, v_assigner, 'new'
  ) returning id into v_task;
  perform set_config('app.allow_status_change', 'true', true);
  update public.tasks set status = 'in_progress' where id = v_task;
  perform set_config('app.allow_status_change', 'true', true);
  update public.tasks set status = 'review' where id = v_task;

  -- На доработке
  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values (
    'Проверка электрощитовой',
    'Сверить маркировку автоматов со схемой, прислать фото щита.',
    v_object_2, v_executor_2, v_assigner, 'new'
  ) returning id into v_task;
  perform set_config('app.allow_status_change', 'true', true);
  update public.tasks set status = 'in_progress' where id = v_task;
  perform set_config('app.allow_status_change', 'true', true);
  update public.tasks set status = 'review' where id = v_task;
  perform set_config('app.allow_status_change', 'true', true);
  perform set_config('app.transition_comment', 'На фото не видно маркировку автоматов. Переснимите крупным планом.', true);
  update public.tasks set status = 'rework' where id = v_task;

  -- Принята
  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values (
    'Демонтаж старых перегородок',
    'Убрать ГКЛ-перегородки в осях А-Б, вывезти мусор.',
    v_object_3, v_executor_1, v_assigner, 'new'
  ) returning id into v_task;
  perform set_config('app.allow_status_change', 'true', true);
  update public.tasks set status = 'in_progress' where id = v_task;
  perform set_config('app.allow_status_change', 'true', true);
  update public.tasks set status = 'review' where id = v_task;
  perform set_config('app.allow_status_change', 'true', true);
  update public.tasks set status = 'accepted' where id = v_task;

  -- Ещё одна новая на второго исполнителя
  insert into public.tasks (title, description, object_id, assignee_id, author_id, status)
  values (
    'Замер проёмов под двери',
    'Снять размеры всех проёмов 2-го этажа, таблица в комментарии к задаче.',
    v_object_3, v_executor_2, v_assigner, 'new'
  );
end $$;
