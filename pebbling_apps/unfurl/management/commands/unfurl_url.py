import logging
import pprint
from django.core.management.base import BaseCommand, CommandError
from django.core.exceptions import ValidationError

from ...unfurl import UnfurlMetadata

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Unfurl metadata for a URL"

    def add_arguments(self, parser):
        parser.add_argument("url", type=str, help="The URL of the RSS feed")

    def handle(self, *args, **options):
        url = options["url"]

        unfurl_metadata = UnfurlMetadata(url=url)
        try:
            unfurl_metadata.unfurl()
        except ValidationError:
            logger.error(f"Invalid URL format: {url}")
            raise CommandError(f"Invalid URL format: {url}")

        pp = pprint.PrettyPrinter(indent=2)

        print(unfurl_metadata.title)
        print(unfurl_metadata.author)
        print(unfurl_metadata.description)
        print(unfurl_metadata.image)
        print(unfurl_metadata.categories)
        # print(unfurl_metadata.metadata)

        # pp.pprint(unfurl_metadata.metadata)

        # out = {"feeds": unfurl_metadata.feeds, "metadata": unfurl_metadata.metadata}

        # print(out)
