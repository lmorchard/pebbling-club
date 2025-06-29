from django.urls import path
from .views import (
    InboxListView,
    InboxItemCreateView,
    mark_item_read,
    mark_item_unread,
    archive_item,
    unarchive_item,
    trash_item,
    add_to_collection,
    add_to_collection_form,
    item_description,
    bulk_mark_read,
    bulk_mark_unread,
    bulk_archive,
    bulk_trash,
    bulk_add_to_collection,
)

app_name = "inbox"

urlpatterns = [
    path("", InboxListView.as_view(), name="list"),
    path("create/", InboxItemCreateView.as_view(), name="create"),
    path("item/<int:item_id>/read/", mark_item_read, name="mark_read"),
    path("item/<int:item_id>/unread/", mark_item_unread, name="mark_unread"),
    path("item/<int:item_id>/archive/", archive_item, name="archive"),
    path("item/<int:item_id>/unarchive/", unarchive_item, name="unarchive"),
    path("item/<int:item_id>/trash/", trash_item, name="trash"),
    path(
        "item/<int:item_id>/add-to-collection/",
        add_to_collection,
        name="add_to_collection",
    ),
    path(
        "item/<int:item_id>/add-form/",
        add_to_collection_form,
        name="add_to_collection_form",
    ),
    path(
        "item/<int:item_id>/description/",
        item_description,
        name="item_description",
    ),
    # Bulk operations
    path("bulk/mark-read/", bulk_mark_read, name="bulk_mark_read"),
    path("bulk/mark-unread/", bulk_mark_unread, name="bulk_mark_unread"),
    path("bulk/archive/", bulk_archive, name="bulk_archive"),
    path("bulk/trash/", bulk_trash, name="bulk_trash"),
    path(
        "bulk/add-to-collection/", bulk_add_to_collection, name="bulk_add_to_collection"
    ),
]
