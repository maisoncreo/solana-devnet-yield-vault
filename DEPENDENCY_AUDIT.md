# Разбор npm audit — 17 сентября 2026

Проверены отдельно корень (CLI, настройка и тесты) и `frontend` (браузерное приложение и сборка). Числа ниже относятся к lock-файлам этого изменения и базе advisories на дату проверки; npm учитывает также родительские пакеты с уязвимой транзитивной зависимостью. Это не число независимых эксплойтов.

| Область | До: low / moderate / high / critical | После |
|---|---|---|
| Корень | 2 / 8 / 6 / 0 | 2 / 8 / 3 / 0 |
| Frontend | 0 / 15 / 5 / 0 | 0 / 16 / 3 / 0 |

## High: исправления

- `toml`: [неконтролируемая рекурсия](https://github.com/advisories/GHSA-82x6-q7mm-w9cf) и [prototype pollution](https://github.com/advisories/GHSA-v5mp-jgw5-2x6j). Anchor использует `toml.parse` при чтении локального Anchor.toml. Недоверенный TOML мог вызвать отказ в обслуживании или изменение прототипа. В обоих package.json явно закреплён override `toml: 4.2.0`, закрывающий обе advisory. Так как это переход основной версии транзитивной зависимости, совместимость проверяется реальным запуском Anchor integration tests, читающим Anchor.toml. Node.js 22 удовлетворяет требованию Node >=20.
- `serialize-javascript`: [возможность исполнения кода](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) при обработке специально подготовленных объектов. Зависимость Mocha используется в инструментах тестирования, не в on-chain программе. Корневой override закрепляет `7.0.5`; эта версия также закрывает [CPU exhaustion](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v). Проверяется запуском полного набора тестов. Режим параллельных worker-процессов Mocha отдельно не проверялся.

## High: оставшийся риск, не объявлен исправленным

[bigint-buffer / GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg): buffer overflow в `toBigIntLE`. Цепочка: `@solana/spl-token -> @solana/buffer-layout-utils -> bigint-buffer@1.1.5`. Три high в каждой области — эта зависимость и два её родителя. npm сообщает `fixAvailable: false`.

Браузерный entrypoint пакета использует JavaScript вместо native binding. В Node entrypoint возможна загрузка native binding, поэтому риск для Node-скриптов не исключён. Проверенный `buffer-layout-utils` декодирует числовые поля фиксированной длины (8, 16, 24, 32 байта); произвольные пользовательские буферы приложение напрямую в `toBigIntLE` не передаёт. Это ограничивает поверхность атаки, но не является доказательством полной недостижимости уязвимости.

Решение для учебного Devnet: документировать остаточный риск; не использовать эти Node-инструменты как публичный сервис обработки недоверенных данных. До mainnet требуется обновлённая upstream-зависимость либо проверенная замена реализации и отдельная проверка всех путей декодирования. Мы не подменяли пакет непроверенным форком и не скрывали audit через `--omit` или изменение порога severity.

## Остальные замечания

Остаются moderate/low в цепочках `jayson`, `uuid`, `stream-json`, `mocha` и кошельковых адаптеров. Полные списки сохранены в `audit/npm-root.json` и `audit/npm-frontend.json`. Lock-файл frontend после разрешения зависимостей даёт на одно moderate больше; это не отчёт «всё исправлено». npm также выдаёт peer-dependency warnings для транзитивных wallet/mobile/React Native пакетов. Проверка TypeScript и Vite build проходит; мобильный React Native сценарий не проверен.

## Воспроизведение

```sh
npm ci
npm audit --json
npm --prefix frontend ci
npm --prefix frontend audit --json
```

Ненулевой exit code audit ожидаем, пока остаются замечания. `npm audit fix --force` не применялся. Успешные тесты не являются аудитом безопасности и не отменяют оставшиеся риски.
