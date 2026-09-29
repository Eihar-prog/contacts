# Changelog — Contacts App

## Сегмент 1 — Структура + HTML + CSS-база

- Создана структура папок: `frontend/css/`, `frontend/js/`, `frontend/config/`
- **index.html** — главная страница: шапка с логотипом и кнопкой "Открыть БД",
  навигация с двумя вкладками ("Создать контакт", "Мои контакты"),
  контентная область, подвал со статусом
- **css/reset.css** — нормализация стилей (box-sizing, сброс отступов, базовые шрифты)
- **css/style.css** — главный файл стилей с CSS-переменными (цвета, тени, скругления, типографика)
- **css/layout.css** — сетка приложения, шапка, вкладки, контент, подвал

## Сегмент 2 — Стилизация контента

- **css/forms.css** — стили формы создания контакта:
  - Контейнер формы, поля ввода (input/textarea/select) с hover/focus-эффектами
  - Панель добавления блоков (Info/Contact/Site) с пунктирной рамкой
  - Динамические блоки с шапкой, меткой, кнопкой удаления (—)
  - Стили для блоков: Info (textarea), Contact (селекты + ряды), Site (inline)
- **css/cards.css** — стили просмотра контактов:
  - Поиск с иконкой лупы, сетка карточек (auto-fill)
  - Пустое состояние с подсказкой
  - Карточка контакта с аватаром, кнопками редактирования/удаления
  - Цветовые статусы рассылки (sent/viewed/replied/ignored/rejected)
- **style.css** — добавлены импорты forms.css и cards.css, новая тень --shadow-xl

## Сегмент 3 — JSON-конфиги

- **config/contact.json** — схема типов контактов для блока Contact:
  - phone (телефон), email, sm (соцсети с вложенностью: tg/inst/whatsapp)
  - Каждый тип: id, label, icon, hasSubtypes, placeholder
- **config/status.json** — статусы рассылки:
  - 6 статусов: пусто → sent → viewed → replied → ignored → rejected
  - Каждый: id, label, color, cssClass (привязка к стилям cards.css)

## Сегмент 4 — JavaScript: базовая логика

- **js/app.js** — главный скрипт приложения:
  - Переключение вкладок (tab-навигация)
  - Загрузка JSON-конфигов через fetch
  - Генерация динамических блоков Info/Contact/Site
  - Contact: селект типа + вложенный селект для соцсетей + статус
  - Удаление блоков (кнопка −)
  - Сбор данных формы и вывод в консоль (заглушка сохранения)

## Сегмент 5 — Рефакторинг JS + уплотнение CSS

- **js/handlers.js** — новый файл: все обработчики событий вынесены из app.js
- **js/app.js** — переписан на ES6-модуль (import/export), отвечает за состояние,
  конфиги, шаблоны блоков, анимации и утилиты
- **index.html** — изменён на `<script type="module" src="js/app.js">` (единая точка входа)
- **CSS-уплотнение:**
  - Шапка: 56px → 40px, подвал: 32px → 26px
  - Форма: padding 28px 32px → 14px 18px
  - Поля ввода: уменьшены padding, font-size, margin-bottom
  - Блоки: gap 16px → 8px, заголовки компактнее
  - Карточки: padding, аватар 32→24px, шрифты меньше
  - Панель добавления: padding 16px 20px → 8px 12px
  - max-width контента: 1024px → 820px

## Сегмент 6 — Точечные правки layout + чистка

- **HTML:** убран subtitle «Заполните информацию» (экономия высоты)
- **Layout:** переработана структура шапки:
  - `.topbar` — тонкая верхняя панель 28px только с кнопкой «Открыть БД»
  - `.pagenav` — навигация страниц ниже (стиль страниц сайта, а не вкладок)
  - `.pagenav__counter` — счётчик контактов на accent-фоне
- **CSS:** footer ужат до 20px, удалены мёртвые переменные `--header-height`/`--footer-height`
- **JS:** `dom.tabs` → `dom.pagenavBtns` (чистота нейминга), удалён неиспользуемый `dom.tabCounter`,
  класс `tab--active` → `pagenav__btn--active` в switchTab

