"""paths.py — Утилита для разрешения путей проекта

Все пути вычисляются относительно корня проекта (где лежит run.py).
Это гарантирует корректную работу независимо от того, откуда запущен скрипт.
"""

from pathlib import Path


class Paths:
    """Статический класс-утилита для путей проекта"""

    _project_root: Path | None = None

    @classmethod
    def _get_root(cls) -> Path:
        """Определяет корень проекта (директория run.py)"""
        if cls._project_root is None:
            # Путь к этому файлу: .../py_backend/utils/paths.py
            # Поднимаемся на 2 уровня вверх → корень проекта
            cls._project_root = Path(__file__).resolve().parent.parent.parent
        return cls._project_root

    @classmethod
    def frontend_dir(cls) -> Path:
        """frontend/"""
        return cls._get_root() / "frontend"

    @classmethod
    def config_dir(cls) -> Path:
        """frontend/config/"""
        return cls.frontend_dir() / "config"

    @classmethod
    def html_path(cls) -> Path:
        """frontend/index.html"""
        return cls.frontend_dir() / "index.html"

    @classmethod
    def config_path(cls, filename: str) -> Path:
        """Путь к конфигу в frontend/config/{filename}"""
        return cls.config_dir() / filename

    @classmethod
    def root(cls) -> Path:
        """Корень проекта"""
        return cls._get_root()
