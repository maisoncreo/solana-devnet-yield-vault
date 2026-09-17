# Результаты проверки — 14 сентября 2026

## Выполнено

- Rust 1.96.1, Solana CLI / validator 2.3.9, Anchor CLI 0.31.1, Node 22.14.0, npm 10.9.2.
- Anchor workspace создан вручную после ошибки доступа anchor init к Documents.
- SBF и IDL собраны; Program ID синхронизирован: C6BADkFFFckPvxBCzsedCGFVzF9t1ByZszkUTmWjHbzR.
- `cargo test -p defi-vault --lib --locked`: 10 passed, 0 failed (9 арифметических тестов + test_id).
- `anchor test --skip-build`: 16 passing (8s), локальный validator 2.3.9.
- `npx tsc --noEmit`: успешно, тесты и setup script.
- `frontend: npm run build`: успешно; предупреждение о JS bundle более 500 kB.
- UI проверен в браузере: страница отображается, окно выбора кошелька открывается; транзакции без конфигурации недоступны.

## Deployment и оставшаяся проверка

- Devnet deployment завершён после обновления CLI до 4.2.2 и установки libusb. Программа executable, все 6 транзакций из deployment.json finalized. Итог: 55 DEV-USDC активов и 50 долей.
- Браузерные транзакции: депозит и вывод через Phantom проверены в Devnet; обе finalized.
- Репозиторий опубликован: https://github.com/maisoncreo/solana-devnet-yield-vault. Демоверсия размещена: https://talbek-devnet-yield-vault.aikgjpch.chatgpt.site (публичный доступ открыт). Видео не записано; доступна работающая демоверсия.
- Профессиональный аудит не проводился. Checklist — внутренняя проверка реализации.

## Зависимости

Cargo.lock закрепляет совместимые версии blake3, proc-macro-crate, indexmap, zeroize, zeroize_derive и unicode-segmentation для встроенного Rust 1.84.1-dev.
Компилятор выдаёт предупреждения макросов Anchor об unexpected cfg и deprecated realloc. Предупреждение post-processing о неизвестных syscalls было проверено реальным выполнением: все 16 транзакционных тестов прошли.

npm install сообщил 15 findings в корневых зависимостях (1 low, 8 moderate, 6 high) и 8 во frontend (3 moderate, 5 high). Они требуют отдельного анализа и устранения до mainnet; автоматическое обновление с breaking changes не выполнялось.

## Проверка через Phantom — 14 сентября 2026

Пользователь самостоятельно подписал обе операции в браузерном интерфейсе. Результат проверен чтением Devnet, обе транзакции finalized:

- [Депозит 10 DEV-USDC](https://explorer.solana.com/tx/2HiNq5WyUGDLbS9Zf6Bj7Eo5tNNQFMyibyyRsUDfNKNHjLc4HQE8w7FCfZwDSN8Ufw3WnpxfwkKU1pWLt1ZZLRmx?cluster=devnet): начислено 9,090909 доли.
- [Вывод 5 долей](https://explorer.solana.com/tx/2VV9Ub75xRMw86pEyQTYZa841qQZt5f89tsNbhzVu5FvDZsSoGg8sA472dULPUv2AgdUYqnUKzhA4m8HB4MHcKtu?cluster=devnet): получено 5,5 DEV-USDC.

После проверки у пользователя 95,5 DEV-USDC в кошельке и 4,090909 доли в vault. Общие активы vault: 59,5 DEV-USDC; общее число долей: 54,090909. Это снимок состояния, последующие операции изменят значения.

## Повторная проверка после отзыва — 17 сентября 2026

- Отдельная копия без target/node_modules, новый локальный ключ программы.
- prepare-localnet.cjs сохраняет секцию Devnet; повторная SBF-сборка успешна.
- Rust: 10 passed; локальные интеграционные тесты: 18 passing (17s).
- Новые тесты: два вкладчика с распределением доходности и попытка вывода чужой позиции.
- TypeScript и frontend production build успешны.
- npm audit: root 3 high, frontend 3 high; остаточный bigint-buffer и остальные замечания описаны в DEPENDENCY_AUDIT.md. Прежние числа выше — исторические.
- On-chain исходник не изменён, повторный Devnet deploy не выполнялся.
