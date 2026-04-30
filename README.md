# InteractiveMap (Django)

Проект переписан на Django с приложением `mapapp`.

## Запуск

```bash
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Главная страница: `http://127.0.0.1:8000/`

## Docker

```bash
docker compose up --build
```

Приложение будет доступно на `http://127.0.0.1:8081/`.
pgAdmin будет доступен на `http://127.0.0.1:5050/` (логин: `admin@admin.ru`, пароль: `admin`).

## Заполнение БД данными

После запуска контейнеров выполните:

```bash
docker compose exec web python manage.py seed_reference_data
```

Эта команда заполняет справочники (`districts`, `institution_types`, `condition_types`, `admission_types`) и безопасна для повторного запуска.

## Вход администратора в приложении

Администратор UI создается автоматически при старте контейнера `web` (команда `ensure_admin_from_env`).

- Логин/пароль берутся из `ADMIN_LOGIN` и `ADMIN_PASSWORD`.
- Если они не заданы, используются `DB_USER` и `DB_PASS` из `docker-compose.yml`.