import logging
import requests
from typing import Dict, Optional, Tuple, List, Any, TYPE_CHECKING
from urllib.parse import urljoin, urlparse
from mastodon import Mastodon
from bs4 import BeautifulSoup

if TYPE_CHECKING:
    from pebbling_apps.inbox.models import InboxItem

logger = logging.getLogger(__name__)


def validate_mastodon_server(server_url: str) -> Optional[Dict[str, str]]:
    """
    Validate a Mastodon server by making an API call to get server info.

    Args:
        server_url: The Mastodon server URL (e.g., "https://mastodon.social")

    Returns:
        Dict with server info (title, description) or None if invalid
    """
    try:
        # Ensure the URL has a scheme
        if not server_url.startswith(("http://", "https://")):
            server_url = f"https://{server_url}"

        # Clean up the URL (remove trailing slash)
        server_url = server_url.rstrip("/")

        # Make API call to get instance information
        api_url = urljoin(server_url, "/api/v1/instance")

        response = requests.get(
            api_url,
            timeout=10,
            headers={"User-Agent": "Pebbling Club Mastodon Integration"},
        )
        response.raise_for_status()

        instance_data = response.json()

        return {
            "title": instance_data.get("title", server_url),
            "description": instance_data.get("description", ""),
            "server_url": server_url,
        }

    except requests.exceptions.RequestException as e:
        logger.warning(f"Failed to validate Mastodon server {server_url}: {e}")
        return None
    except (ValueError, KeyError) as e:
        logger.warning(f"Invalid response from Mastodon server {server_url}: {e}")
        return None


def create_mastodon_app(
    server_url: str, redirect_uri: str
) -> Optional[Tuple[str, str]]:
    """
    Register our application with a Mastodon instance.

    Args:
        server_url: The Mastodon server URL
        redirect_uri: The OAuth callback URL to register

    Returns:
        Tuple of (client_id, client_secret) or None if failed
    """
    try:
        # Ensure the URL has a scheme and clean formatting
        if not server_url.startswith(("http://", "https://")):
            server_url = f"https://{server_url}"
        server_url = server_url.rstrip("/")

        # Create app registration with specific redirect URI
        client_id, client_secret = Mastodon.create_app(
            "Pebbling Club",
            api_base_url=server_url,
            scopes=["read"],
            website="https://github.com/lmorchard/pebbling-club",
            redirect_uris=redirect_uri,
        )

        return client_id, client_secret

    except Exception as e:
        logger.error(f"Failed to create Mastodon app for {server_url}: {e}")
        return None


def get_oauth_url(
    server_url: str, client_id: str, client_secret: str, redirect_uri: str
) -> Optional[str]:
    """
    Generate OAuth authorization URL for Mastodon.

    Args:
        server_url: The Mastodon server URL
        client_id: The client ID from app registration
        client_secret: The client secret from app registration
        redirect_uri: The OAuth callback URL

    Returns:
        Authorization URL or None if failed
    """
    try:
        # Ensure the URL has a scheme and clean formatting
        if not server_url.startswith(("http://", "https://")):
            server_url = f"https://{server_url}"
        server_url = server_url.rstrip("/")

        # Create Mastodon instance for auth URL generation
        mastodon = Mastodon(
            client_id=client_id, client_secret=client_secret, api_base_url=server_url
        )

        # Generate authorization URL with read scope
        auth_url = mastodon.auth_request_url(
            scopes=["read"], redirect_uris=redirect_uri
        )

        return auth_url

    except Exception as e:
        logger.error(f"Failed to generate OAuth URL for {server_url}: {e}")
        return None


def exchange_oauth_code(
    server_url: str, client_id: str, client_secret: str, code: str, redirect_uri: str
) -> Optional[str]:
    """
    Exchange OAuth authorization code for access token.

    Args:
        server_url: The Mastodon server URL
        client_id: The client ID from app registration
        client_secret: The client secret from app registration
        code: Authorization code from OAuth callback
        redirect_uri: The OAuth callback URL (must match registration)

    Returns:
        Access token or None if failed
    """
    try:
        # Ensure the URL has a scheme and clean formatting
        if not server_url.startswith(("http://", "https://")):
            server_url = f"https://{server_url}"
        server_url = server_url.rstrip("/")

        # Create Mastodon instance for token exchange
        mastodon = Mastodon(
            client_id=client_id, client_secret=client_secret, api_base_url=server_url
        )

        # Exchange code for access token
        access_token = mastodon.log_in(
            code=code, redirect_uri=redirect_uri, scopes=["read"]
        )

        return access_token

    except Exception as e:
        logger.error(f"Failed to exchange OAuth code for {server_url}: {e}")
        return None


