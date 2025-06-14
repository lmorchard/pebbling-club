def shift_refresh(request):
    """
    Context processor that detects if the page was loaded with shift-refresh.
    Adds 'force_refresh' variable to the template context.
    """
    cache_control = request.META.get("HTTP_CACHE_CONTROL", "").lower()
    force_refresh = "no-cache" in cache_control

    return {"force_refresh": force_refresh}
