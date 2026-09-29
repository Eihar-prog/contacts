/* ============================================
   app.js — Главный модуль приложения
   Импортирует обработчики из handlers.js
   ============================================ */

import BackendApi from './backendApi.js';

import {
  bindEvents,
  deleteBlock,
  handleContactTypeChange,
  handleSubtypeChange,
  normalizeUrl,
  saveContact,
  switchTab,
} from './handlers.js';

// Иконка «копировать» (inline SVG, переиспользуется в карточках)
const COPY_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>' +
  '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>' +
  '</svg>';

// ==========================================
// Состояние приложения
// ==========================================
const state = {
  contactTypes: [],
  statuses: [],
  blockCounter: 0,
  viewMode: 'grid',
  editingId: null, // id контакта в режиме редактирования (null — создание)
};

// Активный инлайн-редактор статуса на карточке (или null)
let statusEditor = null;

// ==========================================
// Кэш DOM-элементов
// ==========================================
const dom = {};

function cacheDom() {
  dom.sidebarBtns = document.querySelectorAll('[data-tab]');
  dom.tabContents = {
    create: document.getElementById('tabCreate'),
    view: document.getElementById('tabView'),
  };
  dom.blocksContainer = document.getElementById('blocksContainer');
  dom.addButtons = document.querySelectorAll('[data-add]');
  dom.btnSave = document.getElementById('btnSave');
  dom.btnCancelEdit = document.getElementById('btnCancelEdit');
  dom.formTitle = document.querySelector('.create-form__title');
  dom.contactName = document.getElementById('contactName');
  dom.cardsContainer = document.getElementById('cardsContainer');
  dom.searchInput = document.getElementById('searchInput');
  dom.viewToggle = document.getElementById('viewToggle');
  dom.statusDot = document.querySelector('.footer__status-dot');
  dom.statusText = document.querySelector('.footer__status span:last-child');

  // Модальное окно удаления
  dom.modalDelete = document.getElementById('modalDelete');
  dom.modalDeleteName = document.getElementById('modalDeleteName');
  dom.modalConfirm = document.getElementById('modalConfirm');
  dom.modalCancel = document.getElementById('modalCancel');

  // Модальное окно дубликата
  dom.modalDuplicate = document.getElementById('modalDuplicate');
  dom.modalDuplicateName = document.getElementById('modalDuplicateName');
  dom.dupCancel = document.getElementById('dupCancel');
  dom.dupKeepBoth = document.getElementById('dupKeepBoth');
  dom.dupReplace = document.getElementById('dupReplace');
}

// ==========================================
// Настройки приложения (загрузка/сохранение)
// ==========================================

/**
 * Загружает config.json и применяет настройки:
 * - viewMode — режим просмотра (grid/list)
 * - dbPath — автозагрузка последней БД
 */
async function restoreSettings() {
  var settings = await BackendApi.loadSettings();
  if (!settings) return;

  // Применяем режим просмотра (если сохранён)
  if (settings.viewMode) {
    state.viewMode = settings.viewMode;
    // Обновляем кнопку переключателя, если рендер уже есть
    if (dom.viewToggle) {
      var buttons = dom.viewToggle.querySelectorAll('.view-toggle__btn');
      buttons.forEach(function (btn) {
        btn.classList.toggle(
          'view-toggle__btn--active',
          btn.dataset.view === settings.viewMode,
        );
      });
    }
    // Класс на контейнере применится после рендера карточек
  }

  // Авто-открываем последнюю БД
  if (settings.dbPath) {
    var result = await BackendApi.openDatabaseByPath(settings.dbPath);
    if (result && result.success) {
      state.dbPath = result.path;
      updateFooterStatus('База: ' + result.path.split(/[/\\\\]/).pop(), true);
      await updateContactList();
      updateContactCounter(result.count || 0);

      // После рендера применяем режим просмотра на контейнере
      if (state.viewMode === 'list' && dom.cardsContainer) {
        dom.cardsContainer.classList.add('cards--list');
      }
    }
  }
}

/**
 * Сохраняет частичные настройки (сливает с существующими)
 */
async function saveSettings(partialData) {
  var existing = (await BackendApi.loadSettings()) || {};
  var merged = Object.assign({}, existing, partialData);
  await BackendApi.saveSettings(merged);
}