def get_account_info(server_url: str, access_token: str) -> Optional[Dict]:
    """
    Get account information using access token.

    Args:
        server_url: The Mastodon server URL
        access_token: The OAuth access token

    Returns:
        Dict with account info or None if failed
    """
    try:
        # Ensure the URL has a scheme and clean formatting
        if not server_url.startswith(("http://", "https://")):
            server_url = f"https://{server_url}"
        server_url = server_url.rstrip("/")

        # Create authenticated Mastodon instance
        mastodon = Mastodon(access_token=access_token, api_base_url=server_url)

        # Get account information
        account_info = mastodon.me()

        return {
            "account_id": str(account_info["id"]),
            "username": account_info["username"],
            "display_name": account_info.get("display_name", ""),
            "acct": account_info["acct"],
        }

    except Exception as e:
        logger.error(f"Failed to get account info for {server_url}: {e}")
        return None


def test_mastodon_connection(server_url: str, access_token: str) -> bool:
    """
    Test if a Mastodon connection is still valid.

    Args:
        server_url: The Mastodon server URL
        access_token: The OAuth access token

    Returns:
        True if connection is valid, False otherwise
    """
    try:
        account_info = get_account_info(server_url, access_token)
        return account_info is not None
    except Exception as e:
        logger.warning(f"Mastodon connection test failed for {server_url}: {e}")
        return False


def get_mastodon_lists(mastodon_account) -> Optional[list]:
    """
    Get user's Mastodon lists for timeline configuration.

    Args:
        mastodon_account: MastodonAccount instance

    Returns:
        List of dicts with id, title for template use, or None if failed
    """
    try:
        # Ensure the URL has a scheme and clean formatting
        server_url = mastodon_account.server_url
        if not server_url.startswith(("http://", "https://")):
            server_url = f"https://{server_url}"
        server_url = server_url.rstrip("/")

        # Create authenticated Mastodon instance
        mastodon = Mastodon(
            access_token=mastodon_account.access_token, api_base_url=server_url
        )

        # Get user's lists
        lists = mastodon.lists()

        # Convert to simple format for template use
        result = []
        for mastodon_list in lists:
            result.append(
                {"id": str(mastodon_list["id"]), "title": mastodon_list["title"]}
            )

        return result

    except Exception as e:
        logger.error(f"Failed to get Mastodon lists for {mastodon_account}: {e}")
        return None


def test_timeline_access(
    mastodon_account, timeline_type: str, config: dict
) -> Tuple[bool, Optional[str]]:
    """
    Test if timeline is accessible with current permissions.

    Args:
        mastodon_account: MastodonAccount instance
        timeline_type: The timeline type (HOME, LOCAL, PUBLIC, HASHTAG, LIST)
        config: Timeline configuration dict

    Returns:
        Tuple of (success: bool, error_message: Optional[str])
    """
    try:
        # Ensure the URL has a scheme and clean formatting
        server_url = mastodon_account.server_url
        if not server_url.startswith(("http://", "https://")):
            server_url = f"https://{server_url}"
        server_url = server_url.rstrip("/")

        # Create authenticated Mastodon instance
        mastodon = Mastodon(
            access_token=mastodon_account.access_token, api_base_url=server_url
        )

        # Test timeline access based on type
        if timeline_type == "HOME":
            # Test home timeline access
            mastodon.timeline_home(limit=1)
        elif timeline_type == "LOCAL":
            # Test local timeline access
            mastodon.timeline_local(limit=1)
        elif timeline_type == "PUBLIC":
            # Test public timeline access
            mastodon.timeline_public(limit=1)
        elif timeline_type == "HASHTAG":
            hashtag = config.get("hashtag")
            if not hashtag:
                return False, "Hashtag is required"
            # Test hashtag timeline access
            mastodon.timeline_hashtag(hashtag, limit=1)
        elif timeline_type == "LIST":
            list_id = config.get("list_id")
            if not list_id:
                return False, "List ID is required"
            # Test list timeline access
            mastodon.timeline_list(list_id, limit=1)
        else:
            return False, f"Unknown timeline type: {timeline_type}"

        return True, None

    except Exception as e:
        logger.warning(
            f"Timeline access test failed for {mastodon_account} {timeline_type}: {e}"
        )
        return False, str(e)


