from django.urls import path

from .views import feeds_fetch_get, feeds_fetch_post

app_name = "feeds"

urlpatterns = [
    path("get", feeds_fetch_get, name="fetch_get"),
    path("get", feeds_fetch_post, name="fetch_post"),
]
