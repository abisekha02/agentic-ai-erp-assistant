from django.contrib import admin

from .models import LeaveBalance, LeaveRequest

admin.site.register(LeaveBalance)
admin.site.register(LeaveRequest)