def extract_links_from_status(status: Dict[str, Any]) -> List[str]:
    """
    Extract external links from a Mastodon status.

    Args:
        status: Mastodon status dict from API

    Returns:
        List of external URLs found in the status
    """
    links: List[str] = []

    try:
        # Get the content (HTML) from the status
        content = status.get("content", "")
        if not content:
            return links

        # Parse HTML content to extract links
        soup = BeautifulSoup(content, "html.parser")

        # Find all <a> tags with href attributes
        for link in soup.find_all("a", href=True):
            if hasattr(link, "get"):
                href = link.get("href")
                if not href or not isinstance(href, str):
                    continue

                # Skip internal Mastodon links and mentions
                if not _is_external_link(href):
                    continue

                # Add to links if not already present
                if href not in links:
                    links.append(href)

        # Also check media attachments for external URLs
        for attachment in status.get("media_attachments", []):
            remote_url = attachment.get("remote_url")
            if remote_url and _is_external_link(remote_url):
                if remote_url not in links:
                    links.append(remote_url)

        # Check card (link preview) if present
        card = status.get("card")
        if card and card.get("url"):
            card_url = card["url"]
            if _is_external_link(card_url) and card_url not in links:
                links.append(card_url)

        return links

    except Exception as e:
        logger.warning(f"Failed to extract links from status: {e}")
        return []


def _is_external_link(url: str) -> bool:
    """
    Check if URL is an external link (not a Mastodon mention/tag/internal link).

    Args:
        url: URL to check

    Returns:
        True if external link, False otherwise
    """
    try:
        parsed = urlparse(url)

        # Must have a scheme and netloc
        if not parsed.scheme or not parsed.netloc:
            return False

        # Skip common non-external patterns
        if parsed.scheme not in ("http", "https"):
            return False

        # Skip typical Mastodon internal paths
        path = parsed.path.lower()
        if path.startswith(("@", "/tags/", "/web/", "/users/", "/@")):
            return False

        return True

    except Exception:
        return False


