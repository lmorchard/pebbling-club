from celery import group
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from pebbling_apps.feeds.tasks import poll_feed
from pebbling_apps.feeds.services import FeedService
from pebbling_apps.feeds.models import Feed
import logging
import json

logger = logging.getLogger(__name__)


# TODO: rework this so that only POST does actual writes and polls and updates - get should just fetch what's there
@require_GET
def feeds_fetch_get(request):
    urls = request.GET.getlist("urls")
    feeds = Feed.objects.filter(url__in=urls)

    feeds_by_url = dict()
    for feed in feeds:
        feeds_by_url[feed.url] = dict(
            success=True,
            fetched=dict(
                items=[i.to_dict() for i in feed.items.order_by("-date")[:10]],
                **feed.to_dict(),
            ),
        )

    return JsonResponse(feeds_by_url)


@csrf_exempt
@login_required
@require_POST
def feeds_fetch_post(request):
    # TODO: switch to Django Rest Framework for request parsing
    urls = json.loads(request.body).get("urls", [])
    service = FeedService()

    feed_ids = []
    tasks = []

    # First create all feeds and collect task signatures
    for url in urls:
        try:
            feed, created = service.get_or_create_feed(url)
            feed_ids.append(feed.id)
            tasks.append(poll_feed.s(feed.id))
        except Exception as e:
            continue

    # Create a group of tasks and execute them
    if tasks:
        job = group(tasks)
        result = job.apply_async(priority=0)
        # Wait for all tasks to complete with timeout
        try:
            result.get(timeout=30)  # Wait up to 30 seconds
        except Exception as e:
            # Log error but continue - we'll still return the feeds
            logger.error(f"Error waiting for feed poll tasks: {e}")

    # Re-fetch feeds to get updated data
    feeds = Feed.objects.filter(id__in=feed_ids)

    feeds_by_url = dict()
    for feed in feeds:
        feeds_by_url[feed.url] = dict(
            success=True,
            fetched=dict(
                items=[i.to_dict() for i in feed.items.order_by("-date")[:10]],
                **feed.to_dict(),
            ),
        )

    return JsonResponse(feeds_by_url)
