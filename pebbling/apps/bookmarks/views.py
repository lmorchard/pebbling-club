from django.contrib.auth.decorators import login_required
from django.urls import reverse_lazy
from django.shortcuts import render, get_object_or_404
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.core.exceptions import PermissionDenied
from .models import Bookmark, Tag
from .forms import BookmarkForm


# List View: Show all bookmarks for the logged-in user
class BookmarkListView(ListView):
    model = Bookmark
    template_name = "bookmarks/bookmark_list.html"
    context_object_name = "bookmarks"
    paginate_by = 10

    def get_queryset(self):
        return Bookmark.objects.filter(owner=self.request.user).order_by("-created_at")


# Create View: Add a new bookmark
class BookmarkCreateView(CreateView):
    model = Bookmark
    template_name = "bookmarks/bookmark_form.html"
    form_class = BookmarkForm
    success_url = reverse_lazy("bookmarks:list")

    def get_initial(self):
        """Pre-populate form with query parameters or existing bookmark data."""
        initial = super().get_initial()

        # Get URL from query parameters
        url = self.request.GET.get("url", "")
        if url:
            # Check for existing bookmark with this URL
            self.existing_bookmark = Bookmark.objects.filter(
                owner=self.request.user,
                unique_hash=Bookmark.objects.generate_unique_hash_for_url(url),
            ).first()

            if self.existing_bookmark:
                # Use existing bookmark data
                initial.update(
                    {
                        "url": self.existing_bookmark.url,
                        "title": self.existing_bookmark.title,
                        "description": self.existing_bookmark.description,
                        "tags": " ".join(
                            tag.name for tag in self.existing_bookmark.tags.all()
                        ),
                    }
                )
                return initial

        # If no existing bookmark found, use query parameters
        initial.update(
            {
                "url": url,
                "title": self.request.GET.get("title", ""),
                "description": self.request.GET.get("description", ""),
                "tags": self.request.GET.get("tags", ""),
            }
        )
        return initial

    def get_context_data(self, **kwargs):
        """Add existing bookmark info to context if found."""
        context = super().get_context_data(**kwargs)
        if hasattr(self, "existing_bookmark"):
            context["existing_bookmark"] = self.existing_bookmark
        return context

    def get_form_kwargs(self):
        """Pass the current user to the form."""
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.owner = self.request.user
        return super().form_valid(form)


class BookmarkUpdateView(UpdateView):
    model = Bookmark
    form_class = BookmarkForm
    template_name = "bookmarks/bookmark_form.html"
    success_url = reverse_lazy("bookmarks:list")

    def get_form_kwargs(self):
        """Pass the current user to the form."""
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def get_object(self, queryset=None):
        bookmark = super().get_object(queryset)
        if bookmark.owner != self.request.user:
            raise PermissionDenied  # Prevent unauthorized editing
        return bookmark


class BookmarkDeleteView(DeleteView):
    model = Bookmark
    template_name = "bookmarks/bookmark_confirm_delete.html"
    success_url = reverse_lazy("bookmarks:list")

    def get_object(self, queryset=None):
        bookmark = super().get_object(queryset)
        if bookmark.owner != self.request.user:
            raise PermissionDenied  # Prevent unauthorized deletion
        return bookmark


# View to show all tags belonging to the user
class TagListView(ListView):
    model = Tag
    template_name = "bookmarks/tag_list.html"
    context_object_name = "tags"
    paginate_by = 10

    def get_queryset(self):
        """Return tags only for the logged-in user."""
        return Tag.objects.filter(owner=self.request.user).order_by("name")


# View to show all bookmarks associated with a specific tag
class TagDetailView(ListView):
    model = Bookmark
    template_name = "bookmarks/tag_detail.html"
    context_object_name = "bookmarks"
    paginate_by = 10

    def get_queryset(self):
        """Return all bookmarks linked to a specific tag."""
        self.tag = get_object_or_404(
            Tag, name=self.kwargs["tag_name"], owner=self.request.user
        )
        return self.tag.bookmarks.all().order_by("-created_at")

    def get_context_data(self, **kwargs):
        """Pass the tag object to the template for display."""
        context = super().get_context_data(**kwargs)
        context["tag"] = self.tag
        return context