// ==========================================
// Переключение режима просмотра
// ==========================================
function setViewMode(mode) {
  state.viewMode = mode;

  // Обновляем активную кнопку
  var buttons = dom.viewToggle.querySelectorAll('.view-toggle__btn');
  buttons.forEach(function (btn) {
    btn.classList.toggle('view-toggle__btn--active', btn.dataset.view === mode);
  });

  // Переключаем класс на контейнере карточек
  dom.cardsContainer.classList.toggle('cards--list', mode === 'list');

  // Сохраняем настройку
  saveSettings({ viewMode: mode });
}

// ==========================================
// Загрузка JSON-конфигов
// ==========================================
async function loadConfigs() {
  try {
    var [contactResp, statusResp] = await Promise.all([
      fetch('config/contact.json'),
      fetch('config/status.json'),
    ]);

    if (!contactResp.ok || !statusResp.ok) {
      throw new Error('Ошибка загрузки конфигов');
    }

    var contactData = await contactResp.json();
    var statusData = await statusResp.json();

    state.contactTypes = contactData.types || [];
    state.statuses = statusData.statuses || [];

    updateFooterStatus('Конфиги загружены', true);
  } catch (err) {
    console.warn('[Contacts] Не удалось загрузить конфиги:', err.message);
    updateFooterStatus('Ошибка загрузки', false);
  }
}

// ==========================================
// Добавление блока
// ==========================================
function addBlock(type, dom, state) {
  state.blockCounter++;

  switch (type) {
    case 'info':
      dom.blocksContainer.appendChild(createInfoBlock());
      break;
    case 'contact':
      dom.blocksContainer.appendChild(createContactBlock());
      break;
    case 'site':
      dom.blocksContainer.appendChild(createSiteBlock());
      break;
  }
}

// ---------- Info ----------
function createInfoBlock(data) {
  var block = document.createElement('div');
  block.className = 'block block--info';
  block.dataset.blockType = 'info';
  block.dataset.blockId = 'info-' + state.blockCounter;

  var title = data && data.title ? data.title : '';
  var content = data && data.content ? data.content : '';

  block.innerHTML =
    '<div class="block__header">' +
    '<span class="block__label"><span class="block__label-icon">ℹ️</span>INFO</span>' +
    '<button class="block__delete" title="Удалить блок">−</button>' +
    '</div>' +
    '<div class="block__body">' +
    '<div class="field">' +
    '<label class="field__label">Название</label>' +
    '<input type="text" class="field__input info-title" placeholder="Например: О канале, заметка..." value="' +
    escapeAttr(title) +
    '">' +
    '</div>' +
    '<div class="field">' +
    '<label class="field__label">Текст</label>' +
    '<textarea class="field__textarea info-content" placeholder="Подробное описание..." rows="3">' +
    escapeHtml(content) +
    '</textarea>' +
    '</div>' +
    '</div>';

  animateIn(block);
  return block;
}

// ---------- Contact ----------
function createContactBlock(data) {
  var block = document.createElement('div');
  block.className = 'block block--contact';
  block.dataset.blockType = 'contact';
  block.dataset.blockId = 'contact-' + state.blockCounter;

  var selectedTypeId =
    data && data.contactType
      ? data.contactType
      : state.contactTypes[0]
        ? state.contactTypes[0].id
        : '';

  var typeOptions = '';
  state.contactTypes.forEach(function (t) {
    var selected = t.id === selectedTypeId ? ' selected' : '';
    typeOptions +=
      '<option value="' +
      escapeAttr(t.id) +
      '"' +
      selected +
      '>' +
      (t.icon || '') +
      ' ' +
      escapeHtml(t.label) +
      '</option>';
  });

  var statusOptions = '<option value="">— Не выбран</option>';
  state.statuses.forEach(function (s) {
    var selected = data && data.status === s.id ? ' selected' : '';
    statusOptions +=
      '<option value="' +
      escapeAttr(s.id) +
      '"' +
      selected +
      '>' +
      escapeHtml(s.label) +
      '</option>';
  });

  var placeholder = getTypePlaceholder(selectedTypeId, data && data.subtype);
  var value = data && data.value ? data.value : '';

  block.innerHTML =
    '<div class="block__header">' +
    '<span class="block__label"><span class="block__label-icon">📞</span>CONTACT</span>' +
    '<button class="block__delete" title="Удалить блок">−</button>' +
    '</div>' +
    '<div class="block__body">' +
    '<div class="contact-row">' +
    '<div class="field field--type">' +
    '<label class="field__label">Тип</label>' +
    '<select class="field__select contact-type-select">' +
    typeOptions +
    '</select>' +
    '</div>' +
    '<div class="field field--value">' +
    '<label class="field__label">Значение</label>' +
    '<input type="text" class="field__input contact-value-input" placeholder="' +
    escapeAttr(placeholder) +
    '" value="' +
    escapeAttr(value) +
    '">' +
    '</div>' +
    '<div class="field field--status">' +
    '<label class="field__label">Статус</label>' +
    '<select class="field__select contact-status-select">' +
    statusOptions +
    '</select>' +
    '</div>' +
    '</div>' +
    '<div class="contact-subtype" style="display:none;">' +
    '<div class="field">' +
    '<label class="field__label">Платформа</label>' +
    '<select class="field__select contact-subtype-select"></select>' +
    '</div>' +
    '</div>' +
    '</div>';

  // Если у контакта есть подтип (соцсеть) — показываем и заполняем его
  if (data && data.subtype) {
    var subtypeContainer = block.querySelector('.contact-subtype');
    subtypeContainer.style.display = 'block';
    fillSubtypeSelect(block, data.subtype);
  }

  animateIn(block);
  return block;
}

