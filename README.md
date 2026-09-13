# Devnet Yield Vault

Учебный Solana Yield Vault: SPL Token, Anchor 0.31.1 и React. Только тестовые средства.

## Статус

Локальный MVP собран: 10 Rust-тестов и 16 транзакционных тестов прошли, React production build выполнен. Подробности — в `STATUS.md`. Локальный Program ID: `C6BADkFFFckPvxBCzsedCGFVzF9t1ByZszkUTmWjHbzR`. Программа пока не развёрнута в Devnet.

## Архитектура

- `Vault`: PDA `["vault", admin, mint]`. Хранит администратора, mint, учтённые активы, общее число долей, вместимость и bump.
- `UserPosition`: PDA `["position", vault, user]`. Хранит владельца, vault и доли. Не закрывается и не сбрасывается при повторном депозите.
- Token account: PDA `["tokens", vault]`. Принадлежит SPL Token Program, право перевода принадлежит Vault PDA.
- Переводы выполняются через `transfer_checked`; вывод подписывается seeds Vault PDA.
- Поддерживается обычный SPL Token. Token-2022 и расширения не поддерживаются.

## Финансовая модель

Все суммы — целые минимальные единицы. DEV-USDC использует 6 десятичных знаков. Доли имеют тот же масштаб.

- Первый депозит: `shares = amount`.
- Следующий: `shares = floor(amount * total_shares / total_assets)`.
- Вывод: `amount = floor(shares * total_assets / total_shares)`.
- Admin-only `add_yield` переводит реальные тестовые токены администратора в хранилище и увеличивает учтённые активы без выпуска долей.
- Нет обещанной APR/APY и нет внешней стратегии; это демонстрация учёта долей.
- Комиссия протокола — 0. Сетевые комиссии и rent оплачиваются тестовым SOL.
- Ограничение capacity применяется и к депозитам, и к доходности. Нулевые суммы, нулевой результат и недостаточные доли отклоняются.
- Минимальный выход задаётся пользователем; UI использует допуск 0,5%.
- Произведение вычисляется в u128, преобразование в u64 проверяется; сложение и вычитание checked.
- Прямые переводы в token account не входят в total_assets и не влияют на цену доли. Такие излишки не извлекаются этой версией программы.
- Округление при частичном выводе остаётся вкладчикам. Последний полный вывод забирает все учтённые активы.

Пример: депозит 100 → 100 долей; add_yield 10 → 110 активов; вывод 50 долей → 55 токенов.

## Локальная проверка

Нужны Rust, Solana CLI 2.3.9, Anchor CLI 0.31.1, Node 22 и npm. Yarn не нужен.

```sh
npm ci
anchor build
anchor keys sync
anchor build
cargo test -p defi-vault --lib
anchor test
```

Сохраняйте Cargo.lock: новые транзитивные версии могут быть несовместимы с Cargo в Solana 2.3.9.
`anchor keys sync` связывает исходник с ключом, который сборка создаёт в игнорируемой папке target. Не публикуйте ключи.
Тесты в `tests/defi-vault.ts` выполняются на локальном валидаторе, а не в mainnet.

## Devnet

После успешных локальных проверок:

```sh
solana balance --url devnet
anchor deploy --provider.cluster devnet
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET="$HOME/.config/solana/id.json" npx ts-node scripts/setup-devnet.ts
node scripts/sync-frontend.cjs
cd frontend
npm ci
npm run dev
```

Скрипт проверяет genesis hash Devnet, создаёт тестовый mint без freeze authority и сохраняет публичную конфигурацию и подтверждённые транзакции в deployment.json. Повторный запуск при наличии файла остановится во избежание случайного создания второго vault.
При частичном сбое используйте сохранённые адреса и завершите недостающие операции; файл не удаляйте вслепую.

Кошелёк браузера нужно переключить на Devnet и пополнить тестовым SOL. Чтобы использовать UI отдельным кошельком, администратор должен передать ему DEV-USDC из созданного mint. Общедоступного faucet токена пока нет.

## Интерфейс

Wallet Standard через Solana wallet adapter; ожидание подписи, отправка, ожидание подтверждения, успех, ошибка и ссылка в Explorer. До deployment UI отображает отсутствие конфигурации. Не размещайте приватные ключи или seed-фразы во frontend.

```sh
cd frontend
npm ci
npm run build
```

Для публикации статического интерфейса используйте frontend/dist после синхронизации IDL и deployment.json.

## Ограничения и риски

Это не аудит и не mainnet-продукт. Upgrade authority может заменить программу. Mint authority может выпускать тестовый актив. Доходность полностью зависит от добровольных переводов администратора. Излишки от прямых переводов не выводятся. Нет pause, multisig, стратегии, faucet и гарантированной ставки. RPC может отказывать или ограничивать запросы. При таймауте подтверждения проверяйте подпись в Explorer перед повтором.

Перед mainnet нужны независимый аудит, проверка нескольких вкладчиков и подмены всех аккаунтов, fuzz/property-тесты, управление полномочиями, политика обновления, проверка зависимостей, мониторинг и полноценная экономическая модель.

## Демонстрация на 3–5 минут

1. Показать Devnet и подключить кошелёк.
2. Внести 100 DEV-USDC и показать доли, PDA и транзакцию.
3. Администратором добавить 10 DEV-USDC доходности.
4. Вывести 50 долей и показать полученные 55 DEV-USDC.
5. Показать негативный сценарий, тесты, ограничения и audit checklist.

## Источники

- [Anchor PDA](https://www.anchor-lang.com/docs/basics/pda)
- [Anchor token transfers](https://www.anchor-lang.com/docs/tokens/basics/transfer-tokens)
- [Account constraints](https://www.anchor-lang.com/docs/references/account-constraints)
