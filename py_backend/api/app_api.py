"""app_api.py — JS-Python Bridge API

Этот класс регистрируется в pywebview как `window._js_api`,
и все его публичные методы становятся доступны из JavaScript
через `pywebview.api.method_name()`.
"""

import json
import os

import webview

from py_backend.db.database import Database
from py_backend.utils.config import Config
from py_backend.utils.paths import Paths


class AppAPI:
    """API, вызываемый из JS-фронтенда через pywebview bridge"""

    def __init__(self):
        self._db: Database | None = None
        self._window: webview.Window | None = None

    # ── системные методы ──────────────────────────

    def set_window(self, window: webview.Window) -> None:
        """Сохраняет ссылку на окно (нужно для диалогов)"""
        self._window = window

    # ── база данных ────────────────────────────────

    def create_database(self) -> str:
        """Диалог создания нового .db файла → инициализирует БД"""
        if not self._window:
            return json.dumps({"success": False, "error": "Окно не инициализировано"})

        result = self._window.create_file_dialog(
            dialog_type=webview.FileDialog.SAVE,
            file_types=("База данных (*.db)",),
        )

        if not result:
            return json.dumps({"success": False, "error": "Файл не выбран"})

        # pywebview диалоги всегда возвращают tuple
        db_path = result[0]

        try:
            self._db = Database(db_path)
            self._db.connect()  # Создаёт файл и таблицы
            cnt = self._db.count()
            return json.dumps({
                "success": True,
                "path": db_path,
                "count": cnt,
            })
        except Exception as exc:
            return json.dumps({"success": False, "error": str(exc)})

    def open_database(self) -> str:
        """Диалог выбора или создания .db файла → открывает БД"""
        if not self._window:
            return json.dumps({"success": False, "error": "Окно не инициализировано"})

        result = self._window.create_file_dialog(
            dialog_type=webview.FileDialog.OPEN,
            allow_multiple=False,
            file_types=("База данных (*.db)", "Все файлы (*.*)"),
        )

        if not result:
            return json.dumps({"success": False, "error": "Файл не выбран"})

        db_path = result[0]

        # Если файла нет — создаём пустой .db
        if not os.path.exists(db_path):
            open(db_path, "w", encoding="utf-8").close()

        return self._connect_db(db_path)

    def open_database_by_path(self, path: str) -> str:
        """Открывает БД по прямому пути (без диалога) — для автозагрузки"""
        if not os.path.exists(path):
            return json.dumps({"success": False, "error": "Файл не найден"})
        return self._connect_db(path)

    def _connect_db(self, db_path: str) -> str:
        """Внутренний метод: создаёт Database, подключается, возвращает результат"""
        try:
            self._db = Database(db_path)
            self._db.connect()
            cnt = self._db.count()
            return json.dumps({
                "success": True,
                "path": db_path,
                "count": cnt,
            })
        except Exception as exc:
            return json.dumps({"success": False, "error": str(exc)})

    # ── конфиги (contact.json / status.json) ───────

    def load_config(self, name: str) -> str:
        """Возвращает содержимое config/{name}.json"""
        try:
            path = Paths.config_path(f"{name}.json")
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    # ── Настройки приложения ──────────────────────────

    def read_settings(self) -> str:
        """Загружает config.json — возвращает любой JSON-словарь"""
        try:
            config = Config()
            return json.dumps(config.load())
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def write_settings(self, data: str) -> str:
        """Сохраняет config.json — принимает любой JSON-словарь"""
        try:
            payload = json.loads(data)
            config = Config()
            ok = config.save(payload)
            return json.dumps({"success": ok})
        except Exception as exc:
            return json.dumps({"success": False, "error": str(exc)})

    # ── CRUD контактов ─────────────────────────────

    def get_contacts(self) -> str:
        """Возвращает JSON-список всех контактов"""
        if not self._db:
            return json.dumps([])
        try:
            contacts = self._db.get_all()
            return json.dumps(contacts, ensure_ascii=False, default=str)
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def get_contact(self, contact_id: int) -> str:
        """Возвращает контакт по id (для редактирования / инлайн-изменения статуса)"""
        if not self._db:
            return json.dumps({"error": "База данных не открыта"})
        try:
            contact = self._db.get_by_id(contact_id)
            if not contact:
                return json.dumps({"error": "Контакт не найден"})
            return json.dumps(contact, ensure_ascii=False, default=str)
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def save_contact(self, data: str) -> str:
        """Сохраняет новый контакт. data — JSON-строка с полями {name, blocks}"""
        if not self._db:
            return json.dumps({"success": False, "error": "База данных не открыта"})
        try:
            payload = json.loads(data)
            contact_id = self._db.save(
                name=payload["name"],
                blocks=payload.get("blocks", []),
            )
            return json.dumps({"success": True, "id": contact_id})
        except Exception as exc:
            return json.dumps({"success": False, "error": str(exc)})

    def update_contact(self, contact_id: int, data: str) -> str:
        """Обновляет контакт. data — JSON-строка с полями {name, blocks}"""
        if not self._db:
            return json.dumps({"success": False, "error": "База данных не открыта"})
        try:
            payload = json.loads(data)
            self._db.update(contact_id, payload["name"], payload.get("blocks", []))
            return json.dumps({"success": True})
        except Exception as exc:
            return json.dumps({"success": False, "error": str(exc)})

    def delete_contact(self, contact_id: int) -> str:
        """Удаляет контакт по id"""
        if not self._db:
            return json.dumps({"success": False, "error": "База данных не открыта"})
        try:
            self._db.delete(contact_id)
            return json.dumps({"success": True})
        except Exception as exc:
            return json.dumps({"success": False, "error": str(exc)})

    def check_duplicate(self, name: str) -> str:
        """Проверяет, есть ли контакт с точно таким же именем"""
        if not self._db:
            return json.dumps({"exists": False})
        try:
            contact = self._db.find_by_exact_name(name)
            if contact:
                return json.dumps({"exists": True, "contact": contact}, ensure_ascii=False, default=str)
            return json.dumps({"exists": False})
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def search_contacts(self, query: str) -> str:
        """Ищет контакты по имени"""
        if not self._db:
            return json.dumps([])
        try:
            contacts = self._db.search(query)
            return json.dumps(contacts, ensure_ascii=False, default=str)
        except Exception as exc:
            return json.dumps({"error": str(exc)})