def create_inbox_items_from_status(
    mastodon_account, status: Dict[str, Any], timeline=None, skip_deduplication=False
) -> List["InboxItem"]:
    """
    Create InboxItem objects from links found in a Mastodon status.
    Implements deduplication based on Mastodon status IDs.

    Args:
        mastodon_account: MastodonAccount instance
        status: Mastodon status dict from API
        timeline: MastodonTimeline instance (optional, for better source attribution)
        skip_deduplication: If True, skip individual deduplication check (for batch processing)

    Returns:
        List of created InboxItem objects
    """
    from pebbling_apps.inbox.services import InboxItemCreationService
    from pebbling_apps.inbox.models import InboxItem

    try:
        # Extract Mastodon status ID for deduplication
        status_id = str(status.get("id", ""))
        if not status_id:
            logger.warning("Mastodon status missing ID, skipping")
            return []

        # Check if we already have inbox items from this status for this user
        # (only if not doing batch deduplication)
        if not skip_deduplication:
            existing_items = InboxItem.objects.filter(
                owner=mastodon_account.user, metadata__mastodon_status_id=status_id
            ).exists()

            if existing_items:
                logger.debug(
                    f"Skipping duplicate Mastodon status {status_id} for user {mastodon_account.user}"
                )
                return []

        # Extract links from the status
        links = extract_links_from_status(status)
        if not links:
            return []

        # Generate source identifier with timeline details
        if timeline:
            timeline_detail = _get_timeline_source_detail(timeline)
            source = f"mastodon:{mastodon_account.username}@{mastodon_account.server_url}:{timeline_detail}"
        else:
            source = (
                f"mastodon:{mastodon_account.username}@{mastodon_account.server_url}"
            )

        # Prepare metadata with Mastodon status ID and URL
        status_url = status.get("url") or status.get("uri")
        mastodon_metadata = {
            "mastodon_status_id": status_id,
            "mastodon_status_url": status_url,
            "mastodon_account_id": mastodon_account.account_id,
            "mastodon_server": mastodon_account.server_url,
        }

        # Add timeline information if available
        if timeline:
            mastodon_metadata["timeline_type"] = timeline.timeline_type
            mastodon_metadata["timeline_config"] = timeline.config

        # Prepare items data for creation
        from pebbling_apps.inbox.constants import SourceType

        items_data = []
        for url in links:
            items_data.append(
                {
                    "url": url,
                    "title": _generate_title_from_status(status, url),
                    "description": _generate_description_from_status(status),
                    "source_type": SourceType.MASTODON,
                    "metadata": mastodon_metadata,
                    "status": status,  # Pass status for tag processing
                    "mastodon_account": mastodon_account,
                }
            )

        # Create inbox items using shared service with tag processor
        def mastodon_tag_processor(inbox_item, item_data):
            """Process Mastodon-specific tags for the inbox item."""
            _add_mastodon_tags(
                inbox_item, item_data["mastodon_account"], item_data["status"]
            )

        created_items = InboxItemCreationService.create_inbox_items(
            owner=mastodon_account.user,
            items_data=items_data,
            source=source,
            tag_processor=mastodon_tag_processor,
            use_bulk_create=False,  # Use individual creation for detailed tag processing
        )

        if created_items:
            logger.info(
                f"Created {len(created_items)} inbox items from Mastodon status {status_id} "
                f"for user {mastodon_account.user}"
            )

        return created_items

    except Exception as e:
        logger.error(f"Failed to create inbox items from Mastodon status: {e}")
        return []


def _generate_title_from_status(status: Dict[str, Any], url: str) -> str:
    """Generate a title for the inbox item from the status and URL."""
    # First, try to use link preview title if available
    card = status.get("card")
    if card and card.get("title"):
        return card["title"][:255]  # Truncate to fit model field

    # Fall back to text content (stripped of HTML)
    content = status.get("content", "")
    if content:
        # Parse HTML and get text content
        soup = BeautifulSoup(content, "html.parser")
        text = soup.get_text().strip()
        if text:
            # Truncate and use as title
            return text[:255]

    # Last resort: use the URL domain
    try:
        parsed = urlparse(url)
        return f"Link from {parsed.netloc}"
    except Exception:
        return "Mastodon Link"


def _generate_description_from_status(status: Dict[str, Any]) -> str:
    """Generate a description for the inbox item from the status."""
    # Use the status content as description
    content = status.get("content", "")
    if content:
        # Parse HTML and get text content
        soup = BeautifulSoup(content, "html.parser")
        text = soup.get_text().strip()

        # Add author information
        account = status.get("account", {})
        author = account.get("display_name") or account.get("username", "Unknown")

        return f"Shared by @{author}: {text}"

    return "Shared from Mastodon"


def _add_mastodon_tags(inbox_item, mastodon_account, status: Dict[str, Any]):
    """Add relevant tags to the inbox item."""
    from pebbling_apps.bookmarks.models import Tag

    try:
        # Add source tag
        source_tag = Tag.objects.get_or_create_system_tag(
            f"source:mastodon", inbox_item.owner
        )
        inbox_item.tags.add(source_tag)

        # Add server tag
        server_domain = urlparse(mastodon_account.server_url).netloc
        if server_domain:
            server_tag = Tag.objects.get_or_create_system_tag(
                f"mastodon:{server_domain}", inbox_item.owner
            )
            inbox_item.tags.add(server_tag)

        # Add hashtags from the status
        for tag in status.get("tags", []):
            tag_name = tag.get("name")
            if tag_name:
                hashtag, _ = Tag.objects.get_or_create(
                    name=f"#{tag_name}",
                    owner=inbox_item.owner,
                    defaults={"is_system": False},
                )
                inbox_item.tags.add(hashtag)

    except Exception as e:
        logger.warning(f"Failed to add tags to inbox item: {e}")


