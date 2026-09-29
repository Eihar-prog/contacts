# Project Map — Contacts App

## Суть проекта

Десктопное приложение для хранения и управления контактами (холодная рассылка).
Стек: **pywebview** (Python + HTML/CSS/JS фронтенд), **SQLite**.

---

## Структура файлов

```
Contacts/
├── run.py                      # Точка входа — pywebview окно
├── py_backend/
│   ├── api/
│   │   └── app_api.py          # JS-Python bridge (AppAPI класс)
│   ├── db/
│   │   └── database.py         # SQLite CRUD (таблица contacts)
│   └── utils/
│       ├── __init__.py
│       ├── paths.py            # Утилита путей проекта
│       └── config.py           # Универсальный менеджер config.json (без хардкода ключей)
├── frontend/
│   ├── index.html              # Точка входа. <script type="module" src="js/app.js">
│   ├── css/
│   │   ├── reset.css           # Нормализация стилей
│   │   ├── style.css           # CSS-переменные и @import всех css-файлов
│   │   ├── layout.css          # Сетка: .app → .layout → .sidebar + .main + .footer
│   │   ├── forms.css           # Форма создания контакта (create-form, поля, блоки)
│   │   └── cards.css           # Просмотр контактов (поиск, карточки, статусы, переключатель вида)
│   ├── js/
│   │   ├── app.js              # Главный модуль (ES6). Состояние, конфиги, шаблоны блоков
│   │   ├── handlers.js         # Обработчики событий (bindEvents, switchTab, saveContact и т.д.)
│   │   └── backendApi.js       # Единый слой связи с Python-бэкендом (прямые вызовы pywebview.api.*)
│   └── config/
│       ├── contact.json        # Схема типов контактов: phone, email, sm (с подтипами)
│       ├── status.json         # Статусы рассылки: sent, viewed, replied, ignored, rejected
│       └── config.json         # Настройки приложения (путь к БД, режим просмотра, и т.д.)
├── CHANGELOG.md                # Все изменения по сегментам
├── PROJECT_MAP.md              # Этот файл
└── Описание проекта.txt        # Исходное ТЗ
```

---

## Архитектура

### Backend (Python)

```
run.py → AppAPI (JS bridge) → Database (SQLite)
                              → Config (config.json)
```

**Database:** SQLite с одной таблицей `contacts`:

- `id` — INTEGER PRIMARY KEY AUTOINCREMENT
- `name` — TEXT NOT NULL
- `blocks` — TEXT (JSON-строка с динамическими блоками)
- `created_at` / `updated_at` — TIMESTAMP

**Config (`py_backend/utils/config.py`):**

- Универсальный класс, не знает ключей config.json
- `load()` — читает config.json, возвращает любой словарь
- `save(data)` — записывает любой словарь в config.json

**AppAPI методы** (вызываются из JS через `pywebview.api.*`):

- `create_database()` — диалог создания .db файла
- `open_database()` — диалог открытия .db файла
- `open_database_by_path(path)` — открытие БД по пути (без диалога)
- `load_config(name)` — загрузка contact.json / status.json
- `read_settings()` — загрузка config.json
- `write_settings(data)` — сохранение config.json
- `get_contacts()` — все контакты
- `get_contact(id)` — контакт по id (для редактирования / инлайн-смены статуса)
- `save_contact(data)` — создание контакта
- `check_duplicate(name)` — проверка дубликата по имени
- `update_contact(id, data)` — обновление
- `delete_contact(id)` — удаление
- `search_contacts(query)` — поиск по имени

### Frontend → Backend связь

```
handlers.js / app.js → backendApi.js → pywebview.api.* (прямые вызовы) → AppAPI
```

### Layout (flexbox)

```
.app (column, min-height:100vh)
  .layout (row, flex:1)
    .sidebar (200px, column)      ← левая панель навигации
      .sidebar__top               ← логотип + название
      .sidebar__nav               ← кнопки Создать / Контакты + счётчик
      .sidebar__bottom            ← кнопки Создать БД / Открыть БД
    .main (flex:1, overflow-y:auto) ← контент вкладок
  .footer (20px)                  ← статус + версия
```

