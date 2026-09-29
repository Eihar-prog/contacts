/* ============================================
   handlers.js — Обработчики событий
   ============================================ */

import BackendApi from './backendApi.js';

/**
 * Нормализация URL сайта: добавляет https://, если схема отсутствует.
 * Без схемы браузер резолвит ссылку относительно текущей страницы —
 * в pywebview это локальный сервер (http://127.0.0.1:PORT/...).
 */
export function normalizeUrl(url) {
  var u = String(url || '').trim();
  if (!u) return '';
  // Protocol-relative (//example.com) — добавляем схему
  if (u.indexOf('//') === 0) return 'https:' + u;
  // Схема уже есть (http://, https://, mailto: и т.п.) — не трогаем
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  return 'https://' + u;
}

/**
 * Привязка всех событий приложения
 * @param {Object} dom     — кэш DOM-элементов
 * @param {Object} state   — состояние приложения
 * @param {Object} actions — функции для вызова (addBlock, deleteBlock, switchTab, saveContact,
 *                           handleContactTypeChange, handleSubtypeChange, startEditContact,
 *                           copyFieldValue, startStatusEdit, confirmStatusEdit, resetForm)
 */
export function bindEvents(dom, state, actions) {

  // --- Навигация страниц ---
  dom.sidebarBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      // Возврат на «Создать контакт» во время редактирования — сброс формы
      if (btn.dataset.tab === 'create' && state.editingId && actions.resetForm) {
        actions.resetForm();
      }
      actions.switchTab(btn.dataset.tab, dom);
    });
  });

  // --- Кнопки добавления блоков ---
  dom.addButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      actions.addBlock(btn.dataset.add, dom, state);
    });
  });

  // --- Удаление блоков (делегирование) ---
  dom.blocksContainer.addEventListener('click', function (e) {
    var deleteBtn = e.target.closest('.block__delete');
    if (deleteBtn) {
      var block = deleteBtn.closest('.block');
      if (block) actions.deleteBlock(block);
    }
  });

  // --- Изменение типа контакта / подтипа (делегирование) ---
  dom.blocksContainer.addEventListener('change', function (e) {
    var typeSelect = e.target.closest('.contact-type-select');
    if (typeSelect) {
      actions.handleContactTypeChange(typeSelect, state, actions);
      return;
    }
    var subtypeSelect = e.target.closest('.contact-subtype-select');
    if (subtypeSelect) {
      actions.handleSubtypeChange(subtypeSelect, state);
    }
  });

  // --- События на карточках контактов (делегирование) ---
  if (dom.cardsContainer) {
    dom.cardsContainer.addEventListener('click', function (e) {
      // Кнопка редактирования контакта (карандаш)
      var editBtn = e.target.closest('.card__btn--edit');
      if (editBtn && actions.startEditContact) {
        var editCard = editBtn.closest('.card');
        if (editCard) actions.startEditContact(editCard.dataset.id);
        return;
      }

      // Кнопка удаления контакта
      var deleteBtn = e.target.closest('.card__btn--delete');
      if (deleteBtn && actions.showDeleteModal) {
        var card = deleteBtn.closest('.card');
        if (card) {
          actions.showDeleteModal(card.dataset.id, card.dataset.name);
        }
        return;
      }

      // Кнопка копирования значения
      var copyBtn = e.target.closest('.card__copy-btn');
      if (copyBtn && actions.copyFieldValue) {
        actions.copyFieldValue(copyBtn);
        return;
      }

      // Кнопка подтверждения смены статуса (галочка)
      var statusConfirm = e.target.closest('.card__status-confirm');
      if (statusConfirm && actions.confirmStatusEdit) {
        actions.confirmStatusEdit();
        return;
      }

      // Кнопка сворачивания/разворачивания Info
      var toggleBtn = e.target.closest('.card__info-toggle');
      if (toggleBtn) {
        var field = toggleBtn.closest('.card__field--info');
        if (!field) return;

        var isExpanded = toggleBtn.dataset.action === 'collapse';
        var valueEl = field.querySelector('.card__field-value');

        if (isExpanded) {
          // Свернуть
          field.classList.remove('card__field--expanded');
          field.classList.add('card__field--collapsed');
          valueEl.classList.remove('card__field-value--expanded');
          valueEl.classList.add('card__field-value--collapsed');
          toggleBtn.textContent = '+';
          toggleBtn.dataset.action = 'expand';
          toggleBtn.title = 'Развернуть';
        } else {
          // Развернуть
          field.classList.remove('card__field--collapsed');
          field.classList.add('card__field--expanded');
          valueEl.classList.remove('card__field-value--collapsed');
          valueEl.classList.add('card__field-value--expanded');
          toggleBtn.textContent = '−';
          toggleBtn.dataset.action = 'collapse';
          toggleBtn.title = 'Свернуть';
        }
        return;
      }
    });

    // Двойной клик по статусу — инлайн-редактирование
    dom.cardsContainer.addEventListener('dblclick', function (e) {
      var statusEl = e.target.closest('.card__field-status');
      if (statusEl && actions.startStatusEdit) {
        actions.startStatusEdit(statusEl);
      }
    });
  }

  // --- Сохранение ---
  dom.btnSave.addEventListener('click', function () {
    actions.saveContact(dom, state, actions);
  });
}


/**
 * Переключение вкладок
 */
