from django.urls import path
from .views import (
    profile_edit,
    profile_index,
    ProfileBookmarkListView,
    ProfileTagDetailView,
)

app_name = "profiles"

urlpatterns = [
    path("<str:username>/edit", profile_edit, name="edit"),
    path(
        "<str:username>/t/<str:tag_name>",
        ProfileTagDetailView.as_view(),
        name="tag",
    ),
    path("<str:username>", ProfileBookmarkListView.as_view(), name="view"),
    path("", profile_index, name="index"),
]
