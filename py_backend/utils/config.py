"""config.py — Универсальный менеджер настроек приложения

Полностью агностичен к ключам конфигурации.
Фронтенд сам решает, что хранить в config.json,
а Python просто сохраняет/загружает JSON.
"""

import json

from py_backend.utils.paths import Paths


class Config:
    """Загрузка/сохранение config.json без знания схемы данных"""

    def __init__(self):
        self._path = Paths.config_path("config.json")

    @property
    def path(self) -> str:
        return str(self._path)

    def load(self) -> dict:
        """Возвращает содержимое config.json или пустой словарь"""
        if not self._path.exists():
            return {}
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (json.JSONDecodeError, OSError):
            return {}

    def save(self, data: dict) -> bool:
        """Сохраняет произвольный словарь в config.json"""
        try:
            with open(self._path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except OSError:
            return False
