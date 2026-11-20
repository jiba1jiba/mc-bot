# Деплой на Render (бесплатно, без карты)

Цель: бот работает в облаке Render, ваш ПК можно выключать.

Понадобится:

- аккаунт **GitHub** (бесплатно);
- аккаунт **Render** (регистрация через GitHub, карта не нужна);
- аккаунт **UptimeRobot** (бесплатно, чтобы Render не засыпал);
- токен Discord-бота и ID вашего Discord-сервера.

---

## 1. Выложить проект на GitHub

Репозиторий уже создан локально в `C:\Users\misha\Documents\mc-bot`
(сделан первый коммит, `node_modules` и `.env` не попадут в git).

### Вариант А — GitHub Desktop (проще)

1. Установите <https://desktop.github.com> и войдите в GitHub.
2. **File → Add local repository…**
3. Укажите папку `C:\Users\misha\Documents\mc-bot` → **Add**.
4. Нажмите **Publish repository**.
5. Имя: `mc-bot`. Галочку **Keep this code private** оставьте включённой.
6. **Publish repository**. Через минуту репозиторий появится на GitHub.

### Вариант Б — через сайт GitHub

1. <https://github.com/new> → имя `mc-bot` → **Private** → **Create repository**.
2. Распакуйте `C:\Users\misha\Documents\mc-bot-deploy.zip`.
3. На странице репозитория: **Add file → Upload files**, перетащите содержимое
   распакованной папки (не саму папку) → **Commit changes**.

Проверка: в репозитории должны быть `package.json`, `render.yaml`, папки `src`
и `scripts`. Файла `.env` там быть **не должно** (токен хранится только в Render).

---

## 2. Создать сервис на Render

1. Откройте <https://render.com> → **Get Started** → **GitHub** → разрешите доступ.
   Карта не требуется.
2. В Dashboard: **New +** → **Blueprint**.
3. Выберите репозиторий `mc-bot` → **Connect** / **Apply**.
   Render прочитает `render.yaml` и создаст бесплатный web service во Франкфурте.
4. На шаге создания он спросит переменные:
   - `DISCORD_TOKEN` — токен бота;
   - `DISCORD_GUILD_ID` — ID вашего Discord-сервера.

   Если не спросил: после создания откройте сервис → **Environment** → **Add
   Environment Variable** и добавьте обе.
5. Нажмите **Apply / Create Web Service** и дождитесь статуса **Live**
   (первый билд 2–4 минуты, в логах будет `npm ci`).

### Если Blueprint недоступен — вручную

**New + → Web Service** → подключите `mc-bot` и укажите:

| Поле | Значение |
| --- | --- |
| Name | `mc-alts-bot` |
| Region | Frankfurt |
| Branch | `main` |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Plan | Free |
| Health Check Path | `/` |

Затем **Environment** → добавьте `DISCORD_TOKEN`, `DISCORD_GUILD_ID` →
**Create Web Service**.

---

## 3. Проверить, что сервис живой

Откройте ссылку вида

```
https://mc-alts-bot-xxxx.onrender.com/
```

Должно ответить:

```
mc-alts-bot: alive
```

В логах Render (**Logs**) должно быть:

```
Discord: вошёл как YourBot#1234
Minecraft: 5.83.140.250:25588 · ...
Ресурспак принят
[serphut1] вошёл на 5.83.140.250:25588
```

В Discord проверьте `/list` и `/status`.

---

## 4. Не дать Render заснуть (обязательно)

Бесплатный сервис Render засыпает после **15 минут без HTTP-запросов** — боты
отключатся. Нужен внешний пинг каждые 5 минут.

1. Зарегистрируйтесь на <https://uptimerobot.com> (бесплатно).
2. **Add New Monitor**:
   - Monitor Type: **HTTP(s)**;
   - Friendly Name: `mc-bot`;
   - URL: ссылка из шага 3 (с `/` на конце);
   - Monitoring Interval: **5 minutes**.
3. **Create Monitor**.

Альтернатива: <https://cron-job.org> — задача каждые 5 минут на ту же ссылку.

---

## 5. Список ников

В `render.yaml` уже задано:

```
ACCOUNTS=serphut,serphut1,serphut2,serphut3
```

Свои ники добавьте в **Environment → ACCOUNTS** через запятую и нажмите
**Save** (будет redeploy). После старта бот сам запустит их (`AUTO_JOIN=true`).

Важно: на бесплатном Render диск временный. Команда `/add` работает, но после
рестарта список вернётся к `ACCOUNTS`. Если нужна постоянная запись через
`/add` — лучше VPS/Oracle (см. `README.md`).

---

## 6. Обновления

Меняете код локально → GitHub Desktop: **Commit → Push** → Render сам
пересоберёт и перезапустит бота (1–2 минуты).

---

## Если что-то не работает

| Симптом | Причина / решение |
| --- | --- |
| Сервис **Live**, но боты не в игре | Смотрите **Logs**: кик по вайтлисту, неверный `MC_VERSION`, таймаут порта. |
| `Ты не в вайтлисте` | Ник не добавлен в вайтлист сервера. |
| Сервис засыпает, боты пропадают | Не настроен UptimeRobot (шаг 4). |
| `Out of memory` / рестарты | На 512 МБ запускайте 2–3 бота, уменьшите `ACCOUNTS`. |
| `Application failed to respond` | Проверьте, что сервис слушает `PORT` (код уже это делает) и Health Check `/`. |
| Команд в Discord нет | Проверьте `DISCORD_GUILD_ID` и что бот приглашён со scope `applications.commands`. |
| Сборка падает на Node | В Environment добавьте `NODE_VERSION=22`. |
| Render не может достучаться до порта 25588 | Редко, но бывает: тогда нужен VPS (README.md). |

Логи — вкладка **Logs** в Render. Перезапуск — **Manual Deploy → Deploy latest commit**.