/** Заполняет селект подтипов (для соцсетей) и подставляет placeholder */
function fillSubtypeSelect(block, selectedSubId) {
  var typeSelect = block.querySelector('.contact-type-select');
  var subtypeSelect = block.querySelector('.contact-subtype-select');
  var valueInput = block.querySelector('.contact-value-input');
  if (!typeSelect || !subtypeSelect) return;

  var parentType = null;
  state.contactTypes.forEach(function (t) {
    if (t.id === typeSelect.value) parentType = t;
  });

  subtypeSelect.innerHTML = '';
  if (!parentType || !parentType.subtypes) return;

  parentType.subtypes.forEach(function (sub) {
    var opt = document.createElement('option');
    opt.value = sub.id;
    opt.textContent = (sub.icon || '') + ' ' + sub.label;
    if (sub.id === selectedSubId) opt.selected = true;
    subtypeSelect.appendChild(opt);
  });

  if (valueInput) {
    var selectedSub = null;
    parentType.subtypes.forEach(function (sub) {
      if (sub.id === selectedSubId) selectedSub = sub;
    });
    valueInput.placeholder = selectedSub
      ? selectedSub.placeholder || 'Введите значение...'
      : 'Введите значение...';
  }
}

// ---------- Site ----------
function createSiteBlock(data) {
  var block = document.createElement('div');
  block.className = 'block block--site';
  block.dataset.blockType = 'site';
  block.dataset.blockId = 'site-' + state.blockCounter;

  var url = data && data.url ? data.url : '';

  block.innerHTML =
    '<div class="block__header">' +
    '<span class="block__label"><span class="block__label-icon">🔗</span>SITE</span>' +
    '<button class="block__delete" title="Удалить блок">−</button>' +
    '</div>' +
    '<div class="block__body">' +
    '<div class="field">' +
    '<label class="field__label">URL</label>' +
    '<input type="text" class="field__input site-url" placeholder="https://example.com" value="' +
    escapeAttr(url) +
    '">' +
    '</div>' +
    '</div>';

  animateIn(block);
  return block;
}

/**
 * Возвращает placeholder для типа контакта (с учётом подтипа)
 */
function getTypePlaceholder(typeId, subtypeId) {
  var placeholder = 'Введите значение...';
  if (!typeId) return placeholder;

  state.contactTypes.forEach(function (t) {
    if (t.id !== typeId) return;
    placeholder = t.placeholder || placeholder;
    if (subtypeId && t.subtypes) {
      t.subtypes.forEach(function (sub) {
        if (sub.id === subtypeId) placeholder = sub.placeholder || placeholder;
      });
    }
  });
  return placeholder;
}

// ==========================================
// Анимация появления блока
// ==========================================
function animateIn(block) {
  requestAnimationFrame(function () {
    block.style.opacity = '0';
    block.style.transform = 'translateY(-6px)';
    block.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    requestAnimationFrame(function () {
      block.style.opacity = '1';
      block.style.transform = 'translateY(0)';
    });
  });
}

