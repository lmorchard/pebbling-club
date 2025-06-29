import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from pebbling_apps.inbox.models import InboxItem
from pebbling_apps.bookmarks.models import Tag

User = get_user_model()


class Command(BaseCommand):
    help = """Generate dummy inbox items for testing the UI.
    
    Examples:
        python manage.py generate_dummy_inbox_items --user testuser --count 25
        python manage.py generate_dummy_inbox_items --user testuser --count 50 --clear
    """

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=20,
            help="Number of dummy items to create (default: 20, min: 10, max: 100)",
        )
        parser.add_argument(
            "--user", type=str, help="Username to create items for (required)"
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing inbox items before creating new ones",
        )

    def handle(self, **options):
        # Validate count
        count = max(10, min(100, options["count"]))

        # Get user
        username = options.get("user")
        if not username:
            self.stdout.write(self.style.ERROR("Please provide a username with --user"))
            return

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User "{username}" not found'))
            return

        # Clear existing items if requested
        if options["clear"]:
            deleted_count = InboxItem.objects.filter(owner=user).delete()[0]
            self.stdout.write(
                self.style.WARNING(f"Deleted {deleted_count} existing inbox items")
            )

        # Sample data for generating realistic items
        sources = [
            "feed https://news.ycombinator.com/rss",
            "feed https://blog.example.com/rss",
            "feed https://techcrunch.com/feed",
            "feed https://dev.to/feed",
            "feed https://reddit.com/r/programming/.rss",
            "manual",
            "test",
        ]

        titles = [
            "Understanding {topic} in {year}",
            "How to Build Better {topic}",
            "The Complete Guide to {topic}",
            "{topic}: What You Need to Know",
            "Why {topic} Matters More Than Ever",
            "Breaking: Major Update to {topic}",
            "New Research on {topic} Shows Surprising Results",
            "{topic} Best Practices for Developers",
            "The Future of {topic}",
            "Common {topic} Mistakes and How to Avoid Them",
            "Getting Started with {topic}",
            "{topic} vs {alt_topic}: A Comprehensive Comparison",
            "Top 10 {topic} Tools You Should Be Using",
            "The Hidden Costs of {topic}",
            "How {company} is Revolutionizing {topic}",
        ]

        topics = [
            "Machine Learning",
            "Web Development",
            "Cloud Computing",
            "Cybersecurity",
            "Python Programming",
            "JavaScript Frameworks",
            "Database Design",
            "API Development",
            "Microservices",
            "DevOps",
            "Container Orchestration",
            "Serverless Architecture",
            "Data Science",
            "Blockchain Technology",
            "Mobile Development",
            "AI Ethics",
            "Software Testing",
            "Code Review",
            "Performance Optimization",
            "System Design",
        ]

        companies = [
            "Google",
            "Microsoft",
            "Amazon",
            "Netflix",
            "Spotify",
            "Uber",
            "Airbnb",
        ]

        domains = [
            "techblog.example.com",
            "devnews.example.com",
            "engineering.example.com",
            "research.example.com",
            "insights.example.com",
            "trends.example.com",
            "analysis.example.com",
            "reports.example.com",
            "studies.example.com",
        ]

        descriptions = [
            "A comprehensive look at the latest developments and best practices.",
            "Expert insights and practical tips for professionals.",
            "Deep dive into the technical aspects and implementation details.",
            "Real-world examples and case studies from industry leaders.",
            "Everything you need to know to get started quickly.",
            "Advanced techniques for experienced practitioners.",
            "Common pitfalls and how to avoid them in your projects.",
            "Performance benchmarks and optimization strategies.",
            "Security considerations and best practices.",
            "Future trends and what they mean for developers.",
        ]

        # Create system tags
        read_tag = Tag.objects.get_or_create_system_tag("inbox:read", user)
        archived_tag = Tag.objects.get_or_create_system_tag("inbox:archived", user)

        created_items = []

        for i in range(count):
            # Generate random data
            topic = random.choice(topics)
            alt_topic = random.choice([t for t in topics if t != topic])
            company = random.choice(companies)
            year = random.choice(["2024", "2025", "Modern Times", "the AI Era"])

            title = random.choice(titles).format(
                topic=topic, alt_topic=alt_topic, company=company, year=year
            )

            domain = random.choice(domains)
            slug = (
                title.lower().replace(" ", "-").replace(":", "").replace(",", "")[:40]
            )
            # Add timestamp and counter to ensure uniqueness
            import time

            timestamp = int(time.time() * 1000)
            url = f"https://{domain}/articles/{slug}-{timestamp}-{i}"

            description = random.choice(descriptions)
            source = random.choice(sources)

            # Random date within last 30 days
            days_ago = random.randint(0, 30)
            hours_ago = random.randint(0, 23)
            created_at = timezone.now() - timedelta(days=days_ago, hours=hours_ago)

            # Create the item
            item = InboxItem.objects.create(
                url=url,
                owner=user,
                title=title,
                description=description,
                source=source,
            )

            # Manually set created_at for realistic dates
            item.created_at = created_at
            item.save()

            # Randomly add tags
            # 30% chance of being read (only if we have the tag)
            if read_tag and random.random() < 0.3:
                item.tags.add(read_tag)

            # 10% chance of being archived (only if we have the tag)
            if archived_tag and random.random() < 0.1:
                item.tags.add(archived_tag)

            # 20% chance of having user tags
            if random.random() < 0.2:
                tag_names = random.sample(
                    ["tutorial", "interesting", "todo", "reference", "bookmark"],
                    k=random.randint(1, 3),
                )
                for tag_name in tag_names:
                    tag, _ = Tag.objects.get_or_create(name=tag_name, owner=user)
                    item.tags.add(tag)

            created_items.append(item)

            if (i + 1) % 10 == 0:
                self.stdout.write(f"Created {i + 1} items...")

        # Summary
        self.stdout.write(
            self.style.SUCCESS(
                f"\nSuccessfully created {len(created_items)} dummy inbox items"
            )
        )

        # Stats
        total_items = InboxItem.objects.filter(owner=user).count()
        unread_items = InboxItem.objects.unread_for_user(user).count()
        archived_items = InboxItem.objects.archived_for_user(user).count()
        read_items = InboxItem.objects.filter(
            owner=user, tags__name="inbox:read", tags__is_system=True
        ).count()

        self.stdout.write("\nInbox stats for user:")
        self.stdout.write(f"  Total items: {total_items}")
        self.stdout.write(f"  Unread items: {unread_items}")
        self.stdout.write(f"  Read items: {read_items}")
        self.stdout.write(f"  Archived items: {archived_items}")

        # Show sample items
        self.stdout.write("\nSample items created:")
        for item in created_items[:5]:
            tags = ", ".join([tag.name for tag in item.tags.all()])
            self.stdout.write(f"  - {item.title[:60]}... [{tags}]")
