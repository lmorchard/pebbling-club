from celery import group
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from pebbling_apps.common.utils import parse_since
from pebbling_apps.feeds.tasks import poll_feed
from pebbling_apps.feeds.services import FeedService
from pebbling_apps.feeds.models import Feed
import logging
import json

logger = logging.getLogger(__name__)


@require_GET
def feeds_fetch_get(request):
    since = parse_since(request.GET.get("since"))
    urls = request.GET.getlist("urls")
    per_feed_limit = None
    if request.GET.get("per_feed_limit"):
        try:
            per_feed_limit = int(request.GET.get("per_feed_limit"))
        except (ValueError, TypeError):
            pass

    feeds = Feed.objects.filter(url__in=urls)
    feeds_by_url = get_feed_items_by_url(feeds, since, per_feed_limit=per_feed_limit)
    return JsonResponse(feeds_by_url)


@csrf_exempt
@login_required
@require_POST
def feeds_fetch_post(request):
    # TODO: switch to Django Rest Framework for request parsing
    body = json.loads(request.body)
    since = parse_since(body.get("since"))
    urls = body.get("urls", [])
    per_feed_limit = None
    if "per_feed_limit" in body:
        try:
            per_feed_limit = int(body.get("per_feed_limit"))
        except (ValueError, TypeError):
            pass

    service = FeedService()

    feed_ids = []
    tasks = []

    # First create all feeds and collect task signatures
    for url in urls:
        try:
            feed, created = service.get_or_create_feed(url)
            feed_ids.append(feed.id)
            tasks.append(poll_feed.s(feed.id).set(priority=3))
        except Exception as e:
            continue

    # Create a group of tasks and execute them
    if tasks:
        job = group(tasks)
        result = job.apply_async(priority=3)
        # Wait for all tasks to complete with timeout
        try:
            result.get(timeout=30)  # Wait up to 30 seconds
        except Exception as e:
            # Log error but continue - we'll still return the feeds
            logger.error(f"Error waiting for feed poll tasks: {e}")

    feeds = Feed.objects.filter(id__in=feed_ids)
    feeds_by_url = get_feed_items_by_url(feeds, since, per_feed_limit=per_feed_limit)

    return JsonResponse(feeds_by_url)


def get_feed_items_by_url(feeds, since=None, per_feed_limit=100):
    """
    Returns feeds by URL with their items, filtered by date if since is provided.

    Args:
        urls (list): List of feed URLs to fetch
        since (datetime, optional): Only include items newer than this date
        limit (int, optional): Maximum number of items to include per feed
        feed_ids (list, optional): List of feed IDs to filter by instead of URLs

    Returns:
        dict: Dictionary mapping feed URLs to their data
    """
    if since:
        feeds = feeds.filter(newest_item_date__gte=since)

    feeds_by_url = {}
    for feed in feeds:
        # First determine which items to include
        items_query = feed.items
        if since:
            items_query = items_query.filter(date__gte=since)

        # Get the most recent items (limited by the limit parameter)
        items = items_query.order_by("-date")[:per_feed_limit]

        # Build the response dictionary
        feeds_by_url[feed.url] = {
            "success": True,
            "fetched": {
                "items": [item.to_dict() for item in items],
                **feed.to_dict(),
            },
        }

    return feeds_by_url
