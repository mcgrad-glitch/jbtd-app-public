@AGENTS.md

## Текущая фаза

Фаза 1, 2, 3 — завершены. Готово:
- /onboarding — квиз 3 шага
- /catalog — подборка с матчингом
- /product/[id] — карточка товара
- /auth — Magic Link авторизация
- /expert — панель эксперта + загрузка видео
- Supabase Storage — видео загружается через API route
- Vercel прод — jbtd-app.vercel.app

Известные проблемы:
- emailRedirectTo на проде ведёт на /auth/confirm но Supabase редиректит на / — нужно проверить после rate limit сброса
- RLS на video_requests и videos отключён для MVP

Следующие шаги:
- Починить auth redirect на проде
- Telegram уведомления эксперту при новом запросе
- Пригласить первых тестовых пользователей
