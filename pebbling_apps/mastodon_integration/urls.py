from django.urls import path
from . import views

app_name = "mastodon_integration"

urlpatterns = [
    # Settings and management
    path("settings/", views.MastodonSettingsView.as_view(), name="settings"),
    path("monitoring/", views.TimelineMonitoringView.as_view(), name="monitoring"),
    path(
        "accounts/<int:account_id>/disconnect/",
        views.disconnect_account,
        name="disconnect_account",
    ),
    path(
        "accounts/<int:account_id>/reenable/",
        views.reenable_account,
        name="reenable_account",
    ),
    path(
        "accounts/<int:account_id>/reauthenticate/",
        views.reauthenticate_account,
        name="reauthenticate_account",
    ),
    # Timeline management
    path(
        "accounts/<int:account_id>/timelines/",
        views.AccountTimelinesView.as_view(),
        name="account_timelines",
    ),
    path(
        "accounts/<int:account_id>/timelines/add/",
        views.AddTimelineView.as_view(),
        name="add_timeline",
    ),
    path(
        "accounts/<int:account_id>/lists/",
        views.fetch_mastodon_lists,
        name="fetch_lists",
    ),
    path(
        "timelines/<int:timeline_id>/edit/",
        views.EditTimelineView.as_view(),
        name="edit_timeline",
    ),
    path(
        "timelines/<int:timeline_id>/toggle/",
        views.toggle_timeline,
        name="toggle_timeline",
    ),
    path(
        "timelines/<int:timeline_id>/test/",
        views.test_timeline_connection,
        name="test_timeline",
    ),
    path(
        "timelines/<int:timeline_id>/delete/",
        views.delete_timeline,
        name="delete_timeline",
    ),
    # Server validation and connection
    path("connect/", views.MastodonConnectView.as_view(), name="connect"),
    path("validate-server/", views.validate_server, name="validate_server"),
    path("initiate-oauth/", views.initiate_oauth, name="initiate_oauth"),
    path("oauth/callback/", views.oauth_callback, name="oauth_callback"),
]
