"""database.py — Слой работы с SQLite

Поля контакта:
  - id         — автоинкрементный первичный ключ
  - name       — имя контакта
  - blocks     — JSON-строка с динамическими блоками (Info/Contact/Site)
  - created_at — дата создания
  - updated_at — дата последнего обновления
"""

import json
import sqlite3
from pathlib import Path


class Database:
    """Управление SQLite-базой контактов"""

    def __init__(self, db_path: str | Path):
        self.db_path = str(db_path)
        self.conn: sqlite3.Connection | None = None

    # ─────────────────────────────────────
    #  Подключение / инициализация
    # ─────────────────────────────────────

    def connect(self) -> None:
        """Открывает соединение и создаёт таблицы, если их нет"""
        # check_same_thread=False — pywebview вызывает API из разных потоков
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_tables()

    def _init_tables(self) -> None:
        """Создаёт таблицу contacts, если она ещё не существует"""
        if not self.conn:
            return
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS contacts (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT    NOT NULL,
                blocks     TEXT    NOT NULL DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.conn.commit()

    def close(self) -> None:
        """Закрывает соединение"""
        if self.conn:
            self.conn.close()
            self.conn = None

    # ─────────────────────────────────────
    #  CRUD
    # ─────────────────────────────────────

    def get_all(self) -> list[dict]:
        """Возвращает все контакты, отсортированные по дате обновления (сначала новые)"""
        if not self.conn:
            return []
        cursor = self.conn.execute("SELECT * FROM contacts ORDER BY updated_at DESC")
        return [_row_to_dict(r) for r in cursor.fetchall()]

    def get_by_id(self, contact_id: int) -> dict | None:
        """Возвращает контакт по ID или None"""
        if not self.conn:
            return None
        cursor = self.conn.execute(
            "SELECT * FROM contacts WHERE id = ?", (contact_id,)
        )
        row = cursor.fetchone()
        return _row_to_dict(row) if row else None

    def save(self, name: str, blocks: list[dict]) -> int:
        """Создаёт новый контакт и возвращает его id"""
        if not self.conn:
            raise RuntimeError("Database not connected")
        cursor = self.conn.execute(
            "INSERT INTO contacts (name, blocks) VALUES (?, ?)",
            (name, json.dumps(blocks, ensure_ascii=False)),
        )
        self.conn.commit()
        return cursor.lastrowid

    def update(self, contact_id: int, name: str, blocks: list[dict]) -> None:
        """Обновляет существующий контакт"""
        if not self.conn:
            raise RuntimeError("Database not connected")
        self.conn.execute(
            "UPDATE contacts SET name = ?, blocks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (name, json.dumps(blocks, ensure_ascii=False), contact_id),
        )
        self.conn.commit()

    def delete(self, contact_id: int) -> None:
        """Удаляет контакт по id"""
        if not self.conn:
            raise RuntimeError("Database not connected")
        self.conn.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
        self.conn.commit()

    def find_by_exact_name(self, name: str) -> dict | None:
        """Ищет контакт с точно таким же именем (без учёта регистра)"""
        if not self.conn:
            return None
        cursor = self.conn.execute(
            "SELECT * FROM contacts WHERE LOWER(name) = LOWER(?)",
            (name,),
        )
        row = cursor.fetchone()
        return _row_to_dict(row) if row else None

    def search(self, query: str) -> list[dict]:
        """Ищет контакты по имени (регистронезависимо)"""
        if not self.conn:
            return []
        cursor = self.conn.execute(
            "SELECT * FROM contacts WHERE name LIKE ? ORDER BY updated_at DESC",
            (f"%{query}%",),
        )
        return [_row_to_dict(r) for r in cursor.fetchall()]

    def count(self) -> int:
        """Возвращает количество контактов в БД"""
        if not self.conn:
            return 0
        cursor = self.conn.execute("SELECT COUNT(*) AS cnt FROM contacts")
        row = cursor.fetchone()
        return row["cnt"] if row else 0


# ─────────────────────────────────────
#  Хелпер
# ─────────────────────────────────────

def _row_to_dict(row: sqlite3.Row) -> dict:
    """Преобразует sqlite3.Row в dict, парся blocks из JSON"""
    d: dict = {
        "id": row["id"],
        "name": row["name"],
        "blocks": json.loads(row["blocks"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
    return d
