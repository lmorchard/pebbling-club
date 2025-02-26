from django.db.models import Q


def filter_bookmarks(queryset, query):
    """Filter bookmarks based on the search query."""
    if query:
        queryset = queryset.filter(
            Q(title__icontains=query)
            | Q(url__icontains=query)
            | Q(description__icontains=query)
            | Q(tags__name__icontains=query)
        ).distinct()
    return queryset
