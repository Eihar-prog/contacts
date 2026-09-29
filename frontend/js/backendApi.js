/* ============================================
   backendApi.js — Единый слой связи с Python-бэкендом

   Все вызовы к pywebview.api.* сосредоточены здесь.
   Каждый метод вызывает pywebview.api явно и напрямую.
   ============================================ */

/**
 * Проверка доступности pywebview bridge
 */
function getBackendApi() {
  const api = globalThis.pywebview?.api;
  if (!api) {
    throw new Error('pywebview API is not available yet.');
  }
  return api;
}

// ============================================
// Публичное API
// ============================================

const BackendApi = {
  // ── База данных ──────────────────────────

  /** Создать новую .db (диалог сохранения) */
  async createDatabase() {
    if (!getBackendApi()) return null;
    try {
      var result = await getBackendApi().create_database();
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в create_database:', err);
      return null;
    }
  },

  /** Открыть существующий .db файл (диалог открытия) */
  async openDatabase() {
    if (!getBackendApi()) return null;
    try {
      var result = await getBackendApi().open_database();
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в open_database:', err);
      return null;
    }
  },

  /** Открыть БД по прямому пути (без диалога) — для автозагрузки */
  async openDatabaseByPath(path) {
    if (!getBackendApi()) return null;
    try {
      var result = await getBackendApi().open_database_by_path(path);
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в open_database_by_path:', err);
      return null;
    }
  },

  // ── Конфиги ──────────────────────────────

  /** Загрузить JSON-конфиг (contact.json / status.json) */
  async loadConfig(name) {
    if (!getBackendApi()) return null;
    try {
      var result = await getBackendApi().load_config(name);
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в load_config:', err);
      return null;
    }
  },

  // ── CRUD ─────────────────────────────────

  /** Получить все контакты */
  async getContacts() {
    if (!getBackendApi()) return [];
    try {
      var result = await getBackendApi().get_contacts();
      result = typeof result === 'string' ? JSON.parse(result) : result;
      return Array.isArray(result) ? result : [];
    } catch (err) {
      console.error('[BackendApi] Ошибка в get_contacts:', err);
      return [];
    }
  },

  /** Сохранить новый контакт { name, blocks } */
  async saveContact(contact) {
    if (!getBackendApi()) return null;
    try {
      var result = await getBackendApi().save_contact(JSON.stringify(contact));
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в save_contact:', err);
      return null;
    }
  },

  /** Получить контакт по id */
  async getContact(id) {
    try {
      if (!getBackendApi()) return null;
      var result = await getBackendApi().get_contact(id);
      result = typeof result === 'string' ? JSON.parse(result) : result;
      if (!result || result.error) {
        console.error('[BackendApi] Ошибка в get_contact:', result && result.error);
        return null;
      }
      return result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в get_contact:', err);
      return null;
    }
  },

  /** Проверить, есть ли контакт с таким именем */
  async checkDuplicate(name) {
    if (!getBackendApi()) return null;
    try {
      var result = await getBackendApi().check_duplicate(name);
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в check_duplicate:', err);
      return null;
    }
  },

  /** Обновить контакт по id { name, blocks } */
  async updateContact(id, contact) {
    if (!getBackendApi()) return null;
    try {
      var result = await getBackendApi().update_contact(
        id,
        JSON.stringify(contact),
      );
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в update_contact:', err);
      return null;
    }
  },

  /** Удалить контакт по id */
  async deleteContact(id) {
    if (!getBackendApi()) return null;
    try {
      var result = await getBackendApi().delete_contact(id);
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в delete_contact:', err);
      return null;
    }
  },

  /** Поиск контактов по имени */
  async searchContacts(query) {
    if (!getBackendApi()) return [];
    try {
      var result = await getBackendApi().search_contacts(query);
      result = typeof result === 'string' ? JSON.parse(result) : result;
      return Array.isArray(result) ? result : [];
    } catch (err) {
      console.error('[BackendApi] Ошибка в search_contacts:', err);
      return [];
    }
  },

  // ── Настройки приложения ──────────────────

  /** Загрузить config.json */
  async loadSettings() {
    if (!getBackendApi()) return null;
    try {
      var result = await getBackendApi().read_settings();
      console.log(result);
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в read_settings:', err);
      return null;
    }
  },

  /** Сохранить config.json (принимает любой объект) */
  async saveSettings(settings) {
    if (!getBackendApi()) return null;
    try {
      var result = await getBackendApi().write_settings(
        JSON.stringify(settings),
      );
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (err) {
      console.error('[BackendApi] Ошибка в write_settings:', err);
      return null;
    }
  },

  // ── Утилиты ──────────────────────────────

  /** Проверить, запущено ли приложение в pywebview */
  // isDesktop() {
  //   return isAvailable();
  // },
};

export default BackendApi;