// ==========================================
// Форма: создание / редактирование
// ==========================================

/** Сброс формы к чистому состоянию (режим «Новый контакт») */
function resetForm() {
  state.editingId = null;
  if (statusEditor) cancelStatusEdit();

  dom.contactName.value = '';
  dom.blocksContainer.innerHTML = '';

  if (dom.formTitle) {
    dom.formTitle.textContent = 'Новый контакт';
    dom.formTitle.classList.remove('create-form__title--edit');
  }
  if (dom.btnSave) dom.btnSave.textContent = '💾 Сохранить контакт';
  if (dom.btnCancelEdit) dom.btnCancelEdit.classList.remove('is-visible');
}

/**
 * Заполняет форму данными контакта (режим редактирования)
 */
function loadContactIntoForm(contact) {
  resetForm();

  state.editingId = contact.id;
  dom.contactName.value = contact.name || '';

  (contact.blocks || []).forEach(function (block) {
    state.blockCounter++;
    var el = null;
    switch (block.type) {
      case 'info':
        el = createInfoBlock(block);
        break;
      case 'contact':
        el = createContactBlock(block);
        break;
      case 'site':
        el = createSiteBlock(block);
        break;
    }
    if (el) dom.blocksContainer.appendChild(el);
  });

  if (dom.formTitle) {
    dom.formTitle.textContent = 'Редактирование контакта';
    dom.formTitle.classList.add('create-form__title--edit');
  }
  if (dom.btnSave) dom.btnSave.textContent = '💾 Сохранить изменения';
  if (dom.btnCancelEdit) dom.btnCancelEdit.classList.add('is-visible');
}

/** Начать редактирование контакта по клику на «карандаш» */
async function startEditContact(id) {
  var contact = await BackendApi.getContact(id);
  if (!contact) {
    console.warn('[Contacts] Не удалось загрузить контакт для редактирования:', id);
    return;
  }
  loadContactIntoForm(contact);
  switchTab('create', dom);
}

/** Выйти из режима редактирования (кнопка «Отмена») */
function cancelEdit() {
  resetForm();
  switchTab('view', dom);
}

// ==========================================
// Обновление статуса в подвале
// ==========================================
function updateFooterStatus(text, isActive) {
  if (dom.statusText) dom.statusText.textContent = text;
  if (dom.statusDot) {
    dom.statusDot.classList.toggle('footer__status-dot--inactive', !isActive);
  }
}

// ==========================================
// Создать БД
// ==========================================
async function handleCreateDatabase() {
  var result = await BackendApi.createDatabase();

  if (result && result.success) {
    state.dbPath = result.path;
    updateFooterStatus('База: ' + result.path.split(/[/\\\\]/).pop(), true);

    // Показываем пустой список (updateContactList сам обновит счётчик)
    await updateContactList();

    // Сохраняем путь к БД в настройки
    saveSettings({ dbPath: result.path });

    // Переключаемся на вкладку просмотра
    switchTab('view', dom);
  } else {
    var errMsg =
      result && result.error ? result.error : 'Отменено пользователем';
    if (errMsg !== 'Файл не выбран') {
      console.warn('[Contacts] Ошибка создания БД:', errMsg);
    }
  }
}

// ==========================================
// Открыть БД
// ==========================================
async function handleOpenDatabase() {
  var result = await BackendApi.openDatabase();

  if (result && result.success) {
    state.dbPath = result.path;
    updateFooterStatus('База: ' + result.path.split(/[/\\\\]/).pop(), true);

    // Обновляем счётчик в сайдбаре
    updateContactCounter(result.count || 0);

    // Загружаем список контактов
    await updateContactList();

    // Сохраняем путь к БД в настройки
    saveSettings({ dbPath: result.path });

    // Переключаемся на вкладку просмотра
    switchTab('view', dom);
  } else {
    var errMsg =
      result && result.error ? result.error : 'Отменено пользователем';
    if (errMsg !== 'Файл не выбран') {
      console.warn('[Contacts] Ошибка открытия БД:', errMsg);
    }
  }
}

