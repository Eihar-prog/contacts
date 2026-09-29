"""
Точка входа в приложение Contacts
Инициализирует pywebview и запускает веб-интерфейс с локальным сервером
"""

import sys
from pathlib import Path

import webview

from py_backend.api.app_api import AppAPI
from py_backend.utils.paths import Paths

# Корректный вывод кириллицы в консоль Windows
sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]


def setup_webview() -> webview.Window | None:
    """Настройка параметров окна pywebview"""
    api = AppAPI()

    window = webview.create_window(
        title="Contacts — База контактов",
        url=str(Paths.html_path()),
        width=1100,
        height=750,
        min_size=(850, 600),
        background_color="#f4f6f9",
        confirm_close=False,
        js_api=api,
    )

    if not window:
        return None
    api.set_window(window)
    return window


def main() -> None:
    """Основная функция запуска приложения"""
    window = setup_webview()

    if window:
        webview.start(debug=True)
    else:
        print("Ошибка инициализации webview")


if __name__ == "__main__":
    main()
