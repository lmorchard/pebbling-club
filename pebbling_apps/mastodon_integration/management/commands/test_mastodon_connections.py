from django.core.management.base import BaseCommand
from pebbling_apps.mastodon_integration.tasks import test_mastodon_connections


class Command(BaseCommand):
    help = "Test all Mastodon account connections and disable failed ones"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Testing Mastodon connections..."))

        # Call the task synchronously for immediate execution
        test_mastodon_connections()

        self.stdout.write(self.style.SUCCESS("Mastodon connection testing completed."))