// ==========================================
// Обновление списка контактов (карточки)
// ==========================================
async function updateContactList() {
  var contacts = await BackendApi.getContacts();

  if (!dom.cardsContainer) return;

  // Обновляем счётчик
  updateContactCounter(contacts.length);

  if (contacts.length === 0) {
    // Показываем пустое состояние
    dom.cardsContainer.innerHTML =
      '<div class="cards__empty">' +
      '<span class="cards__empty-icon">📭</span>' +
      '<p>Контактов пока нет</p>' +
      '<p class="cards__empty-hint">Создайте первый контакт на вкладке «Создать контакт»</p>' +
      '</div>';
    return;
  }

  // Рендерим карточки
  var html = '';
  contacts.forEach(function (c) {
    html += renderContactCard(c);
  });

  dom.cardsContainer.innerHTML = html;
}

// ==========================================
// Рендер карточки контакта
// ==========================================

/**
 * Рендер одной карточки контакта со всеми блоками
 */
function renderContactCard(c) {
  var blocksHtml = '';
  if (c.blocks && c.blocks.length > 0) {
    c.blocks.forEach(function (block, index) {
      blocksHtml += renderBlockField(block, index);
    });
  }

  return (
    '<div class="card" data-id="' +
    c.id +
    '" data-name="' +
    escapeAttr(c.name) +
    '">' +
    '<div class="card__header">' +
    '<div class="card__avatar">' +
    escapeHtml(c.name.charAt(0).toUpperCase()) +
    '</div>' +
    '<div class="card__name">' +
    escapeHtml(c.name) +
    '</div>' +
    '<div class="card__actions">' +
    '<button class="card__btn card__btn--edit" title="Редактировать">✏️</button>' +
    '<button class="card__btn card__btn--delete" title="Удалить">🗑️</button>' +
    '</div>' +
    '</div>' +
    (blocksHtml ? '<div class="card__body">' + blocksHtml + '</div>' : '') +
    '<div class="card__meta">' +
    '<span>' +
    formatDate(c.created_at) +
    '</span>' +
    '</div>' +
    '</div>'
  );
}

/**
 * Рендер одного блока внутри карточки
 */
function renderBlockField(block, index) {
  switch (block.type) {
    case 'info':
      return renderInfoField(block, index);
    case 'contact':
      return renderContactField(block, index);
    case 'site':
      return renderSiteField(block, index);
    default:
      return '';
  }
}

/**
 * Рендер Info-блока (сворачиваемый + кнопка копирования)
 */
function renderInfoField(block, index) {
  var title = block.title || 'Заметка';
  var content = block.content || '';
  var hasContent = content.length > 0;

  // Если нет содержимого — показываем без сворачивания и без кнопки копирования
  if (!hasContent) {
    return (
      '<div class="card__field card__field--info">' +
      '<span class="card__field-icon">ℹ️</span>' +
      '<span class="card__field-label">' +
      escapeHtml(title) +
      '</span>' +
      '<span class="card__field-value">—</span>' +
      '</div>'
    );
  }

  var copyBtn =
    '<button class="card__copy-btn" data-block-index="' +
    index +
    '" title="Скопировать">' +
    COPY_ICON +
    '</button>';

  return (
    '<div class="card__field card__field--info card__field--collapsed">' +
    '<span class="card__field-icon">ℹ️</span>' +
    '<span class="card__field-label">' +
    escapeHtml(title) +
    '</span>' +
    '<span class="card__field-value card__field-value--collapsed">' +
    escapeHtml(content) +
    '</span>' +
    copyBtn +
    '<button class="card__info-toggle" data-action="expand" title="Развернуть">+</button>' +
    '</div>'
  );
}

/**
 * Рендер Contact-блока (значение + копирование + инлайн-статус)
 */