## Сегмент 7 — Сайдбар (левая панель)

- **Layout:** шапка и навигация заменены на левый сайдбар (200px)
- **Сайдбар:**
  - Верх: логотип "C" + название "Contacts"
  - Середина: кнопки навигации (✏️ Создать контакт, 📇 Мои контакты) с бейджем счётчика
  - Низ: кнопка «📂 Открыть БД»
  - Кнопки: иконка + текст в строку, hover-подсветка, активная кнопка accent-цветом
- **Основной контент:** flex: 1, overflow-y: auto
- **CSS:** удалены старые классы .topbar, .pagenav, .pagenav__*
- **JS:** `dom.pagenavBtns` → `dom.sidebarBtns`, класс `pagenav__btn--active` → `sidebar__btn--active`
- **Footer:** 20px, ужат до минимального

## Сегмент 8 — Python-бэкенд + JS-интеграция

- **py_backend/:** новая структура Python-бэкенда:
  - `utils/paths.py` — утилита разрешения путей проекта
  - `db/database.py` — SQLite-слой (таблица contacts с JSON-полем blocks, CRUD, поиск)
  - `api/app_api.py` — JS-Python bridge (open_database, load_config, CRUD контактов)
- **run.py** — точка входа pywebview (окно 1100×750, debug=True)
- **frontend/js/backendApi.js** — единый JS-слой связи с бэкендом (универсальная call()-обёртка)
- **frontend/js/handlers.js** — saveContact теперь async, вызывает BackendApi.saveContact()
- **frontend/js/app.js** — импорт BackendApi, handleOpenDatabase(), updateContactList(),
  updateContactCounter(), escapeHtml(), formatDate()
- **Исправления:** dom.updateContactList назначен для автообновления списка после сохранения;
  loadConfig упрощён (убрано дублирование JSON.parse)

## Сегмент 9 — Favicon + кнопка «Создать БД»

- **index.html:** добавлен favicon (inline SVG с эмодзи 📇) — больше нет 404 в консоли
- **Сайдбар:** добавлена кнопка «🆕 Создать БД» над «📂 Открыть БД»
- **py_backend/api/app_api.py:** новый метод create_database() — SAVE_DIALOG,
  создаёт .db файл с фиксированным расширением (*.db), инициализирует таблицы
- **frontend/js/backendApi.js:** новый метод createDatabase()
- **frontend/js/app.js:** новый обработчик handleCreateDatabase() — создаёт БД,
  обновляет footer, счётчик, список, переключает на вкладку просмотра
- **frontend/css/layout.css:** sidebar__bottom → flex-column gap:4px;
  новый класс .sidebar__create-btn (accent-цвет, жирный шрифт)

## Сегмент 10 — Модальное окно удаления контакта

