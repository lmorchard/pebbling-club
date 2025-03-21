from .views import BookmarkAttachmentNames
import logging


logger = logging.getLogger(__name__)


DEFAULT_OPEN_ATTACHMENT = "notes"
DEFAULT_SHOW_ATTACHMENTS = ["notes", "feed", "unfurl"]


def bookmark_context(request):
    context = {
        "BookmarkAttachmentNames": BookmarkAttachmentNames.__members__,
    }

    open_param = request.GET.get("open") or DEFAULT_OPEN_ATTACHMENT
    if open_param in BookmarkAttachmentNames._value2member_map_:
        context["open_attachment"] = open_param

    show_param = request.GET.get("show") or ""
    show_list = show_param.split(",")
    valid_show_list = [
        item for item in show_list if item in BookmarkAttachmentNames._value2member_map_
    ]
    if not valid_show_list:
        valid_show_list = DEFAULT_SHOW_ATTACHMENTS
    context["show_attachments"] = valid_show_list

    return context
