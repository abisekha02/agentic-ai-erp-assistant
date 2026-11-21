from django.urls import path

from . import views

urlpatterns = [
    path("my/", views.MyLeaveView.as_view()),
    path("requests/", views.LeaveRequestListView.as_view()),
    path("requests/<int:pk>/decision/", views.LeaveDecisionView.as_view()),
]