function renderContactField(block, index) {
  // Ищем тип контакта из конфига
  var icon = '📞';
  var label = block.contactType || '';
  state.contactTypes.forEach(function (t) {
    if (t.id === block.contactType) {
      icon = t.icon || icon;
      label = t.label || label;

      // Если есть подтип — уточняем иконку и название
      if (block.subtype && t.subtypes) {
        t.subtypes.forEach(function (sub) {
          if (sub.id === block.subtype) {
            icon = sub.icon || icon;
            label = sub.label || label;
          }
        });
      }
    }
  });

  // Статус — всегда показываем (пустой тоже, чтобы можно было задать по месту)
  var statusLabel = '—';
  var statusClass = 'card__field-status--empty';
  state.statuses.forEach(function (s) {
    if (s.id === block.status) {
      statusLabel = s.label;
      statusClass = s.cssClass || '';
    }
  });
  // Пустой статус: label из конфига + пунктирный бейдж-подсказка
  if (!block.status) {
    state.statuses.forEach(function (s) {
      if (s.id === '') statusLabel = s.label;
    });
    statusClass = 'card__field-status--empty';
  }
  var statusHtml =
    '<span class="card__field-status ' +
    statusClass +
    '" data-block-index="' +
    index +
    '" data-status="' +
    escapeAttr(block.status || '') +
    '" title="Двойной клик — изменить статус">' +
    escapeHtml(statusLabel) +
    '</span>';

  return (
    '<div class="card__field">' +
    '<span class="card__field-icon">' +
    icon +
    '</span>' +
    '<span class="card__field-label">' +
    escapeHtml(label) +
    '</span>' +
    '<span class="card__field-value">' +
    escapeHtml(block.value || '') +
    '</span>' +
    '<button class="card__copy-btn" data-block-index="' +
    index +
    '" title="Скопировать">' +
    COPY_ICON +
    '</button>' +
    statusHtml +
    '</div>'
  );
}

/**
 * Рендер Site-блока (кликабельная ссылка + копирование)
 */
function renderSiteField(block, index) {
  var url = normalizeUrl(block.url);
  var valueHtml = url
    ? '<a class="card__field-link" href="' +
      escapeAttr(url) +
      '" target="_blank" rel="noopener">' +
      escapeHtml(url) +
      '</a>'
    : '<span class="card__field-value">—</span>';

  return (
    '<div class="card__field">' +
    '<span class="card__field-icon">🔗</span>' +
    '<span class="card__field-label">Site</span>' +
    valueHtml +
    '<button class="card__copy-btn" data-block-index="' +
    index +
    '" title="Скопировать URL">' +
    COPY_ICON +
    '</button>' +
    '</div>'
  );
}

// Публикуем функцию для handlers.js (вызывается после сохранения)
dom.updateContactList = updateContactList;

// ==========================================
// Модальное окно подтверждения удаления
// ==========================================
var pendingDeleteId = null;

function showDeleteModal(id, name) {
  pendingDeleteId = id;
  dom.modalDeleteName.textContent = name;
  dom.modalDelete.classList.add('modal-overlay--open');
}

function hideDeleteModal() {
  pendingDeleteId = null;
  dom.modalDelete.classList.remove('modal-overlay--open');
}

async function confirmDeleteContact() {
  if (!pendingDeleteId) return;
  var id = pendingDeleteId;
  hideDeleteModal();

  var result = await BackendApi.deleteContact(id);
  if (result && result.success) {
    await updateContactList();
  } else {
    var errMsg = result && result.error ? result.error : 'Ошибка удаления';
    console.warn('[Contacts] Ошибка удаления:', errMsg);
  }
}

// ==========================================
// Модальное окно обнаружения дубликата
// ==========================================
var pendingDuplicateName = null;
var pendingDuplicateData = null;

function showDuplicateModal(name, formData, existingId) {
  pendingDuplicateName = name;
  pendingDuplicateData = formData;
  pendingDuplicateData._existingId = existingId;
  dom.modalDuplicateName.textContent = name;
  dom.modalDuplicate.classList.add('modal-overlay--open');
}

function hideDuplicateModal() {
  pendingDuplicateName = null;
  pendingDuplicateData = null;
  dom.modalDuplicate.classList.remove('modal-overlay--open');
}

/** Оставить оба — создать новый контакт */
async function confirmDuplicateKeepBoth() {
  var data = pendingDuplicateData;
  hideDuplicateModal();
  await doSaveContact(data);
}

/** Заменить — удалить старый и создать новый */
async function confirmDuplicateReplace() {
  var data = pendingDuplicateData;
  hideDuplicateModal();

  // Удаляем существующий контакт (ID сохранён при показе модалки)
  if (data._existingId) {
    await BackendApi.deleteContact(data._existingId);
  }
  // Сохраняем новый
  await doSaveContact(data);
}

/**
 * Фактическое сохранение: создание или обновление
 * (ветвление по state.editingId)
 */
