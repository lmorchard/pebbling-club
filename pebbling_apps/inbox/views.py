from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import ListView, CreateView
from django.http import JsonResponse, HttpResponse
from django.contrib import messages
from django.db.models import Q
from django.urls import reverse_lazy
from django.views.decorators.clickjacking import xframe_options_exempt
import bleach
from .models import InboxItem


class InboxListView(LoginRequiredMixin, ListView):
    """Main inbox list view with filtering, sorting, and pagination."""

    model = InboxItem
    template_name = "inbox/inbox_list.html"
    context_object_name = "inbox_items"
    paginate_by = 20

    def get_paginate_by(self, queryset=None):
        """Allow limit parameter to override default pagination."""
        limit = self.request.GET.get("limit", 20)
        return int(limit) if str(limit).isdigit() else 20

    def get_queryset(self):
        """Filter items by current user and apply query parameters."""
        try:
            # Start with user's items
            queryset = InboxItem.objects.filter(owner=self.request.user)

            # Default filter: exclude archived and trashed items (show unread)
            if not self.request.GET.get("show_archived"):
                queryset = queryset.exclude(
                    tags__name="inbox:archived", tags__is_system=True
                )
            if not self.request.GET.get("show_trashed"):
                queryset = queryset.exclude(
                    tags__name="inbox:trashed", tags__is_system=True
                )

            # Apply query parameters
            search = self.request.GET.get("q", "")
            source = self.request.GET.get("source", "")
            tags = self.request.GET.getlist("tags")
            sort = self.request.GET.get("sort", "date")

            # Use the manager's query method
            queryset = InboxItem.objects.query(
                owner=self.request.user,
                search=search if search else None,
                source=source if source else None,
                tags=tags if tags else None,
                sort=sort,
            )

            # Apply the same archive/trash filters to the query result
            if not self.request.GET.get("show_archived"):
                queryset = queryset.exclude(
                    tags__name="inbox:archived", tags__is_system=True
                )
            if not self.request.GET.get("show_trashed"):
                queryset = queryset.exclude(
                    tags__name="inbox:trashed", tags__is_system=True
                )

            return queryset.distinct()

        except Exception as e:
            # Handle invalid query parameters gracefully
            messages.error(self.request, f"Error filtering inbox items: {e}")
            return (
                InboxItem.objects.filter(owner=self.request.user)
                .exclude(
                    tags__name__in=["inbox:archived", "inbox:trashed"],
                    tags__is_system=True,
                )
                .order_by("-created_at")
            )

    def get_context_data(self, **kwargs):
        """Add additional context for the template."""
        context = super().get_context_data(**kwargs)

        # Add search and filter parameters
        context["search_query"] = self.request.GET.get("q", "")
        context["current_source"] = self.request.GET.get("source", "")
        context["current_tags"] = self.request.GET.getlist("tags")
        context["current_sort"] = self.request.GET.get("sort", "date")

        # Get available sources for filtering
        context["available_sources"] = (
            InboxItem.objects.filter(owner=self.request.user)
            .values_list("source", flat=True)
            .distinct()
            .order_by("source")
        )

        # Count unread items (exclude archived and trashed)
        context["unread_count"] = (
            InboxItem.objects.filter(owner=self.request.user)
            .exclude(
                tags__name__in=["inbox:read", "inbox:archived", "inbox:trashed"],
                tags__is_system=True,
            )
            .count()
        )

        return context


@login_required
def mark_item_read(request, item_id):
    """Mark an inbox item as read."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        item = get_object_or_404(InboxItem, id=item_id, owner=request.user)
        item.mark_read()
        messages.success(request, f"'{item.title}' marked as read.")
    except Exception as e:
        logger.error(
            f"Error marking item as read for item_id={item_id}: {e}", exc_info=True
        )
        messages.error(request, "An error occurred while marking the item as read.")

    return redirect("inbox:list")


@login_required
def mark_item_unread(request, item_id):
    """Mark an inbox item as unread."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        item = get_object_or_404(InboxItem, id=item_id, owner=request.user)
        # Remove the read tag
        from pebbling_apps.bookmarks.models import Tag

        read_tag = Tag.objects.filter(
            name="inbox:read", owner=request.user, is_system=True
        ).first()
        if read_tag:
            item.tags.remove(read_tag)
        messages.success(request, f"'{item.title}' marked as unread.")
    except Exception as e:
        messages.error(request, f"Error marking item as unread: {e}")

    return redirect("inbox:list")


