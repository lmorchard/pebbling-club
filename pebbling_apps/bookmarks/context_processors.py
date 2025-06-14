from .views import BookmarkAttachmentNames
import logging
from typing import List


logger = logging.getLogger(__name__)


DEFAULT_OPEN_ATTACHMENT = BookmarkAttachmentNames.NOTES.value

DEFAULT_SHOW_ATTACHMENTS = [
    BookmarkAttachmentNames[name].value for name in ["NOTES", "FEED", "UNFURL"]
]


def bookmark_context(request):
    context = {
        "BookmarkAttachmentNames": BookmarkAttachmentNames,
    }

    valid_attachmennt_names = [item.value for item in BookmarkAttachmentNames]

    show_param = request.GET.get("show") or ""
    show_list = [
        item for item in show_param.split(",") if item in valid_attachmennt_names
    ]
    if not show_list:
        show_list = DEFAULT_SHOW_ATTACHMENTS
    context["show_attachments"] = show_list

    open_param = request.GET.get("open") or DEFAULT_OPEN_ATTACHMENT
    if open_param not in show_list:
        open_param = show_list[0]
    if open_param in valid_attachmennt_names:
        context["open_attachment"] = open_param

    return context
