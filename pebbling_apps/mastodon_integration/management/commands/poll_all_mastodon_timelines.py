from django.core.management.base import BaseCommand
from pebbling_apps.mastodon_integration.tasks import poll_all_mastodon_timelines


class Command(BaseCommand):
    help = "Manually trigger polling of all active Mastodon timelines"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting Mastodon timeline polling..."))

        # Call the task synchronously for immediate execution
        poll_all_mastodon_timelines()

        self.stdout.write(
            self.style.SUCCESS("Mastodon timeline polling tasks have been scheduled.")
        )