@login_required
def archive_item(request, item_id):
    """Archive an inbox item."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        item = get_object_or_404(InboxItem, id=item_id, owner=request.user)
        item.mark_archived()
        messages.success(request, f"'{item.title}' archived.")
    except Exception as e:
        messages.error(request, f"Error archiving item: {e}")

    return redirect("inbox:list")


@login_required
def unarchive_item(request, item_id):
    """Unarchive an inbox item."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        item = get_object_or_404(InboxItem, id=item_id, owner=request.user)
        # Remove the archived tag
        from pebbling_apps.bookmarks.models import Tag

        archived_tag = Tag.objects.filter(
            name="inbox:archived", owner=request.user, is_system=True
        ).first()
        if archived_tag:
            item.tags.remove(archived_tag)
        messages.success(request, f"'{item.title}' unarchived.")
    except Exception as e:
        messages.error(request, f"Error unarchiving item: {e}")

    return redirect("inbox:list")


@login_required
def trash_item(request, item_id):
    """Permanently delete an inbox item."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        item = get_object_or_404(InboxItem, id=item_id, owner=request.user)
        title = item.title
        item.delete()
        messages.success(request, f"'{title}' permanently deleted.")
    except Exception as e:
        messages.error(request, f"Error deleting item: {e}")

    return redirect("inbox:list")


@login_required
def add_to_collection(request, item_id):
    """Add an inbox item directly to the bookmark collection."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        item = get_object_or_404(InboxItem, id=item_id, owner=request.user)

        # Import bookmark model and form
        from pebbling_apps.bookmarks.models import Bookmark

        # Check for existing bookmark with same unique hash
        existing_bookmark = Bookmark.objects.filter(
            owner=request.user, unique_hash=item.unique_hash
        ).first()

        if existing_bookmark:
            # Update existing bookmark with inbox item data
            existing_bookmark.title = item.title
            existing_bookmark.description = item.description
            existing_bookmark.unfurl_metadata = item.unfurl_metadata
            existing_bookmark.feed_url = item.feed_url
            existing_bookmark.save()

            # Copy user tags (exclude system tags)
            user_tags = item.tags.filter(is_system=False)
            for tag in user_tags:
                existing_bookmark.tags.add(tag)

            messages.success(request, f"Updated existing bookmark: '{item.title}'")
            bookmark = existing_bookmark
        else:
            # Create new bookmark
            bookmark = Bookmark.objects.create(
                url=item.url,
                owner=request.user,
                title=item.title,
                description=item.description,
                unfurl_metadata=item.unfurl_metadata,
                feed_url=item.feed_url,
            )

            # Copy user tags (exclude system tags)
            user_tags = item.tags.filter(is_system=False)
            for tag in user_tags:
                bookmark.tags.add(tag)

            messages.success(request, f"Added to collection: '{item.title}'")

        # Optionally archive the inbox item
        item.mark_archived()

    except Exception as e:
        messages.error(request, f"Error adding to collection: {e}")

    return redirect("inbox:list")


