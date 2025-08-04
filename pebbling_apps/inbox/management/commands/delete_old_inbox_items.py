from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone
from pebbling_apps.inbox.models import InboxItem

User = get_user_model()


class Command(BaseCommand):
    help = """Delete old inbox items for a user.
    
    Examples:
        python manage.py delete_old_inbox_items --user testuser
        python manage.py delete_old_inbox_items --user testuser --hours 48
        python manage.py delete_old_inbox_items --user testuser --days 7
        python manage.py delete_old_inbox_items --user testuser --dry-run
    """

    def add_arguments(self, parser):
        parser.add_argument(
            "--user",
            type=str,
            required=True,
            help="Username to delete old inbox items for (required)",
        )
        parser.add_argument(
            "--hours",
            type=int,
            default=24,
            help="Delete items older than this many hours (default: 24)",
        )
        parser.add_argument(
            "--days",
            type=int,
            help="Delete items older than this many days (overrides --hours)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting",
        )

    def handle(self, **options):
        # Get user
        username = options["user"]
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f'User "{username}" not found')

        # Calculate cutoff time
        if options.get("days"):
            cutoff_time = timezone.now() - timedelta(days=options["days"])
            timespan_desc = f"{options['days']} days"
        else:
            cutoff_time = timezone.now() - timedelta(hours=options["hours"])
            timespan_desc = f"{options['hours']} hours"

        # Find items to delete
        old_items = InboxItem.objects.filter(owner=user, created_at__lt=cutoff_time)

        item_count = old_items.count()

        if item_count == 0:
            self.stdout.write(
                self.style.WARNING(
                    f"No inbox items older than {timespan_desc} found for user '{username}'"
                )
            )
            return

        # Show what will be deleted
        self.stdout.write(
            f"Found {item_count} inbox items older than {timespan_desc} for user '{username}'"
        )

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("DRY RUN - No items will be deleted"))

            # Show sample of items that would be deleted
            sample_items = old_items[:5]
            self.stdout.write("\nSample items that would be deleted:")
            for item in sample_items:
                age = timezone.now() - item.created_at
                self.stdout.write(
                    f"  - {item.title[:60]}... (created {age.days} days ago)"
                )

            if item_count > 5:
                self.stdout.write(f"  ... and {item_count - 5} more items")
        else:
            # Actually delete the items
            deleted_count, _ = old_items.delete()

            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully deleted {deleted_count} inbox items older than {timespan_desc}"
                )
            )

        # Show remaining stats
        remaining_count = InboxItem.objects.filter(owner=user).count()
        self.stdout.write(
            f"\nRemaining inbox items for user '{username}': {remaining_count}"
        )
