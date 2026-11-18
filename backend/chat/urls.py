from django.urls import path

from . import views

urlpatterns = [
    path("ask/", views.AskView.as_view()),
    path("conversations/", views.ConversationListView.as_view()),
    path("conversations/<int:pk>/", views.ConversationDetailView.as_view()),
    path("messages/<int:pk>/feedback/", views.FeedbackView.as_view()),
    path("stats/", views.StatsView.as_view()),
    path("actions/<int:pk>/decision/", views.ActionDecisionView.as_view()),
]
