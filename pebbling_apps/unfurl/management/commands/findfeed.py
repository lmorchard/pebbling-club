import logging
import pprint
from django.core.management.base import BaseCommand, CommandError
from django.core.exceptions import ValidationError
import urllib.parse

from ...unfurl import UnfurlMetadata

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Test the _findfeed() function with a given URL"

    def add_arguments(self, parser):
        parser.add_argument("url", type=str, help="The URL to test _findfeed() against")
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Show detailed debug output"
        )

    def handle(self, *args, **options):
        url = options["url"]
        verbose = options.get("verbose", False)
        
        if verbose:
            logging.basicConfig(level=logging.DEBUG)
        
        self.stdout.write(f"Testing _findfeed() with URL: {url}")
        self.stdout.write("-" * 50)
        
        unfurl_metadata = UnfurlMetadata(url=url)
        
        try:
            # Fetch the HTML content
            unfurl_metadata.fetch()
            self.stdout.write(self.style.SUCCESS("✓ Successfully fetched HTML content"))
            
            # Parse the URL
            parsed_url = urllib.parse.urlparse(url)
            self.stdout.write(f"Parsed URL: {parsed_url}")
            
            # Run _findfeed() directly
            self.stdout.write("\nRunning _findfeed()...")
            feeds = unfurl_metadata._findfeed(parsed_url)
            
            if feeds:
                self.stdout.write(self.style.SUCCESS(f"\n✓ Found {len(feeds)} feed(s):"))
                for i, feed in enumerate(feeds, 1):
                    self.stdout.write(f"  {i}. {feed}")
            else:
                self.stdout.write(self.style.WARNING("\n✗ No feeds found"))
            
            # Also run the full unfurl process for comparison
            self.stdout.write("\n" + "-" * 50)
            self.stdout.write("Running full unfurl() for comparison...")
            unfurl_metadata.parse()
            
            self.stdout.write(f"\nFull unfurl results:")
            self.stdout.write(f"Title: {unfurl_metadata.title or 'None'}")
            self.stdout.write(f"Description: {unfurl_metadata.description or 'None'}")
            self.stdout.write(f"Primary feed: {unfurl_metadata.feed or 'None'}")
            self.stdout.write(f"All feeds found: {len(unfurl_metadata.feeds)}")
            
            if verbose and unfurl_metadata.feeds:
                self.stdout.write("\nDetailed feed list:")
                for i, feed in enumerate(unfurl_metadata.feeds, 1):
                    self.stdout.write(f"  {i}. {feed}")
            
        except ValidationError:
            logger.error(f"Invalid URL format: {url}")
            raise CommandError(f"Invalid URL format: {url}")
        except Exception as e:
            logger.error(f"Error processing URL: {e}")
            raise CommandError(f"Error processing URL: {e}")