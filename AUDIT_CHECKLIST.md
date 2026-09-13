# Checklist перед сдачей

Этот список не является независимым аудитом. Галочка означает наличие в коде, а не доказательство отсутствия ошибок.

- [x] Signer для пользователя и администратора.
- [x] Vault seeds привязаны к admin и mint.
- [x] Position seeds привязаны к vault и user.
- [x] SPL mint, token authority, program owner проверяются типами и constraints.
- [x] Token account vault имеет фиксированные seeds.
- [x] Нулевые суммы, capacity, недостаточные shares, dust, min output проверяются.
- [x] Проверяемая арифметика u64/u128.
- [x] add_yield доступен только admin и требует непустого vault.
- [x] Mint с freeze authority не допускается.
- [x] Повторный депозит сохраняет существующие доли.
- [x] Ключи и target исключены через .gitignore.
- [x] Успешная SBF-сборка и IDL.
- [x] Пройдены Rust и транзакционные тесты (10 + 16).
- [x] Тесты чужого admin signer, mint и token account.
- [ ] Дополнительные тесты подмены позиции и отсутствующей подписи.
- [ ] Несколько независимых вкладчиков и fuzz/property-тесты.
- [x] Проверен frontend build и открытие wallet modal.
- [ ] Работа с реальным Devnet-кошельком.
- [ ] Проверены dependency audit findings.
- [ ] Devnet deployment подтверждён, Program ID и Explorer-ссылки сохранены.
- [ ] Публичный GitHub-репозиторий создан без секретов.
- [ ] Демо опубликовано или записано видео.
- [ ] Upgrade authority и ограничения объяснены в демонстрации.
