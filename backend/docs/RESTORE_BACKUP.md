# Восстановление из бэкапа

Бэкапы делаются автоматически каждый день в 02:00 UTC (workflow
`.github/workflows/backup.yml`) и лежат в приватном репозитории
https://github.com/arsLnD/plans-finance-backups в виде файлов
`backup-YYYY-MM-DD.dump.enc` (зашифрованы AES-256, хранятся последние 14 дней).

Есть два способа восстановления — выберите тот, что подходит под ситуацию.

## Способ 1 (быстрее, за последние 6 часов): Point-in-Time Restore в Neon

Если проблема случилась недавно (удалили данные багом, всё ещё в пределах
последних 6 часов) — самый быстрый способ, без файлов бэкапа вообще:

1. Зайти в https://console.neon.tech → проект `plans-finance` → ветка `main`.
2. Вкладка **Restore** → выбрать точное время до момента проблемы → Restore.
3. Neon сам накатит базу на нужный момент. Backend ничего не нужно перезапускать.

## Способ 2 (из зашифрованного дампа, любой день за последние 14 дней)

1. Скачать нужный файл `backup-YYYY-MM-DD.dump.enc` из репозитория
   `plans-finance-backups`.
2. Расшифровать (нужен `BACKUP_ENCRYPTION_KEY` — см. Settings → Secrets and
   variables → Actions в репозитории `plans-finance`, либо спросить у автора):

   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 \
     -in backup-2026-08-08.dump.enc \
     -out dump.sql \
     -pass pass:"<BACKUP_ENCRYPTION_KEY>"
   ```

3. Восстановить в базу (⚠️ это перезапишет текущие данные — сначала убедитесь,
   что восстанавливаете в правильную БД; для безопасности можно сначала создать
   новую ветку/базу в Neon и восстановить туда, проверить, и только потом
   переключить `DATABASE_URL` в Render):

   ```bash
   pg_restore --clean --if-exists --no-owner --dbname="<DATABASE_URL>" dump.sql
   ```

## Проверить, что бэкапы реально работают

- GitHub → репозиторий `plans-finance` → вкладка **Actions** → workflow
  "Daily encrypted DB backup" → должен быть зелёный (успешный) запуск каждый день.
- Можно запустить вручную: Actions → Daily encrypted DB backup → Run workflow.
- Раз в пару месяцев стоит реально попробовать расшифровать один файл (шаг 2
  выше) и убедиться, что ключ шифрования не потерян и файл не битый.
