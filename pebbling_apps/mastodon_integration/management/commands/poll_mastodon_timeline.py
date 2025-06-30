from django.core.management.base import BaseCommand, CommandError
from pebbling_apps.mastodon_integration.models import MastodonTimeline
from pebbling_apps.mastodon_integration.tasks import poll_mastodon_timeline


class Command(BaseCommand):
    help = "Manually trigger polling of a specific Mastodon timeline"

    def add_arguments(self, parser):
        parser.add_argument(
            "timeline_id", type=int, help="ID of the Mastodon timeline to poll"
        )

    def handle(self, *args, **options):
        timeline_id = options["timeline_id"]

        try:
            timeline = MastodonTimeline.objects.get(id=timeline_id)
        except MastodonTimeline.DoesNotExist:
            raise CommandError(
                f"Mastodon timeline with ID {timeline_id} does not exist"
            )

        self.stdout.write(
            self.style.SUCCESS(f"Starting polling for timeline: {timeline}")
        )

        # Call the task synchronously for immediate execution
        poll_mastodon_timeline(timeline_id)

        self.stdout.write(
            self.style.SUCCESS(f"Completed polling for timeline: {timeline}")
        )
