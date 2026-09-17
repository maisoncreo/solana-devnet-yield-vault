# Devnet Yield Vault

Учебный Solana Yield Vault: SPL Token, Anchor 0.31.1 и React. Только тестовые средства.

## Демоверсия

[Открыть Vault Lab](https://talbek-devnet-yield-vault.aikgjpch.chatgpt.site). Сайт доступен всем по ссылке. Для операций требуется Solana-кошелёк в Devnet и тестовый DEV-USDC.

## Статус

Локальный MVP собран: 10 Rust-тестов и 19 транзакционных тестов прошли, дополнительно 5 проверок числового адаптера; React production build выполнен. Подробности — в `STATUS.md`. Program ID опубликованной программы: `C6BADkFFFckPvxBCzsedCGFVzF9t1ByZszkUTmWjHbzR`. Программа развёрнута в Devnet. Все демонстрационные транзакции получили статус finalized.

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

## Какой сценарий запуска выбрать

| Цель | Раздел | Нужны ключи администратора? |
|---|---|---|
| Открыть готовое приложение или запустить его интерфейс на своём компьютере | 1. Существующий Devnet Vault | Нет; для операций нужен свой браузерный кошелёк |
| Собрать программу и выполнить автоматические тесты | 2. Локальные тесты | Нет; используется собственный локальный тестовый ключ |
| Создать собственную программу, mint и Vault в Devnet | 3. Новое развёртывание | Нужен собственный ключ для нового проекта |

Для разных сценариев используйте отдельные копии репозитория. Команды ниже рассчитаны на macOS/Linux и выполняются последовательно. Ключи опубликованной программы и администратора в репозиторий не входят.

## 1. Существующий Devnet Vault

Самый короткий путь — открыть [демоверсию](https://talbek-devnet-yield-vault.aikgjpch.chatgpt.site) в браузере с Phantom или другим совместимым Solana-кошельком. Включите Solana Devnet. Для операций нужны тестовые SOL на комиссии и DEV-USDC именно нашего mint, указанного ниже.

Чтобы запустить тот же интерфейс локально, достаточно Git, Node.js 22 и npm:

```sh
git clone https://github.com/maisoncreo/solana-devnet-yield-vault.git vault-demo
cd vault-demo
npm --prefix frontend ci
npm --prefix frontend run dev
```

Откройте адрес, который напечатает Vite (обычно http://127.0.0.1:5173). Интерфейс использует уже включённые в репозиторий `frontend/public/defi_vault.json` и `frontend/public/deployment.json`: это IDL и публичные адреса существующего Devnet-развёртывания.

**В этом сценарии не запускайте `anchor keys sync`, `anchor deploy`, `setup-devnet.ts` или `sync-frontend.cjs`.** Они предназначены для собственной программы и могут привести к несовпадению IDL и адресов. Rust, Anchor и приватный ключ администратора для запуска готового интерфейса не требуются.

Проверка production-сборки интерфейса:

```sh
npm --prefix frontend run build
```

Результат — `frontend/dist`. Статусы в интерфейсе: ожидание подписи, отправка, ожидание подтверждения, успех или ошибка со ссылкой в Explorer.

Общедоступного faucet для DEV-USDC пока нет. Перед проверкой депозита передайте автору проекта публичный Solana-адрес своего учебного кошелька для получения тестовых токенов. Обычный Solana faucet выдаёт только тестовый SOL. Приватный ключ или seed-фразу передавать не нужно. Без токенов можно просмотреть общие показатели Vault, но выполнить депозит нельзя.

## 2. Локальные тесты

Первоначальное проверенное окружение: Rust 1.96.1, Solana CLI и локальный validator 2.3.9, Anchor CLI 0.31.1, Node.js 22.14.0, npm 10.9.2. 15 сентября 2026 года пользователь повторил сборку и локальные тесты в свежей копии репозитория с Rust/Cargo 1.96.1, Solana CLI 4.2.2 и Anchor CLI 0.31.1: 10 Rust-тестов и 16 транзакционных тестов прошли. Версии Node.js и npm при повторной проверке отдельно не зафиксированы. На Intel macOS CLI 4.2.2 потребовал `brew install libusb`.

Перед запуском должны быть доступны `rustc`, `cargo`, `solana`, `solana-keygen`, `solana-test-validator`, `anchor`, `node` и `npm`. Сохраняйте `Cargo.lock`: он закрепляет зависимости, совместимые со встроенным компилятором Solana 2.3.9. Yarn не нужен.

Создайте отдельную копию и локальный тестовый кошелёк (не кошелёк с реальными средствами):

```sh
git clone https://github.com/maisoncreo/solana-devnet-yield-vault.git vault-local
cd vault-local
npm ci
npm --prefix frontend ci
npm run test:codec
mkdir -p target
solana-keygen new --no-bip39-passphrase --silent --outfile target/local-test-wallet.json
anchor build
node scripts/prepare-localnet.cjs
anchor build
cargo test -p defi-vault --lib --locked
anchor test --skip-build --provider.cluster localnet --provider.wallet target/local-test-wallet.json
```

Команда создания кошелька предназначена для первого запуска: если файл уже существует, используйте его повторно, не перезаписывайте. Секреты в `target/` исключены через `.gitignore`.

Первая сборка создаёт собственный ключ программы в `target/deploy/defi_vault-keypair.json`. `node scripts/prepare-localnet.cjs` переносит его публичный адрес в `declare_id!` и раздел `[programs.localnet]` в `Anchor.toml`. Скрипт требует доступный `solana-keygen` и уже созданный ключ программы. Скрипт явно изменяет только `[programs.localnet]` и `declare_id!`, сохраняя `[programs.devnet]`. Мы не полагаемся на выбор секции командой `anchor keys sync` в Anchor 0.31.1: ошибочная синхронизация оставляет разные адреса и вызывает `DeclaredProgramIdMismatch`. Повторная сборка согласует бинарный файл и IDL с этим адресом. Изменение Program ID здесь ожидаемо и относится только к этой локальной копии; опубликованный Devnet Vault не меняется.

Anchor запускает локальный валидатор и финансирует тестовый кошелёк локальным SOL. Devnet SOL для этих тестов не нужен. RPC-порт 8899 должен быть свободен; если он занят другим процессом, сначала выясните, каким именно. Ожидаемый результат расширенного набора: **10 Rust-проверок и 19 транзакционных тестов**. В `tests/multi-user.ts` проверяются два независимых вкладчика до/после начисления доходности, частичный и полный вывод, а также попытка Боба вывести позицию Алисы с проверкой неизменности обоих балансов и позиций. Отдельно проверяются отсутствие подписи владельца и подмена signer-флага. Пять проверок `test:codec` подтверждают работу локальной замены bigint-buffer.

Не копируйте полученный локальный IDL в интерфейс существующей демоверсии. После тестов `frontend/public` по-прежнему содержит конфигурацию опубликованного Devnet Vault, а `target/idl` относится к вашей локальной программе.

## 3. Новое развёртывание в Devnet

Этот сценарий создаёт **собственные** Program ID, mint, Vault и конфигурацию интерфейса. Опубликованные адреса в конце README остаются примерами исходной демоверсии.

1. В отдельной копии проекта выполните раздел «Локальные тесты» до успешного завершения. Сохраните сгенерированный `target/deploy/defi_vault-keypair.json`: он нужен для первоначального размещения вашей программы. Не пытайтесь развернуть новую программу под Program ID автора без соответствующего ключа.

2. Создайте отдельный Devnet-кошелёк вне репозитория:

```sh
mkdir -p "$HOME/.config/solana"
solana-keygen new --no-bip39-passphrase --silent --outfile "$HOME/.config/solana/defi-vault-devnet.json"
solana address --keypair "$HOME/.config/solana/defi-vault-devnet.json"
```

Если такой файл уже есть, пропустите создание и используйте существующий учебный кошелёк. Сохраните ключ безопасно. Получите на напечатанный адрес бесплатный тестовый SOL через https://faucet.solana.com, выбрав Devnet. В исходной демонстрации использовалось пополнение 5 SOL; необходимая сумма зависит от размера программы и сетевых комиссий.

3. Для собственной программы явно замените `defi_vault` в секции `[programs.devnet]` файла `Anchor.toml` на публичный адрес из `solana-keygen pubkey target/deploy/defi_vault-keypair.json`. Он должен совпадать с `declare_id!` и `target/idl/defi_vault.json`. Это намеренная смена Devnet ID только для нового развёртывания. Затем проверьте баланс и разместите собранную программу:

```sh
solana balance --url devnet --keypair "$HOME/.config/solana/defi-vault-devnet.json"
anchor deploy --provider.cluster devnet --provider.wallet "$HOME/.config/solana/defi-vault-devnet.json"
```

Дождитесь успешного завершения. Используется только Devnet. При частичном сбое сначала проверьте программу и буферы через `solana program show` / `solana program show --buffers` с тем же кошельком и `--url devnet`; повторное создание буферов может расходовать дополнительный тестовый SOL.

4. **Только перед первым запуском настройки нового Vault** сохраните исходную демонстрационную конфигурацию в отдельную папку. Эти файлы содержат публичные адреса, не приватные ключи:

```sh
mkdir -p target/original-demo
mv -n deployment.json target/original-demo/deployment.json
mv -n frontend/public/deployment.json target/original-demo/frontend-deployment.json
mv -n frontend/public/defi_vault.json target/original-demo/defi_vault.json
```

После этого в корне не должно быть `deployment.json`. Если резервная копия уже существовала и исходный файл остался на месте, остановитесь и выясните, к какому развёртыванию он относится. Эти команды не предназначены для повторного запуска после частичного сбоя настройки.

5. Создайте тестовый mint и Vault, затем подготовьте интерфейс:

```sh
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET="$HOME/.config/solana/defi-vault-devnet.json" npx ts-node scripts/setup-devnet.ts
node scripts/sync-frontend.cjs
npm --prefix frontend ci
npm --prefix frontend run dev
```

Выполняйте следующую команду только после успешного завершения предыдущей. Скрипт настройки проверяет genesis hash Devnet, создаёт mint без freeze authority, выдаёт администратору 1000 тестовых токенов и выполняет демонстрационный цикл: депозит 100 → добавление доходности 10 → вывод 50 долей за 55 токенов.

Новый `deployment.json` содержит ваши адреса и подписи. `sync-frontend.cjs` копирует именно его и новый `target/idl/defi_vault.json` в `frontend/public`. Перед запуском интерфейса проверьте совпадение `programId` в `frontend/public/deployment.json` с `address` в `frontend/public/defi_vault.json`.

Для операций из отдельного браузерного кошелька переведите ему часть тестовых токенов администратора из **нового mint** и тестовый SOL. Токены исходной демоверсии не подходят к новому Vault.

### Повторный запуск и восстановление

- Если ваш `deployment.json` уже существует, `setup-devnet.ts` намеренно остановится. Для обычного повторного запуска интерфейса настройку повторять не нужно.
- При сбое после создания файла сохраните его: он содержит уже созданные адреса и завершённые операции. Проверьте состояние в Explorer и завершите только недостающие операции; автоматического восстановления скрипт не реализует.
- При сбое до записи файла mint или токеновый аккаунт уже могли быть созданы. Проверьте историю Devnet-кошелька до повторного запуска.
- Не переименовывайте результат неудачной настройки лишь ради обхода проверки наличия файла: это создаст ещё один набор аккаунтов.
- `scripts/verify-devnet.cjs` проверяет конкретный снимок сразу после исходного демонстрационного цикла (55 токенов / 50 долей). После последующих пользовательских операций эти значения меняются; скрипт не является универсальной проверкой текущего состояния.

### Границы выполненной проверки

Devnet deployment и операции через Phantom проверены в рабочем окружении автора. 15 сентября 2026 года пользователь проверил свежую копию GitHub-репозитория на своём компьютере с уже установленными инструментами:

- сборка интерфейса (`tsc --noEmit && vite build`) завершилась успешно; Vite сообщил предупреждение о размере JavaScript-бандла;
- локальный интерфейс открылся и отобразил данные Vault и пользовательской позиции;
- программа собралась после синхронизации Program ID для `localnet`;
- Rust-тесты: **10 passed, 0 failed**; интеграционные тесты: **16 passing**.

Результаты подтверждены предоставленным пользователем выводом команд и скриншотами. При проверке обнаружено несовпадение Program ID: добавление `--provider.cluster localnet` к команде синхронизации и повторная сборка устранили его. После отзыва преподавателя эта команда заменена в инструкции выше на скрипт с явным выбором секции localnet; исторический результат проверки сохранён здесь для прозрачности.

Это проверка воспроизводимости из свежей копии на существующем компьютере, а не полная установка окружения на чистой ОС. Повторный Devnet deployment из свежей копии не выполнялся. Установка npm-зависимостей сообщила о 15 уязвимостях (1 low, 8 moderate, 6 high); успешные сборка и тесты не означают, что эти замечания устранены.

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

## Проверенное развёртывание Devnet

Program ID: `C6BADkFFFckPvxBCzsedCGFVzF9t1ByZszkUTmWjHbzR`

Mint DEV-USDC: `4LCPHLefwLvMrjiiQAwunf9Aa9kxBv4Z2LbzGeiVoR1X`

Vault PDA: `Vyb2fkLFGpNnrVbvdiFZxBvSvD35pJJ7zVBcf2tcvHR`

- [mintTx](https://explorer.solana.com/tx/26sdgs7jZA9ZANZsgm8Jbp8GRL5em64TK6WPnDRXpZa6kwXRdy9nZXZfaB1zkdzgmTiCrKF73PXVW5mnBcc3VymJ?cluster=devnet)
- [initialize](https://explorer.solana.com/tx/2r8sGDHirHmLg2hJBrMkzD5NArqx1YsjVuAgckYSLhArFSE3FJTNYPHpFhVDUMkgeSxKVUPX9NXi3z5KWcW7EXcZ?cluster=devnet)
- [deposit](https://explorer.solana.com/tx/d2Xsx9jCXa8zXxy252hErYwDDrGjFihaVyjMfhVFVu1NsDZbqdip9BGM3h14WyycSWDjJE78Six5DD7oA4fKSrM?cluster=devnet)
- [addYield](https://explorer.solana.com/tx/3e7knBVUbBo8bgJHjF2Fhh8KPMFNdQzxEZEErhHYrKXu1y5WKwH9iGRKoVnSzetWVKAs3SKypQJfzM23KsQ9F1Bo?cluster=devnet)
- [withdraw](https://explorer.solana.com/tx/4MzGMEgNgHUZjFhzcLgySceWqYWvuBPo6d73yGEGvvjdXgbyvKfcwea7zyHgwBoFrnv7PX974116Ji4HmSENBLmV?cluster=devnet)
- [deploy](https://explorer.solana.com/tx/3g6FYh57HdVjQUtBW1WgAnvVKQp5MPcmocJGgzP7QoHYtpgTfLhL3FK8EdaDrEJDRLGEDrANqB8kNFiEXKZHaiCT?cluster=devnet)

Проверенный результат: депозит 100, доходность 10, вывод 50 долей за 55 DEV-USDC. После демонстрации в vault 55 DEV-USDC и 50 долей.

CLI обновлён до 4.2.2; на Intel macOS требуется `brew install libusb`. После частичного сбоя загрузка успешно продолжена через `solana program deploy ... --buffer EXISTING_BUFFER --use-rpc --url devnet`. При сбое сначала проверьте программу и существующие буферы, не создавайте их повторно вслепую.

## Проверка через Phantom — 14 сентября 2026

Пользователь самостоятельно подписал обе операции в браузерном интерфейсе. Результат проверен чтением Devnet, обе транзакции finalized:

- [Депозит 10 DEV-USDC](https://explorer.solana.com/tx/2HiNq5WyUGDLbS9Zf6Bj7Eo5tNNQFMyibyyRsUDfNKNHjLc4HQE8w7FCfZwDSN8Ufw3WnpxfwkKU1pWLt1ZZLRmx?cluster=devnet): начислено 9,090909 доли.
- [Вывод 5 долей](https://explorer.solana.com/tx/2VV9Ub75xRMw86pEyQTYZa841qQZt5f89tsNbhzVu5FvDZsSoGg8sA472dULPUv2AgdUYqnUKzhA4m8HB4MHcKtu?cluster=devnet): получено 5,5 DEV-USDC.

После проверки у пользователя 95,5 DEV-USDC в кошельке и 4,090909 доли в vault. Общие активы vault: 59,5 DEV-USDC; общее число долей: 54,090909. Это снимок состояния, последующие операции изменят значения.

## Доработка после проверки преподавателя

Локальная подготовка выполняется через `node scripts/prepare-localnet.cjs`: публичный адрес читается из локального ключа программы, обновляются только код и секция localnet. Опубликованный Devnet ID сохраняется. Запускайте это только в отдельной тестовой копии.

Отчёт по зависимостям, исправлениям и оставшимся рискам: [DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md).

17 сентября 2026 года исправленная последовательность проверена в отдельной копии без `target` и `node_modules`: установка через `npm ci`, первичная сборка, подготовка localnet с проверкой неизменности секции Devnet, повторная сборка, **10 Rust-тестов и 19 интеграционных тестов — успешно**. TypeScript и production-сборка frontend также прошли. Это проверка с установленным окружением macOS, а не установка чистой ОС.

Финальная доработка зависимостей: `npm audit` показывает **0 high / 0 critical** в корне и frontend. Moderate/low остаются; полный разбор и происхождение локального адаптера указаны в DEPENDENCY_AUDIT.md.
