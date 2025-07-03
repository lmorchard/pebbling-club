# Generated manually on 2025-07-02
# This migration disables aggressive monitoring that was causing accounts
# to be disabled due to temporary network issues (like computers going to sleep).
# The tasks are updated to only disable accounts/timelines after 1 week of failures.

from django.db import migrations


def disable_aggressive_monitoring(apps, schema_editor):
    """Disable overly aggressive Mastodon monitoring tasks."""
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    # Disable the connection testing task that runs every 30 minutes
    PeriodicTask.objects.filter(name="Test Mastodon Connections").update(enabled=False)

    # Disable the timeline cleanup task that runs every 5 minutes
    PeriodicTask.objects.filter(name="Cleanup Failed Mastodon Timelines").update(
        enabled=False
    )

    # Keep "Poll All Mastodon Timelines" enabled - this is the actual useful task


def reenable_aggressive_monitoring(apps, schema_editor):
    """Re-enable Mastodon monitoring tasks (reverse migration)."""
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    # Re-enable both tasks
    PeriodicTask.objects.filter(
        name__in=["Test Mastodon Connections", "Cleanup Failed Mastodon Timelines"]
    ).update(enabled=True)


class Migration(migrations.Migration):

    dependencies = [
        ("mastodon_integration", "0002_add_mastodon_polling_tasks"),
        ("django_celery_beat", "0018_improve_crontab_helptext"),
    ]

    operations = [
        migrations.RunPython(
            disable_aggressive_monitoring,
            reenable_aggressive_monitoring,
        ),
    ]