def _get_timeline_source_detail(timeline) -> str:
    """Generate a descriptive source detail string for a timeline."""
    timeline_type = timeline.timeline_type.lower()

    if timeline_type == "home":
        return "home"
    elif timeline_type == "local":
        return "local"
    elif timeline_type == "public":
        return "public"
    elif timeline_type == "hashtag":
        hashtag = timeline.config.get("hashtag", "unknown")
        return f"hashtag:{hashtag}"
    elif timeline_type == "list":
        list_name = timeline.config.get(
            "list_name", timeline.config.get("list_id", "unknown")
        )
        return f"list:{list_name}"
    else:
        return timeline_type


def filter_duplicate_statuses(
    user, statuses: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Filter out statuses that already have inbox items for the given user.

    Args:
        user: Django user instance
        statuses: List of Mastodon status dicts from API

    Returns:
        List of statuses that don't already have inbox items
    """
    from pebbling_apps.inbox.models import InboxItem

    if not statuses:
        return []

    # Extract status IDs
    status_ids = [str(status.get("id", "")) for status in statuses if status.get("id")]
    if not status_ids:
        return statuses

    # Find existing status IDs that already have inbox items
    existing_status_ids = set(
        InboxItem.objects.filter(
            owner=user,
            metadata__mastodon_status_id__in=status_ids,
        ).values_list("metadata__mastodon_status_id", flat=True)
    )

    # Filter out statuses that already have inbox items
    new_statuses = [
        status
        for status in statuses
        if str(status.get("id", "")) not in existing_status_ids
    ]

    logger.debug(
        f"Filtered {len(statuses)} statuses to {len(new_statuses)} new ones "
        f"(skipped {len(existing_status_ids)} duplicates) for user {user}"
    )

    return new_statuses


def fetch_timeline_statuses(
    mastodon_account,
    timeline_type: str,
    config: dict,
    since_id: Optional[str] = None,
    limit: int = 20,
) -> Optional[List[Dict[str, Any]]]:
    """
    Fetch statuses from a specific timeline.

    Args:
        mastodon_account: MastodonAccount instance
        timeline_type: The timeline type (HOME, LOCAL, PUBLIC, HASHTAG, LIST)
        config: Timeline configuration dict
        since_id: Only fetch statuses newer than this ID
        limit: Maximum number of statuses to fetch

    Returns:
        List of status dicts or None if failed
    """
    try:
        # Ensure the URL has a scheme and clean formatting
        server_url = mastodon_account.server_url
        if not server_url.startswith(("http://", "https://")):
            server_url = f"https://{server_url}"
        server_url = server_url.rstrip("/")

        # Create authenticated Mastodon instance
        mastodon = Mastodon(
            access_token=mastodon_account.access_token, api_base_url=server_url
        )

        # Fetch timeline based on type
        statuses = []

        if timeline_type == "HOME":
            statuses = mastodon.timeline_home(since_id=since_id, limit=limit)
        elif timeline_type == "LOCAL":
            statuses = mastodon.timeline_local(since_id=since_id, limit=limit)
        elif timeline_type == "PUBLIC":
            statuses = mastodon.timeline_public(since_id=since_id, limit=limit)
        elif timeline_type == "HASHTAG":
            hashtag = config.get("hashtag")
            if not hashtag:
                raise ValueError("Hashtag is required for HASHTAG timeline")
            statuses = mastodon.timeline_hashtag(
                hashtag, since_id=since_id, limit=limit
            )
        elif timeline_type == "LIST":
            list_id = config.get("list_id")
            if not list_id:
                raise ValueError("List ID is required for LIST timeline")
            statuses = mastodon.timeline_list(list_id, since_id=since_id, limit=limit)
        else:
            raise ValueError(f"Unknown timeline type: {timeline_type}")

        return statuses

    except Exception as e:
        logger.error(
            f"Failed to fetch timeline statuses for {mastodon_account} {timeline_type}: {e}"
        )
        return None