@login_required
def add_to_collection_form(request, item_id):
    """Show form to add inbox item to collection with modifications."""
    item = get_object_or_404(InboxItem, id=item_id, owner=request.user)

    from pebbling_apps.bookmarks.forms import BookmarkForm
    from pebbling_apps.bookmarks.models import Bookmark

    if request.method == "POST":
        form = BookmarkForm(request.POST)
        if form.is_valid():
            try:
                # Check for existing bookmark
                existing_bookmark = Bookmark.objects.filter(
                    owner=request.user,
                    unique_hash=Bookmark.objects.generate_unique_hash_for_url(
                        form.cleaned_data["url"]
                    ),
                ).first()

                if existing_bookmark:
                    # Update existing
                    for field in ["title", "description", "url"]:
                        setattr(existing_bookmark, field, form.cleaned_data[field])
                    existing_bookmark.save()

                    # Update tags
                    tag_string = form.cleaned_data.get("tag_string", "")
                    if tag_string:
                        from pebbling_apps.bookmarks.models import Tag

                        tag_names = Tag.objects.parse_tag_string(tag_string)
                        existing_bookmark.tags.clear()
                        for tag_name in tag_names:
                            tag, created = Tag.objects.get_or_create(
                                name=tag_name, owner=request.user
                            )
                            existing_bookmark.tags.add(tag)

                    messages.success(
                        request,
                        f"Updated existing bookmark: '{existing_bookmark.title}'",
                    )
                else:
                    # Create new bookmark
                    bookmark = form.save(commit=False)
                    bookmark.owner = request.user
                    bookmark.save()

                    # Add tags
                    tag_string = form.cleaned_data.get("tag_string", "")
                    if tag_string:
                        from pebbling_apps.bookmarks.models import Tag

                        tag_names = Tag.objects.parse_tag_string(tag_string)
                        for tag_name in tag_names:
                            tag, created = Tag.objects.get_or_create(
                                name=tag_name, owner=request.user
                            )
                            bookmark.tags.add(tag)

                    messages.success(
                        request, f"Added to collection: '{bookmark.title}'"
                    )

                # Archive the inbox item
                item.mark_archived()

                return redirect("inbox:list")

            except Exception as e:
                messages.error(request, f"Error saving bookmark: {e}")
    else:
        # Pre-populate form with inbox item data
        initial_data = {
            "url": item.url,
            "title": item.title,
            "description": item.description,
        }

        # Get user tags as tag string (exclude system tags)
        user_tags = item.tags.filter(is_system=False)
        if user_tags.exists():
            from pebbling_apps.bookmarks.models import Tag

            initial_data["tag_string"] = Tag.objects.tags_to_string(user_tags)

        form = BookmarkForm(initial=initial_data)

    return render(
        request,
        "inbox/add_to_collection_form.html",
        {
            "form": form,
            "item": item,
        },
    )


class InboxItemCreateView(LoginRequiredMixin, CreateView):
    """Create view for manually adding inbox items."""

    model = InboxItem
    form_class = None  # Will be set dynamically
    template_name = "inbox/inbox_item_form.html"
    success_url = reverse_lazy("inbox:list")

    def get_form_class(self):
        """Get the form class dynamically to avoid import issues."""
        from .forms import InboxItemForm

        return InboxItemForm

    def form_valid(self, form):
        """Set the owner to the current user."""
        form.instance.owner = self.request.user
        response = super().form_valid(form)
        messages.success(
            self.request, f"Inbox item '{form.instance.title}' created successfully."
        )
        return response

    def form_invalid(self, form):
        """Handle form validation errors."""
        messages.error(self.request, "Please correct the errors below.")
        return super().form_invalid(form)


# Bulk Operation Views


