from django.urls import path
from .views import profile_view

app_name = "profiles"

urlpatterns = [
    path("profile/", profile_view, name="profile"),
]
