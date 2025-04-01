from django.http import Http404
from django.views.generic import ListView
from django.core.paginator import Paginator


class QueryPageListView(ListView):

    def get_paginate_by(self, queryset=None):
        limit = self.request.GET.get("limit", 10)
        return int(limit) if str(limit).isdigit() else 10

    def get_page_number(self):
        page_kwarg = self.page_kwarg
        page = self.kwargs.get(page_kwarg) or self.request.GET.get(page_kwarg) or 1
        try:
            return int(page)
        except ValueError:
            raise Http404(_("Page is not “last”, nor can it be converted to an int."))

    def get_query_page_kwargs(self):
        return {
            "limit": self.get_paginate_by(),
            "page_number": self.get_page_number(),
        }
