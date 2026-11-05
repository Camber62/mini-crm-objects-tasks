# Мини-CRM «Объекты и задачи»

Тестовое задание: React + TypeScript + Supabase. Руководитель ставит задачи по стройкам, исполнители ведут их по статусам. Права доступа закрыты в базе (RLS), а не только в интерфейсе.

- [Объяснение для руководителя](./EXPLANATION.md)
- [Решения и допущения](./DECISIONS.md)

## Стек

- React 19, TypeScript, Vite
- Ant Design
- Supabase (Auth, Postgres, RLS)

## Как запустить локально

1. Создайте проект на [supabase.com](https://supabase.com) (бесплатный тариф).
2. В SQL Editor выполните `supabase/migrations/001_schema.sql`.
3. Authentication → Providers → Email: оставьте вход по паролю, **отключите регистрацию** (Allow new users to sign up).
4. Authentication → Users → Add user — создайте минимум трёх пользователей: 1 постановщик и 2 исполнителя. Подтвердите email сразу (Auto Confirm).
5. Скопируйте UUID каждого пользователя в `supabase/seed.sql` вместо заглушек и выполните файл в SQL Editor.
6. Project Settings → API: скопируйте Project URL и `anon` `public` ключ.

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

`service_role` в `.env` и в репозиторий не кладём.

```bash
npm install
# или: pnpm install
npm run dev
```

Откройте http://localhost:5173 и войдите одним из тестовых аккаунтов.

## Деплой на Vercel

1. Подключите репозиторий к Vercel.
2. Добавьте те же `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в Environment Variables.
3. В Supabase → Authentication → URL Configuration укажите Site URL стенда.

В `vercel.json` уже есть rewrite на `index.html` для React Router.

## GitHub Pages

Сайт: https://camber62.github.io/mini-crm-objects-tasks/

Публикуется собранная папка `dist` в ветке `gh-pages`. Перед сборкой нужен `.env` с публичным ключом (не `service_role`):

```bash
VITE_BASE_PATH=/mini-crm-objects-tasks/ pnpm run build
cp dist/index.html dist/404.html
touch dist/.nojekyll
```

В Supabase → Authentication → URL Configuration добавьте адрес сайта в Site URL.

## Что проверять

| Роль          | Ожидание                                      |
| ------------- | --------------------------------------------- |
| Постановщик   | Видит все объекты и задачи, создаёт и удаляет, принимает / возвращает с комментарием |
| Исполнитель 1 | Видит только свои задачи, берёт в работу и отправляет на проверку |
| Исполнитель 2 | Не видит чужие задачи даже прямым запросом к Supabase |

Смена статуса в обход функции `change_task_status` должна отклоняться базой. Историю нельзя изменить или удалить с anon-ключом.

## Структура

```
src/           интерфейс и авторизация
supabase/      миграция RLS и демо-данные
```