@login_required
def bulk_mark_read(request):
    """Mark multiple inbox items as read."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        # Get selected item IDs from form data
        selected_items = request.POST.get("selected_items", "")
        if not selected_items:
            messages.error(request, "No items selected.")
            return redirect("inbox:list")

        item_ids = [int(id.strip()) for id in selected_items.split(",") if id.strip()]

        # Get items belonging to the current user
        items = InboxItem.objects.filter(id__in=item_ids, owner=request.user)

        if not items.exists():
            messages.error(request, "No valid items found.")
            return redirect("inbox:list")

        # Add read tag to all items
        from pebbling_apps.bookmarks.models import Tag

        read_tag = Tag.objects.get_or_create_system_tag("inbox:read", request.user)

        count = 0
        for item in items:
            item.tags.add(read_tag)
            count += 1

        messages.success(request, f"Marked {count} items as read.")

    except Exception as e:
        messages.error(request, f"Error marking items as read: {e}")

    return redirect("inbox:list")


@login_required
def bulk_mark_unread(request):
    """Mark multiple inbox items as unread."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        # Get selected item IDs from form data
        selected_items = request.POST.get("selected_items", "")
        if not selected_items:
            messages.error(request, "No items selected.")
            return redirect("inbox:list")

        item_ids = [int(id.strip()) for id in selected_items.split(",") if id.strip()]

        # Get items belonging to the current user
        items = InboxItem.objects.filter(id__in=item_ids, owner=request.user)

        if not items.exists():
            messages.error(request, "No valid items found.")
            return redirect("inbox:list")

        # Remove read tag from all items
        from pebbling_apps.bookmarks.models import Tag

        read_tag = Tag.objects.filter(
            name="inbox:read", owner=request.user, is_system=True
        ).first()

        count = 0
        if read_tag:
            for item in items:
                item.tags.remove(read_tag)
                count += 1

        messages.success(request, f"Marked {count} items as unread.")

    except Exception as e:
        messages.error(request, f"Error marking items as unread: {e}")

    return redirect("inbox:list")


@login_required
def bulk_archive(request):
    """Archive multiple inbox items."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        # Get selected item IDs from form data
        selected_items = request.POST.get("selected_items", "")
        if not selected_items:
            messages.error(request, "No items selected.")
            return redirect("inbox:list")

        item_ids = [int(id.strip()) for id in selected_items.split(",") if id.strip()]

        # Get items belonging to the current user
        items = InboxItem.objects.filter(id__in=item_ids, owner=request.user)

        if not items.exists():
            messages.error(request, "No valid items found.")
            return redirect("inbox:list")

        # Add archived tag to all items
        from pebbling_apps.bookmarks.models import Tag

        archived_tag = Tag.objects.get_or_create_system_tag(
            "inbox:archived", request.user
        )

        count = 0
        for item in items:
            item.tags.add(archived_tag)
            count += 1

        messages.success(request, f"Archived {count} items.")

    except Exception as e:
        messages.error(request, f"Error archiving items: {e}")

    return redirect("inbox:list")


@login_required
def bulk_trash(request):
    """Permanently delete multiple inbox items."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        # Get selected item IDs from form data
        selected_items = request.POST.get("selected_items", "")
        if not selected_items:
            messages.error(request, "No items selected.")
            return redirect("inbox:list")

        item_ids = [int(id.strip()) for id in selected_items.split(",") if id.strip()]

        # Get items belonging to the current user
        items = InboxItem.objects.filter(id__in=item_ids, owner=request.user)

        if not items.exists():
            messages.error(request, "No valid items found.")
            return redirect("inbox:list")

        # Delete items permanently
        count = items.count()
        items.delete()

        messages.success(request, f"Permanently deleted {count} items.")

    except Exception as e:
        messages.error(request, f"Error deleting items: {e}")

    return redirect("inbox:list")