export function switchTab(tabId, dom) {
  dom.sidebarBtns.forEach(function (btn) {
    var isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('sidebar__btn--active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });

  Object.keys(dom.tabContents).forEach(function (key) {
    var el = dom.tabContents[key];
    el.classList.toggle('tab-content--active', key === tabId);
  });
}


/**
 * Удаление блока с анимацией
 */
export function deleteBlock(block) {
  block.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
  block.style.opacity = '0';
  block.style.transform = 'translateY(-4px)';

  setTimeout(function () {
    if (block.parentNode) {
      block.parentNode.removeChild(block);
    }
  }, 150);
}


/**
 * Обработчик изменения типа контакта (показ/скрытие подтипов)
 */
export function handleContactTypeChange(select, state, actions) {
  var block = select.closest('.block--contact');
  if (!block) return;

  var selectedId = select.value;
  var subtypeContainer = block.querySelector('.contact-subtype');
  var valueInput = block.querySelector('.contact-value-input');

  var selectedType = null;
  state.contactTypes.forEach(function (t) {
    if (t.id === selectedId) selectedType = t;
  });
  if (!selectedType) return;

  if (valueInput) {
    valueInput.placeholder = selectedType.placeholder || 'Введите значение...';
    valueInput.value = '';
  }

  if (selectedType.hasSubtypes && selectedType.subtypes) {
    subtypeContainer.style.display = 'block';
    var subtypeSelect = subtypeContainer.querySelector('.contact-subtype-select');
    if (subtypeSelect) {
      subtypeSelect.innerHTML = '';
      selectedType.subtypes.forEach(function (sub) {
        var option = document.createElement('option');
        option.value = sub.id;
        option.textContent = (sub.icon || '') + ' ' + sub.label;
        subtypeSelect.appendChild(option);
      });
      // Обновить placeholder при первом показе
      actions.handleSubtypeChange(subtypeSelect, state);
    }
  } else {
    subtypeContainer.style.display = 'none';
  }
}


/**
 * Обработчик изменения подтипа (для соцсетей)
 */
export function handleSubtypeChange(select, state) {
  var block = select.closest('.block--contact');
  if (!block) return;

  var selectedSubId = select.value;
  var valueInput = block.querySelector('.contact-value-input');
  var parentTypeSelect = block.querySelector('.contact-type-select');
  var parentTypeId = parentTypeSelect ? parentTypeSelect.value : null;

  var parentType = null;
  state.contactTypes.forEach(function (t) {
    if (t.id === parentTypeId) parentType = t;
  });

  if (parentType && parentType.subtypes) {
    var selectedSub = null;
    parentType.subtypes.forEach(function (sub) {
      if (sub.id === selectedSubId) selectedSub = sub;
    });
    if (selectedSub && valueInput) {
      valueInput.placeholder = selectedSub.placeholder || 'Введите значение...';
      valueInput.value = '';
    }
  }
}


/**
 * Сохранение контакта:
 * - в режиме редактирования (state.editingId) — обновление с проверкой
 *   дубликата по имени (кроме самого контакта)
 * - в режиме создания — проверка дубликата + диалог, если найден
 */
export async function saveContact(dom, state, actions) {
  var name = dom.contactName.value.trim();

  if (!name) {
    dom.contactName.focus();
    dom.contactName.style.borderColor = 'var(--color-danger)';
    setTimeout(function () {
      dom.contactName.style.borderColor = '';
    }, 1200);
    return;
  }

  var blocks = [];
  var blockElements = dom.blocksContainer.querySelectorAll('.block');

  blockElements.forEach(function (block) {
    var type = block.dataset.blockType;
    var blockData = { type: type };

    switch (type) {
      case 'info':
        blockData.title = (block.querySelector('.info-title').value || '').trim();
        blockData.content = (block.querySelector('.info-content').value || '').trim();
        break;

      case 'contact':
        blockData.contactType = block.querySelector('.contact-type-select').value;
        blockData.value = (block.querySelector('.contact-value-input').value || '').trim();
        blockData.status = block.querySelector('.contact-status-select').value;

        var subtypeContainer = block.querySelector('.contact-subtype');
        if (subtypeContainer.style.display !== 'none') {
          var s = subtypeContainer.querySelector('.contact-subtype-select');
          if (s) blockData.subtype = s.value;
        }
        break;

      case 'site':
        blockData.url = normalizeUrl(block.querySelector('.site-url').value);
        break;
    }

    blocks.push(blockData);
  });

  // Сортируем блоки: Info → Contact → Site
  var typeOrder = { info: 0, contact: 1, site: 2 };
  blocks.sort(function (a, b) {
    return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
  });

  var formData = { name: name, blocks: blocks };

  // ── Режим редактирования ──────────────────────────
  if (state.editingId) {
    var dupEdit = await BackendApi.checkDuplicate(name);
    if (dupEdit && dupEdit.exists && dupEdit.contact && dupEdit.contact.id !== state.editingId) {
      alert('Контакт с именем "' + name + '" уже существует в базе.');
      return;
    }
    if (actions && actions.doSaveContact) {
      await actions.doSaveContact(formData);
    }
    return;
  }

  // ── Режим создания ────────────────────────────────
  var dup = await BackendApi.checkDuplicate(name);

  if (dup && dup.exists && actions && actions.showDuplicateModal) {
    // Дубликат найден — показываем диалог
    var existingId = dup.contact ? dup.contact.id : null;
    actions.showDuplicateModal(name, formData, existingId);
  } else {
    // Нет дубликата — сохраняем сразу
    if (actions && actions.doSaveContact) {
      await actions.doSaveContact(formData);
    }
  }
}