- **index.html:** добавлено модальное окно (#modalDelete) с именем контакта,
  кнопками «Отмена» и «🗑️ Удалить»
- **css/layout.css:** стили модального окна — overlay с затемнением,
  карточка 360px, анимация открытия/закрытия
- **js/app.js:**
  - showDeleteModal(id, name) — открывает модалку с именем контакта
  - hideDeleteModal() — закрывает (по кнопкам, overlay, Escape)
  - confirmDeleteContact() — вызывает BackendApi.deleteContact() + обновляет список
  - В карточки добавлен data-name для передачи имени в модалку
- **js/handlers.js:** делегирование click на .card__btn--delete → showDeleteModal()
- **Бэкенд:** метод delete_contact уже был, threading fix (check_same_thread=False)

## Сегмент 11 — Обнаружение дубликатов контактов

- **py_backend/db/database.py:** новый метод `find_by_exact_name(name)` с регистронезависимым
  поиском точного совпадения (`LOWER(name) = LOWER(?)`)
- **py_backend/api/app_api.py:** новый метод `check_duplicate(name)` — обёртка для JS
- **frontend/js/backendApi.js:** новый метод `checkDuplicate(name)`
- **frontend/index.html:** новая модалка (#modalDuplicate) с тремя кнопками:
  «Отмена», «📝 Оставить оба», «🔄 Заменить»
- **frontend/css/layout.css:** класс `.modal__footer--three` для трёх растянутых кнопок
- **frontend/js/handlers.js:** saveContact теперь:
  - Принимает `actions` как третий параметр
  - Перед сохранением проверяет дубликат через BackendApi.checkDuplicate()
  - Если дубликат найден → показывает модалку с выбором действия
  - Если нет → сразу вызывает doSaveContact()
- **frontend/js/app.js:**
  - DOM-рефы для модалки дубликата
  - showDuplicateModal(name, formData, existingId)
  - confirmDuplicateKeepBoth() — просто создаёт новый контакт
  - confirmDuplicateReplace() — удаляет старый + создаёт новый (без лишнего API-запроса)
  - doSaveContact() — фактическое сохранение + обновление списка

## Сегмент 12 — Полноценный рендер карточек + сортировка блоков

- **js/app.js:** переписан рендер карточек — теперь показываются все блоки контакта
  с иконками, названиями, значениями и цветными статусами рассылки
- **js/app.js:** Info-блоки на карточках сворачиваются в одну строку по умолчанию,
  кнопки +/− для раскрытия/сворачивания
- **js/handlers.js:** сортировка блоков при сохранении: Info → Contact → Site
- **js/handlers.js:** делегирование клика на кнопки +/− сворачивания Info-блоков
- **css/cards.css:** стили для .cards--list (режим списка),
  .view-toggle (переключатель вида с SVG-иконками),
  .card__info-toggle (кнопки +/−), .card__meta

## Сегмент 13 — Переключатель вида (сетка/список)

- **index.html:** группа кнопок переключения вида с SVG-иконками (⊞ сетка / ☰ список)
- **css/cards.css:** стили .view-toggle, режим списка .cards--list (1 колонка на всю ширину),
  внутри карточки блоки в 2 колонки
- **js/app.js:** state.viewMode, setViewMode(), обновление кнопок и контейнера

## Сегмент 14 — Система конфигурации (config.json + config.py)

- **py_backend/utils/config.py:** новый модуль — универсальный Config класс,
  не знает ключей config.json (агностик), load()/save()
- **frontend/config/config.json:** файл настроек приложения (изначально пустой {})
- **py_backend/api/app_api.py:** новые методы read_settings(), write_settings(),
  open_database_by_path(path), рефакторинг _connect_db()
- **frontend/js/backendApi.js:** новые методы loadSettings(), saveSettings(), openDatabaseByPath()
- **frontend/js/app.js:** restoreSettings() при старте — восстанавливает режим просмотра
  и авто-открывает последнюю БД; saveSettings() при смене режима и открытии/создании БД

## Сегмент 15 — Рефакторинг backendApi.js (прямые вызовы вместо call-обёртки)

- **frontend/js/backendApi.js:** все методы переписаны на прямые вызовы
  pywebview.api.method_name() без динамической bracket-нотации [method](...args)
- Удалена универсальная функция call() — больше не используется

## Сегмент 16 — Чистка инициализации

- **js/app.js:** инициализация переведена на DOMContentLoaded → init() напрямую
  (без pywebviewready, без ретраев, без setTimeout)
- **js/app.js:** bindEvents() вызывается до любых pywebview-зависимостей —
  кнопки работают независимо от готовности моста
- **js/app.js:** restoreSettings() вызывается один раз, без ретраев и задержек;
  ошибки pywebview тихо обрабатываются try/catch в backendApi.js

## Сегмент 17 — Интерактивные карточки контактов (Задача 1 из needs.txt)

- **Редактирование контакта** (кнопка ✏️ на карточке):
  - **py_backend/api/app_api.py:** новый метод `get_contact(id)` — контакт по id
  - **frontend/js/backendApi.js:** новый метод `getContact(id)` (обработка ошибок, null при сбое)
  - **js/app.js:** форма переиспользуется для редактирования — заголовок
    «Редактирование контакта», заполнение всех блоков (Info/Contact/Site с подтипами
    и статусами), кнопка «Отмена», сохранение через `update_contact` с возвратом на список
  - **js/handlers.js:** в режиме редактирования проверка дубликата по имени,
    исключая сам редактируемый контакт; клик по «Создать контакт» сбрасывает форму
- **Кликабельные ссылки и копирование:**
  - Site-URL рендерится ссылкой `<a target="_blank">` (pywebview открывает в системном браузере)
  - у полей Contact и Info — кнопка-иконка «копировать» по ховеру
    (`copyToClipboard`: pywebview.clipboard → navigator.clipboard → execCommand)
  - пустой Info-блок — без кнопки копирования (не копируется «—»)
- **Инлайн-смена статуса на карточке:**
  - двойной клик по бейджу статуса → инлайн-селект + галочка ✓
  - пустой статус тоже редактируется (пунктирный бейдж `card__field-status--empty`,
    label берётся из status.json)
  - отмена по Escape / клику вне; при ошибке бэкенда бейдж восстанавливается (`restoreStatusBadge`)
- **Фикс гонки инициализации:** автозагрузка БД (restoreSettings) стартует только после
  загрузки конфигов — `await init()` перед `waitForApi()` (иначе первичный рендер карточек
  мог показать фолбэк-статусы до загрузки contact.json/status.json)
- **CSS:** `.card__btn` (редактировать/удалить), `.card__copy-btn`, `.card__field-link`,
  `.card__status-editor/.card__status-select/.card__status-confirm`,
  `.card__field-status--empty`, `.btn--cancel`, `.create-form__title--edit`
- **Проверка:** E2E-автотест в headless Chrome (mock-бэкенд) — 9/9 шагов
  (рендер, ссылки, копирование, редактирование, инлайн-статус, Escape);
  тест бэкенда get_contact/update_contact — OK

## Сегмент 18 — Фикс гонки инициализации моста pywebview

- **Симптом:** при старте иногда `TypeError: getBackendApi(...).read_settings is not a function`
  в restoreSettings, хотя в консоль уже выводилось «API готов»
- **Причина:** pywebview инициализирует мост асинхронно — объект `pywebview.api` появляется
  раньше, чем к нему прикрепляются методы. `waitForApi` ждал только существования объекта,
  выходил из цикла, и первый вызов `read_settings` падал (гонка была латентной — раньше
  методы обычно успевали прикрепиться за 100 мс полла)
- **Фикс (js/app.js):** `waitForApi` теперь ждёт появления конкретного метода
  `read_settings` (`typeof ... === 'function'`) как маркера готовности моста;
  при долгом ожидании — `console.warn` каждые ~5 сек
- **Проверка:** E2E-регресс с mock гонки (api пустой, методы прикрепляются через 400 мс) —
  9/9 PASS; со старым кодом этот тест падал на первом же шаге (карточки не рендерились)

## Сегмент 19 — Нормализация URL сайтов (клик по ссылке)

- **Симптом:** клик по Site-ссылке открывал URL через локальный сервер pywebview
  (`http://127.0.0.1:PORT/домен`) вместо внешнего сайта
- **Причина:** в БД URL хранились без схемы (`workbook-studio.netlify.app`), браузер
  резолвил их как относительные пути от текущей страницы (локальный сервер pywebview)
- **Фикс:**
  - **js/handlers.js:** новая экспортируемая `normalizeUrl(url)` — добавляет `https://`,
    если схема отсутствует; обрабатывает protocol-relative (`//host` → `https://host`),
    trim и пустые значения; применяется при сохранении site-блока
  - **js/app.js:** `renderSiteField` использует `normalizeUrl` для href и текста ссылки
    (в т.ч. для существующих данных в БД)
- **Проверка:** E2E с URL без схемы — 10/10 PASS (рендер href с `https://`,
  сохранение нормализует); юнит-проверка normalizeUrl — 9/9 кейсов