async function doSaveContact(data) {
  var wasEditing = !!state.editingId;

  var result = wasEditing
    ? await BackendApi.updateContact(state.editingId, data)
    : await BackendApi.saveContact(data);

  if (result && result.success) {
    alert(
      'Контакт "' + data.name + '" ' + (wasEditing ? 'обновлён' : 'сохранён') + '!',
    );
    resetForm();
    await updateContactList();
    // После редактирования возвращаемся к списку
    if (wasEditing) switchTab('view', dom);
  } else {
    var errMsg = result && result.error ? result.error : 'Бэкенд недоступен';
    alert('Ошибка сохранения: ' + errMsg);
  }
}

// ==========================================
// Копирование значений с карточки
// ==========================================

/**
 * Копирует текст в буфер обмена:
 * pywebview → navigator.clipboard → execCommand (fallback)
 */
async function copyToClipboard(text) {
  try {
    if (
      globalThis.pywebview &&
      globalThis.pywebview.clipboard &&
      typeof globalThis.pywebview.clipboard.set === 'function'
    ) {
      await globalThis.pywebview.clipboard.set(text);
      return true;
    }
  } catch (err) {}

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {}

  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (err) {
    return false;
  }
}

/** Копирование значения поля карточки по кнопке */
async function copyFieldValue(btn) {
  var field = btn.closest('.card__field');
  if (!field) return;

  var valueEl = field.querySelector('.card__field-value, .card__field-link');
  var text = valueEl ? valueEl.textContent : '';
  if (!text) return;

  var ok = await copyToClipboard(text);
  if (!ok) return;

  if (!btn.dataset.original) btn.dataset.original = btn.innerHTML;
  btn.classList.add('card__copy-btn--copied');
  btn.innerHTML = '✓';
  setTimeout(function () {
    btn.classList.remove('card__copy-btn--copied');
    btn.innerHTML = btn.dataset.original || '';
  }, 1200);
}

// ==========================================
// Инлайн-редактирование статуса на карточке
// ==========================================

/** Начать редактирование статуса (двойной клик по бейджу) */
function startStatusEdit(statusEl) {
  if (statusEditor) cancelStatusEdit();

  var card = statusEl.closest('.card');
  if (!card) return;

  var index = statusEl.dataset.blockIndex;
  var current = statusEl.dataset.status || '';

  var select = document.createElement('select');
  select.className = 'card__status-select';
  state.statuses.forEach(function (s) {
    var opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    if (s.id === current) opt.selected = true;
    select.appendChild(opt);
  });

  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'card__status-confirm';
  confirmBtn.textContent = '✓';
  confirmBtn.title = 'Сохранить статус';

  var editor = document.createElement('span');
  editor.className = 'card__status-editor';
  editor.appendChild(select);
  editor.appendChild(confirmBtn);

  statusEditor = {
    card: card,
    index: index,
    original: statusEl.outerHTML,
  };
  statusEl.replaceWith(editor);
  select.focus();
}

/** Восстанавливает исходный бейдж статуса вместо инлайн-редактора */
function restoreStatusBadge(originalHtml) {
  var editor = document.querySelector('.card__status-editor');
  if (editor && originalHtml) {
    editor.outerHTML = originalHtml;
  }
}

/** Отменить инлайн-редактирование статуса (восстановить бейдж) */
function cancelStatusEdit() {
  if (!statusEditor) return;
  restoreStatusBadge(statusEditor.original);
  statusEditor = null;
}

/** Подтвердить новый статус и сохранить в БД */
async function confirmStatusEdit() {
  if (!statusEditor) return;

  var editor = document.querySelector('.card__status-editor');
  var select = editor ? editor.querySelector('.card__status-select') : null;
  if (!select) {
    statusEditor = null;
    await updateContactList();
    return;
  }

  var newStatus = select.value;
  var cardId = statusEditor.card.dataset.id;
  var index = parseInt(statusEditor.index, 10);
  var original = statusEditor.original;
  statusEditor = null;

  var contact = await BackendApi.getContact(cardId);
  if (!contact) {
    // Не удалось загрузить контакт — восстанавливаем бейдж, не трогая список
    restoreStatusBadge(original);
    return;
  }

  if (
    contact.blocks &&
    contact.blocks[index] &&
    contact.blocks[index].type === 'contact'
  ) {
    contact.blocks[index].status = newStatus;
    var result = await BackendApi.updateContact(cardId, {
      name: contact.name,
      blocks: contact.blocks,
    });
    if (!(result && result.success)) {
      var errMsg = result && result.error ? result.error : 'Ошибка обновления';
      console.warn('[Contacts] Ошибка обновления статуса:', errMsg);
    }
  }

  // Перерисовываем список (закрывает редактор и показывает новый статус)
  await updateContactList();
}

