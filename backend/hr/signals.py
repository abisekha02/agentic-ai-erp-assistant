from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import LeaveBalance


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_balance(sender, instance, created, **kwargs):
    if created:
        LeaveBalance.objects.get_or_create(user=instance)
