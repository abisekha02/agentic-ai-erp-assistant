from django.apps import AppConfig


class HrConfig(AppConfig):
    name = "hr"

    def ready(self):
        from . import signals  # noqa: F401