// ==========================================
// Обновление счётчика в сайдбаре
// ==========================================
function updateContactCounter(count) {
  var counter = document.querySelector('.sidebar__counter');
  if (counter) {
    counter.textContent = count;
  }
}

// ==========================================
// Утилиты
// ==========================================

/** Экранирование HTML-спецсимволов */
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/** Экранирование для HTML-атрибутов */
function escapeAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Форматирование даты */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ==========================================
// Инициализация (запускается сразу после загрузки DOM)
// ==========================================
async function init() {
  cacheDom();

  var actions = {
    addBlock: addBlock,
    deleteBlock: deleteBlock,
    switchTab: switchTab,
    saveContact: saveContact,
    handleContactTypeChange: handleContactTypeChange,
    handleSubtypeChange: handleSubtypeChange,
    showDeleteModal: showDeleteModal,
    showDuplicateModal: showDuplicateModal,
    doSaveContact: doSaveContact,
    startEditContact: startEditContact,
    resetForm: resetForm,
    copyFieldValue: copyFieldValue,
    startStatusEdit: startStatusEdit,
    confirmStatusEdit: confirmStatusEdit,
  };

  // Сначала регистрируем обработчики — они не зависят от pywebview
  bindEvents(dom, state, actions);
  await loadConfigs();

  // Вешаем обработчики на кнопки БД
  var btnCreateDb = document.getElementById('btnCreateDb');
  if (btnCreateDb) {
    btnCreateDb.addEventListener('click', handleCreateDatabase);
  }

  var btnOpenDb = document.getElementById('btnOpenDb');
  if (btnOpenDb) {
    btnOpenDb.addEventListener('click', handleOpenDatabase);
  }

  // Кнопка «Отмена» редактирования
  if (dom.btnCancelEdit) {
    dom.btnCancelEdit.addEventListener('click', cancelEdit);
  }

  // Модальное окно удаления
  dom.modalCancel.addEventListener('click', hideDeleteModal);
  dom.modalConfirm.addEventListener('click', confirmDeleteContact);
  dom.modalDelete.addEventListener('click', function (e) {
    if (e.target === dom.modalDelete) hideDeleteModal();
  });

  // Модальное окно дубликата
  dom.dupCancel.addEventListener('click', hideDuplicateModal);
  dom.dupKeepBoth.addEventListener('click', confirmDuplicateKeepBoth);
  dom.dupReplace.addEventListener('click', confirmDuplicateReplace);
  dom.modalDuplicate.addEventListener('click', function (e) {
    if (e.target === dom.modalDuplicate) hideDuplicateModal();
  });

  // Переключатель вида (сетка/список)
  if (dom.viewToggle) {
    dom.viewToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.view-toggle__btn');
      if (!btn) return;
      var view = btn.dataset.view;
      if (view === state.viewMode) return;
      setViewMode(view);
    });
  }

  // Клик вне инлайн-редактора статуса — закрыть его
  document.addEventListener('click', function (e) {
    if (statusEditor && !e.target.closest('.card__status-editor')) {
      cancelStatusEdit();
    }
  });

  // Закрытие по Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (statusEditor) {
        cancelStatusEdit();
        return;
      }
      hideDeleteModal();
      hideDuplicateModal();
    }
  });
}

async function waitForApi() {
  // pywebview подгружает мост асинхронно: объект pywebview.api может появиться
  // раньше, чем к нему прикрепятся методы. Ждём именно появления метода
  // read_settings (маркер готовности) — иначе restoreSettings падает с
  // «read_settings is not a function».
  var attempts = 0;
  while (
    !globalThis.pywebview?.api ||
    typeof globalThis.pywebview.api.read_settings !== 'function'
  ) {
    attempts++;
    if (attempts % 50 === 0) {
      console.warn('[Contacts] Ожидание методов pywebview.api...');
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log('API готов');
  await restoreSettings();
}

// ==========================================
// Старт
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // init() дожидается загрузки конфигов — автозагрузку БД и рендер карточек
  // запускаем только после неё, чтобы статусы/типы отображались корректно
  await init();
  waitForApi();
});