@login_required
def bulk_add_to_collection(request):
    """Add multiple inbox items to the bookmark collection."""
    if request.method != "POST":
        return redirect("inbox:list")

    try:
        # Get selected item IDs from form data
        selected_items = request.POST.get("selected_items", "")
        if not selected_items:
            messages.error(request, "No items selected.")
            return redirect("inbox:list")

        item_ids = [int(id.strip()) for id in selected_items.split(",") if id.strip()]

        # Get items belonging to the current user
        items = InboxItem.objects.filter(id__in=item_ids, owner=request.user)

        if not items.exists():
            messages.error(request, "No valid items found.")
            return redirect("inbox:list")

        # Import bookmark model
        from pebbling_apps.bookmarks.models import Bookmark

        added_count = 0
        updated_count = 0
        error_count = 0

        for item in items:
            try:
                # Check for existing bookmark with same unique hash
                existing_bookmark = Bookmark.objects.filter(
                    owner=request.user, unique_hash=item.unique_hash
                ).first()

                if existing_bookmark:
                    # Update existing bookmark with inbox item data
                    existing_bookmark.title = item.title
                    existing_bookmark.description = item.description
                    existing_bookmark.unfurl_metadata = item.unfurl_metadata
                    existing_bookmark.feed_url = item.feed_url
                    existing_bookmark.save()

                    # Copy user tags (exclude system tags)
                    user_tags = item.tags.filter(is_system=False)
                    for tag in user_tags:
                        existing_bookmark.tags.add(tag)

                    updated_count += 1
                else:
                    # Create new bookmark
                    bookmark = Bookmark.objects.create(
                        url=item.url,
                        owner=request.user,
                        title=item.title,
                        description=item.description,
                        unfurl_metadata=item.unfurl_metadata,
                        feed_url=item.feed_url,
                    )

                    # Copy user tags (exclude system tags)
                    user_tags = item.tags.filter(is_system=False)
                    for tag in user_tags:
                        bookmark.tags.add(tag)

                    added_count += 1

                # Archive the inbox item after successful addition
                item.mark_archived()

            except Exception as e:
                error_count += 1
                print(f"Error processing item {item.id}: {e}")  # For debugging

        # Provide feedback
        if added_count > 0 and updated_count > 0:
            messages.success(
                request,
                f"Added {added_count} new bookmarks and updated {updated_count} existing bookmarks.",
            )
        elif added_count > 0:
            messages.success(request, f"Added {added_count} items to collection.")
        elif updated_count > 0:
            messages.success(request, f"Updated {updated_count} existing bookmarks.")

        if error_count > 0:
            messages.warning(request, f"{error_count} items could not be processed.")

    except Exception as e:
        messages.error(request, f"Error adding items to collection: {e}")

    return redirect("inbox:list")


@login_required
@xframe_options_exempt
def item_description(request, item_id):
    """Serve sanitized HTML description content for iframe rendering."""
    item = get_object_or_404(InboxItem, id=item_id, owner=request.user)

    if not item.description:
        return HttpResponse("", content_type="text/html")

    # Get color scheme from query parameters (set by parent page)
    text_color = request.GET.get("text_color", "#333")
    bg_color = request.GET.get("bg_color", "transparent")
    link_color = request.GET.get("link_color", "#0066cc")

    # Define allowed HTML tags and attributes for descriptions
    allowed_tags = [
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "a",
        "img",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "code",
        "pre",
        "span",
        "div",
    ]

    allowed_attributes = {
        "a": ["href", "title"],
        "img": ["src", "alt", "title", "width", "height"],
        "span": ["class"],
        "div": ["class"],
    }

    # Sanitize the HTML
    clean_html = bleach.clean(
        item.description, tags=allowed_tags, attributes=allowed_attributes, strip=True
    )

    # Create a minimal HTML document with some basic styling
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.5;
                color: {text_color};
                margin: 8px;
                padding: 0;
                background: {bg_color};
            }}
            a {{
                color: {link_color};
                text-decoration: none;
            }}
            a:hover {{
                text-decoration: underline;
            }}
            img {{
                max-width: 100%;
                height: auto;
            }}
            p {{
                margin: 0.5em 0;
            }}
            pre, code {{
                background-color: rgba(128, 128, 128, 0.1);
                padding: 2px 4px;
                border-radius: 3px;
                font-family: monospace;
            }}
            pre {{
                padding: 8px;
                overflow-x: auto;
            }}
            blockquote {{
                border-left: 3px solid {text_color};
                margin: 0.5em 0;
                padding-left: 1em;
                opacity: 0.7;
            }}
        </style>
    </head>
    <body>
        {clean_html}
    </body>
    </html>
    """

    return HttpResponse(html_content, content_type="text/html")
