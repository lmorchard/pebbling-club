import logging
from django.core.management.base import BaseCommand
from pebbling_apps.feeds.tasks import poll_all_feeds

# Set up logging
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Defer the poll_feed tasks for all existing feeds"

    def handle(self, *args, **kwargs):
        poll_all_feeds.delay()  # Defer the task
        logger.info("Successfully deferred poll_feed tasks for all feeds.")