### Вкладки

- **Создать контакт** (`#tabCreate`): форма с именем + динамические блоки (Info/Contact/Site);
  в режиме редактирования — заголовок «Редактирование контакта» + кнопка «Отмена»
- **Мои контакты** (`#tabView`): поиск + переключатель вида (сетка/список) + карточки

### Блоки (динамически через JS)

- **Info**: название (input) + текст (textarea)
- **Contact**: тип (select) + значение (input) + статус (select) + подтип для соцсетей
- **Site**: URL (input)

### Интерактивность карточек (Сегмент 17)

- Редактирование контакта по кнопке ✏️ — та же форма с заголовком «Редактирование контакта» (заполняются все блоки)
- Site-URL — кликабельная ссылка `target="_blank"` (pywebview открывает в системном браузере);
  у полей Contact и Info — кнопка «копировать» по ховеру (pywebview.clipboard → navigator → execCommand)
- Инлайн-смена статуса: двойной клик по бейджу → селект + галочка ✓; отмена — Escape или клик вне; пустой статус тоже редактируется

---

## Ключевые переменные (CSS)

```css
--color-accent: #6366f1;    /* фиолетовый accent */
--color-bg: #f4f6f9;        /* фон */
--color-surface: #ffffff;    /* карточки, панели */
--max-width: 820px;          /* макс. ширина контента */
```

## Ключевые классы (JS)

```javascript
// state
state.contactTypes     // из contact.json
state.statuses         // из status.json
state.blockCounter     // счётчик для уникальных ID блоков
state.dbPath           // путь к открытой БД
state.viewMode         // 'grid' или 'list'
state.editingId        // id редактируемого контакта (null — режим создания)

// dom (кэш элементов)
dom.sidebarBtns        // кнопки навигации [data-tab]
dom.tabContents        // { create: Element, view: Element }
dom.blocksContainer    // контейнер для блоков
dom.contactName        // поле имени контакта
dom.cardsContainer     // контейнер для карточек
dom.viewToggle         // переключатель вида (сетка/список)
dom.formTitle          // заголовок формы («Новый контакт» / «Редактирование контакта»)
dom.btnCancelEdit      // кнопка «Отмена» редактирования
dom.updateContactList  // функция обновления списка

// Модалка удаления
dom.modalDelete
pendingDeleteId

// Модалка дубликата
dom.modalDuplicate
pendingDuplicateName / pendingDuplicateData
```

## Модули JS

- **`backendApi.js`** — все вызовы `pywebview.api.*()` напрямую: `createDatabase()`, `openDatabase()`, `openDatabaseByPath()`, `saveContact()`, `getContacts()`, `getContact()`, `updateContact()`, `deleteContact()`, `checkDuplicate()`, `searchContacts()`, `loadConfig()`, `loadSettings()`, `saveSettings()`
- **`handlers.js`** — `bindEvents()`, `switchTab()`, `deleteBlock()`, `handleContactTypeChange()`, `handleSubtypeChange()`, `saveContact(dom, state, actions)` (в т.ч. режим редактирования: проверка дубликата, исключая сам контакт)
- **`app.js`** — инициализация (DOMContentLoaded → init → loadConfigs → waitForApi), конфиги, шаблоны блоков, БД-обработчики, рендер карточек (все блоки с иконками/статусами), сворачиваемые Info-блоки (+/-), переключатель вида, модалки, редактирование (`startEditContact` / `loadContactIntoForm` / `resetForm`), копирование (`copyFieldValue`), инлайн-статус (`startStatusEdit` / `confirmStatusEdit`), утилиты, `restoreSettings()` / `saveSettings()`

---

## Что не сделано (план)

- [x] Редактирование контакта (кнопка ✏️ на карточке) — готово (Сегмент 17)
- [x] Инлайн-смена статуса на карточке — готово (Сегмент 17)
- [ ] Поиск по контактам (поле searchInput не привязано к API)
- [ ] Экспорт/импорт БД
