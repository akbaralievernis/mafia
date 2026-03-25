# 🚀 Развертывание игры "Мафия" в Production

Проект полностью оптимизирован и готов к деплою в интернет. Клиентская часть (React/Vite) деплоится на статический хостинг, а серверная (Node.js/Socket.io) — на облачный хостинг для работы с WebSocket.

---

## 1. Деплой Бэкенда (Railway / Render / VPS)

Бэкенд-сервер управляет игровыми комнатами и Socket.io. Для игры в реальном времени рекомендован **always-on инстанс** (не sleep/free режим), чтобы избежать лагов на реконнекте.

### Инструкция для Render:
1. Запушьте код папки `backend/` на GitHub (создайте отдельный репозиторий или папку в монорепе).
2. Зарегистрируйтесь на [Render.com](https://render.com) и создайте **New Web Service**.
3. Подключите ваш GitHub-репозиторий.
4. В настройках сервиса укажите:
   - **Root Directory**: `backend` (если это монорепозиторий)
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. В разделе **Environment Variables** добавьте:
   - `NODE_ENV` = `production`
   - `ALLOWED_ORIGINS` = `https://your-frontend-domain.vercel.app`
   - `PORT` не фиксируйте вручную (провайдер подставляет динамически)
6. Для Railway/Render выберите тариф без сна (always-on) и добавьте запас CPU/RAM для Socket.io.
7. Нажмите **Deploy**.
8. Скопируйте выделенный вам домен (например, `https://my-mafia-api.onrender.com`).

---

## 2. Деплой Фронтенда (Vercel или Netlify)

Vercel идеально подходит для проектов на Vite и обеспечивает мгновенный деплой.

### Инструкция для Vercel:
1. Зарегистрируйтесь на [Vercel.com](https://vercel.com) и нажмите **Add New Project**.
2. Подключите репозиторий с игрой. Если это монорепо, выберите папку `client/` как **Root Directory**.
3. Vercel автоматически распознает фреймворк **Vite**.
4. Зайдите в раздел **Environment Variables** и добавьте связь с вашим сервером:
   - `VITE_SERVER_URL` = `https://my-mafia-api.onrender.com` (основная переменная клиента)
   - `VITE_SOCKET_TRANSPORTS` = `websocket,polling` (или `websocket` для минимальной задержки при стабильной сети)
5. Нажмите **Deploy**.
6. Vercel выдаст вам красивый домен (например, `https://mafia-game.vercel.app`).

---

## 3. Финальная связка CORS и стабильности

Вернитесь в настройки вашего бэкенда на Render/Railway и обновите переменную `ALLOWED_ORIGINS`, вставив туда домен фронтенда от Vercel (`https://mafia-game.vercel.app`). Это необходимо для корректной настройки CORS в Socket.io.

Также проверьте:
- `GET /ping` → должен возвращать `pong`
- `GET /health` → должен возвращать `ok: true` и текущий uptime/количество комнат

---

## 4. Локальный запуск (для проверки)

Если вы хотите протестировать production-сборку локально:

1. В папке `backend`: `npm install && npm start`
2. В папке `client`: 
   - Выполните `npm run build` для компиляции React+Vite проекта.
   - Выполните `npm run preview`, чтобы запустить собранную статическую версию локально.

🎉 Ваш проект премиальной онлайн-игры "Мафия" готов!
