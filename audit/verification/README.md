# Проверка опубликованной версии

Проверен коммит b3ccc0a из ветки codex/review-fixes публичного GitHub-репозитория.

Окружение: macOS, Node 22.14.0, npm 10.9.2, Rust/Cargo 1.96.1, Solana CLI 4.2.2, Anchor 0.31.1.

Репозиторий клонирован из GitHub без target/node_modules. Для предыдущего опубликованного коммита 8990e06 полностью выполнены первая сборка, локальная подготовка, повторная сборка, Rust и интеграционные тесты. После fast-forward до b3ccc0a (Rust-код не менялся) повторены обе npm ci, codec-тесты, TypeScript, frontend build, Rust и интеграционные тесты. Итог: 10 + 19 + 6 успешных тестов.

Отдельной проверкой подтверждено совпадение public key локальной программы с declare_id, programs.localnet и IDL, сохранение исходного programs.devnet. Production build проверен также без корневого node_modules: Buffer явно разрешается из frontend, предупреждения об externalized Buffer отсутствуют.

Остаётся предупреждение о размере JS chunk >500 KB. Audit high/critical = 0; moderate/low и peer-dependency warnings не скрыты. Это не чистая ОС, не независимый аудит и не повторный деплой. Логи относятся к локальному валидатору; тестовые ключи и ledger не публикуются.
