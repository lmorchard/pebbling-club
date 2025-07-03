import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from django.views.generic import TemplateView
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_protect
from django.contrib import messages
from django.urls import reverse
from django.conf import settings
from .utils import (
    validate_mastodon_server,
    create_mastodon_app,
    get_oauth_url,
    exchange_oauth_code,
    get_account_info,
    get_mastodon_lists,
    test_timeline_access,
)
from .models import MastodonAccount, MastodonTimeline
from .forms import TimelineForm, TimelineToggleForm

logger = logging.getLogger(__name__)


class MastodonConnectView(LoginRequiredMixin, TemplateView):
    """View for entering Mastodon server URL and initiating OAuth flow."""

    template_name = "mastodon_integration/connect.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["page_title"] = "Connect Mastodon Account"
        return context


class MastodonSettingsView(LoginRequiredMixin, TemplateView):
    """Main Mastodon settings page showing connected accounts and management options."""

    template_name = "mastodon_integration/settings.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["page_title"] = "Mastodon Connections"

        # Get user's Mastodon accounts with timeline counts
        accounts = MastodonAccount.objects.filter(
            user=self.request.user
        ).prefetch_related("timelines")
        context["mastodon_accounts"] = accounts

        return context


@require_http_methods(["POST"])
@csrf_protect
@login_required
def validate_server(request):
    """
    AJAX endpoint to validate a Mastodon server URL.

    Accepts POST data with 'server_url' field.
    Returns JSON response with server info or error.
    """
    server_url = request.POST.get("server_url", "").strip()

    if not server_url:
        return JsonResponse(
            {"success": False, "error": "Server URL is required"}, status=400
        )

    # Validate the server
    server_info = validate_mastodon_server(server_url)

    if server_info is None:
        return JsonResponse(
            {
                "success": False,
                "error": "Unable to connect to this Mastodon server. Please check the URL and try again.",
            },
            status=400,
        )

    return JsonResponse(
        {
            "success": True,
            "server_info": {
                "title": server_info.get("title", server_url),
                "description": server_info.get("description", ""),
                "server_url": server_info.get("server_url", server_url),
            },
        }
    )


@require_http_methods(["POST"])
@csrf_protect
@login_required
def initiate_oauth(request):
    """
    Initiate OAuth flow for a validated Mastodon server.

    Accepts POST data with server validation info from the previous step.
    Creates app registration and redirects user to Mastodon for authorization.
    """
    server_url = request.POST.get("server_url", "").strip()
    server_title = request.POST.get("server_title", "").strip()
    server_description = request.POST.get("server_description", "").strip()

    if not server_url:
        messages.error(request, "Server URL is required")
        return redirect("mastodon_integration:connect")

    try:
        # Generate redirect URI (ensure port is included for development)
        callback_path = reverse("mastodon_integration:oauth_callback")
        redirect_uri = request.build_absolute_uri(callback_path)

        # Debug logging to understand the issue
        logger.info(f"Request META - HTTP_HOST: {request.META.get('HTTP_HOST')}")
        logger.info(f"Request META - SERVER_NAME: {request.META.get('SERVER_NAME')}")
        logger.info(f"Request META - SERVER_PORT: {request.META.get('SERVER_PORT')}")
        logger.info(f"Generated redirect URI: {redirect_uri}")

        # For development, ensure localhost includes port
        if (
            "localhost" in redirect_uri
            and ":" not in redirect_uri.split("localhost")[1].split("/")[0]
        ):
            # If localhost is missing port, try to add it from the request
            if (
                request.META.get("SERVER_PORT")
                and request.META.get("SERVER_PORT") != "80"
            ):
                redirect_uri = redirect_uri.replace(
                    "localhost", f"localhost:{request.META.get('SERVER_PORT')}"
                )
                logger.info(f"Corrected redirect URI for development: {redirect_uri}")

        # Create app registration with Mastodon server
        app_credentials = create_mastodon_app(server_url, redirect_uri)
        if app_credentials is None:
            messages.error(
                request, "Failed to register application with Mastodon server"
            )
            return redirect("mastodon_integration:connect")

        client_id, client_secret = app_credentials

        # Generate OAuth authorization URL
        auth_url = get_oauth_url(server_url, client_id, client_secret, redirect_uri)
        if auth_url is None:
            messages.error(request, "Failed to generate authorization URL")
            return redirect("mastodon_integration:connect")

        # Store OAuth state in session for callback verification
        request.session["mastodon_oauth_state"] = {
            "server_url": server_url,
            "server_title": server_title,
            "server_description": server_description,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
        }

        # Redirect user to Mastodon for authorization
        return redirect(auth_url)

    except Exception as e:
        logger.error(f"OAuth initiation failed for {server_url}: {e}")
        messages.error(request, "Failed to initiate OAuth flow. Please try again.")
        return redirect("mastodon_integration:connect")


@login_required
def oauth_callback(request):
    """
    Handle OAuth callback from Mastodon.

    Exchanges authorization code for access token and creates MastodonAccount.
    """
    # Get authorization code from callback
    code = request.GET.get("code")
    error = request.GET.get("error")

    if error:
        messages.error(request, f"OAuth authorization failed: {error}")
        return redirect("mastodon_integration:connect")

    if not code:
        messages.error(request, "Authorization code not received")
        return redirect("mastodon_integration:connect")

    # Retrieve OAuth state from session
    oauth_state = request.session.get("mastodon_oauth_state")
    if not oauth_state:
        messages.error(request, "OAuth session expired. Please try again.")
        return redirect("mastodon_integration:connect")

    try:
        # Exchange code for access token
        access_token = exchange_oauth_code(
            oauth_state["server_url"],
            oauth_state["client_id"],
            oauth_state["client_secret"],
            code,
            oauth_state["redirect_uri"],
        )

        if access_token is None:
            messages.error(
                request, "Failed to exchange authorization code for access token"
            )
            return redirect("mastodon_integration:connect")

        # Get account information
        account_info = get_account_info(oauth_state["server_url"], access_token)
        if account_info is None:
            messages.error(request, "Failed to retrieve account information")
            return redirect("mastodon_integration:connect")

        # Check if this is a re-authentication request
        reauthenticate_account_id = request.session.get("reauthenticate_account_id")

        if reauthenticate_account_id:
            # Re-authentication: update the specific account
            try:
                existing_account = MastodonAccount.objects.get(
                    id=reauthenticate_account_id, user=request.user
                )
                # Update with new credentials
                existing_account.access_token = access_token
                existing_account.username = account_info["username"]
                existing_account.display_name = account_info["display_name"]
                existing_account.account_id = account_info["account_id"]
                existing_account.is_active = True
                existing_account.save()

                # Reset failure counts on all timelines
                existing_account.timelines.update(consecutive_failures=0)

                messages.success(
                    request,
                    f'Successfully re-authenticated {account_info["username"]}@{oauth_state["server_url"]}',
                )

                # Clear the re-authentication flag
                del request.session["reauthenticate_account_id"]

            except MastodonAccount.DoesNotExist:
                messages.error(request, "Account not found for re-authentication")
                return redirect("mastodon_integration:settings")

        else:
            # Normal flow: check if account already exists
            existing_account = MastodonAccount.objects.filter(
                user=request.user,
                server_url=oauth_state["server_url"],
                account_id=account_info["account_id"],
            ).first()

            if existing_account:
                # Update existing account
                existing_account.access_token = access_token
                existing_account.username = account_info["username"]
                existing_account.display_name = account_info["display_name"]
                existing_account.server_name = oauth_state["server_title"]
                existing_account.server_description = oauth_state["server_description"]
                existing_account.is_active = True
                existing_account.save()

                messages.success(
                    request,
                    f'Updated connection to {account_info["username"]}@{oauth_state["server_url"]}',
                )
            else:
                # Create new account
                MastodonAccount.objects.create(
                    user=request.user,
                    server_url=oauth_state["server_url"],
                    server_name=oauth_state["server_title"],
                    server_description=oauth_state["server_description"],
                    access_token=access_token,
                    account_id=account_info["account_id"],
                    username=account_info["username"],
                    display_name=account_info["display_name"],
                )

                messages.success(
                    request,
                    f'Successfully connected {account_info["username"]}@{oauth_state["server_url"]}',
                )

        # Clear OAuth state from session
        if "mastodon_oauth_state" in request.session:
            del request.session["mastodon_oauth_state"]

        # Redirect to settings page to configure timelines
        return redirect("mastodon_integration:settings")

    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        messages.error(request, "Failed to complete OAuth flow. Please try again.")
        return redirect("mastodon_integration:connect")


@require_http_methods(["POST"])
@csrf_protect
@login_required
def disconnect_account(request, account_id):
    """
    Disconnect (delete) a Mastodon account and all associated timelines.
    """
    try:
        account = MastodonAccount.objects.get(id=account_id, user=request.user)

        # Store account info for success message
        account_display = f"{account.username}@{account.server_url}"

        # Delete account (this will cascade delete timelines)
        account.delete()

        messages.success(request, f"Disconnected {account_display}")

    except MastodonAccount.DoesNotExist:
        messages.error(request, "Account not found")
    except Exception as e:
        logger.error(f"Failed to disconnect account {account_id}: {e}")
        messages.error(request, "Failed to disconnect account")

    return redirect("mastodon_integration:settings")


@require_http_methods(["POST"])
@csrf_protect
@login_required
def reenable_account(request, account_id):
    """
    Re-enable a disabled Mastodon account and test its connection.
    """
    try:
        account = MastodonAccount.objects.get(id=account_id, user=request.user)

        # Test the connection first
        from .utils import test_mastodon_connection

        if test_mastodon_connection(account.server_url, account.access_token):
            # Connection works, re-enable the account
            account.is_active = True
            account.save()

            # Reset failure counts on all timelines
            account.timelines.update(consecutive_failures=0)

            messages.success(
                request,
                f"Successfully re-enabled {account.username}@{account.server_url}",
            )
        else:
            # Connection still failing, suggest re-authentication
            messages.error(
                request,
                f"Connection test failed for {account.username}@{account.server_url}. "
                "You may need to re-authenticate this account.",
            )

    except MastodonAccount.DoesNotExist:
        messages.error(request, "Account not found")
    except Exception as e:
        logger.error(f"Failed to re-enable account {account_id}: {e}")
        messages.error(request, "Failed to re-enable account")

    return redirect("mastodon_integration:settings")


@require_http_methods(["POST"])
@csrf_protect
@login_required
def reauthenticate_account(request, account_id):
    """
    Store account ID in session and redirect to OAuth flow to update existing account.
    """
    try:
        account = MastodonAccount.objects.get(id=account_id, user=request.user)

        # Store account ID in session for the OAuth callback
        request.session["reauthenticate_account_id"] = account_id

        # Redirect to initiate OAuth with the same server
        messages.info(
            request,
            f"Re-authenticating {account.username}@{account.server_url}. "
            "Please authorize the app again.",
        )

        # Create form data for OAuth initiation
        from django.http import QueryDict

        post_data = QueryDict(mutable=True)
        post_data["server_url"] = account.server_url
        post_data["server_title"] = account.server_name
        post_data["server_description"] = account.server_description

        # Store in session and redirect
        request.session["mastodon_server_info"] = {
            "server_url": account.server_url,
            "server_title": account.server_name,
            "server_description": account.server_description,
        }

        # Use the existing initiate_oauth flow
        return initiate_oauth(request)

    except MastodonAccount.DoesNotExist:
        messages.error(request, "Account not found")
    except Exception as e:
        logger.error(f"Failed to start re-authentication for account {account_id}: {e}")
        messages.error(request, "Failed to start re-authentication")

    return redirect("mastodon_integration:settings")


class AccountTimelinesView(LoginRequiredMixin, TemplateView):
    """View for managing timelines for a specific Mastodon account."""

    template_name = "mastodon_integration/account_timelines.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        # Get the account
        account_id = kwargs.get("account_id")
        account = get_object_or_404(
            MastodonAccount, id=account_id, user=self.request.user
        )

        context["account"] = account
        context["page_title"] = f"Timelines - {account.username}@{account.server_url}"

        # Get existing timelines for this account
        timelines = MastodonTimeline.objects.filter(account=account).order_by(
            "timeline_type", "created_at"
        )
        context["timelines"] = timelines

        return context


class AddTimelineView(LoginRequiredMixin, TemplateView):
    """View for adding a new timeline to a Mastodon account."""

    template_name = "mastodon_integration/add_timeline.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        # Get the account
        account_id = kwargs.get("account_id")
        account = get_object_or_404(
            MastodonAccount, id=account_id, user=self.request.user
        )

        context["account"] = account
        context["page_title"] = (
            f"Add Timeline - {account.username}@{account.server_url}"
        )

        # Fetch Mastodon lists for this account
        mastodon_lists = get_mastodon_lists(account) or []

        # Create form with Mastodon lists
        if "form" not in context:
            context["form"] = TimelineForm(
                account=account, mastodon_lists=mastodon_lists
            )

        return context

    def post(self, request, *args, **kwargs):
        context = self.get_context_data(**kwargs)
        account = context["account"]

        # Fetch Mastodon lists for form validation
        mastodon_lists = get_mastodon_lists(account) or []

        form = TimelineForm(
            request.POST, account=account, mastodon_lists=mastodon_lists
        )

        if form.is_valid():
            timeline = form.save()
            messages.success(
                request, f"Added {timeline.get_timeline_type_display()} timeline"
            )
            return redirect(
                "mastodon_integration:account_timelines", account_id=account.id
            )
        else:
            context["form"] = form
            return self.render_to_response(context)


class EditTimelineView(LoginRequiredMixin, TemplateView):
    """View for editing an existing timeline configuration."""

    template_name = "mastodon_integration/edit_timeline.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        # Get the timeline
        timeline_id = kwargs.get("timeline_id")
        timeline = get_object_or_404(
            MastodonTimeline, id=timeline_id, account__user=self.request.user
        )

        context["timeline"] = timeline
        context["account"] = timeline.account
        context["page_title"] = f"Edit Timeline - {timeline}"

        # Fetch Mastodon lists for this account
        mastodon_lists = get_mastodon_lists(timeline.account) or []

        # Create form
        if "form" not in context:
            context["form"] = TimelineForm(
                instance=timeline,
                account=timeline.account,
                mastodon_lists=mastodon_lists,
            )

        return context

    def post(self, request, *args, **kwargs):
        context = self.get_context_data(**kwargs)
        timeline = context["timeline"]

        # Fetch Mastodon lists for form validation
        mastodon_lists = get_mastodon_lists(timeline.account) or []

        form = TimelineForm(
            request.POST,
            instance=timeline,
            account=timeline.account,
            mastodon_lists=mastodon_lists,
        )

        if form.is_valid():
            updated_timeline = form.save()
            messages.success(
                request,
                f"Updated {updated_timeline.get_timeline_type_display()} timeline",
            )
            return redirect(
                "mastodon_integration:account_timelines", account_id=timeline.account.id
            )
        else:
            context["form"] = form
            return self.render_to_response(context)


@require_http_methods(["POST"])
@csrf_protect
@login_required
def toggle_timeline(request, timeline_id):
    """
    AJAX endpoint to toggle timeline active status.
    """
    try:
        timeline = MastodonTimeline.objects.get(
            id=timeline_id, account__user=request.user
        )

        # Toggle the status
        timeline.is_active = not timeline.is_active
        timeline.save()

        status_text = "enabled" if timeline.is_active else "disabled"

        return JsonResponse(
            {
                "success": True,
                "is_active": timeline.is_active,
                "message": f"Timeline {status_text}",
            }
        )

    except MastodonTimeline.DoesNotExist:
        return JsonResponse(
            {"success": False, "error": "Timeline not found"}, status=404
        )
    except Exception as e:
        logger.error(f"Failed to toggle timeline {timeline_id}: {e}")
        return JsonResponse(
            {"success": False, "error": "Failed to toggle timeline"}, status=500
        )


@require_http_methods(["POST"])
@csrf_protect
@login_required
def delete_timeline(request, timeline_id):
    """
    Delete a timeline configuration.
    """
    try:
        timeline = MastodonTimeline.objects.get(
            id=timeline_id, account__user=request.user
        )

        account_id = timeline.account.id
        timeline_display = str(timeline)

        timeline.delete()

        messages.success(request, f"Deleted timeline: {timeline_display}")

    except MastodonTimeline.DoesNotExist:
        messages.error(request, "Timeline not found")
    except Exception as e:
        logger.error(f"Failed to delete timeline {timeline_id}: {e}")
        messages.error(request, "Failed to delete timeline")

    # Redirect back to account timelines or settings
    account_id = request.POST.get("account_id")
    if account_id:
        return redirect("mastodon_integration:account_timelines", account_id=account_id)
    else:
        return redirect("mastodon_integration:settings")


@require_http_methods(["GET"])
@login_required
def fetch_mastodon_lists(request, account_id):
    """
    AJAX endpoint to fetch Mastodon lists for an account.
    """
    try:
        account = MastodonAccount.objects.get(id=account_id, user=request.user)

        lists = get_mastodon_lists(account)
        if lists is None:
            return JsonResponse(
                {"success": False, "error": "Failed to fetch lists from Mastodon"},
                status=500,
            )

        return JsonResponse({"success": True, "lists": lists})

    except MastodonAccount.DoesNotExist:
        return JsonResponse(
            {"success": False, "error": "Account not found"}, status=404
        )
    except Exception as e:
        logger.error(f"Failed to fetch lists for account {account_id}: {e}")
        return JsonResponse(
            {"success": False, "error": "Failed to fetch lists"}, status=500
        )


@require_http_methods(["POST"])
@csrf_protect
@login_required
def test_timeline_connection(request, timeline_id):
    """
    AJAX endpoint to test if a timeline is accessible.
    """
    try:
        timeline = MastodonTimeline.objects.get(
            id=timeline_id, account__user=request.user
        )

        # Build config for testing
        config = timeline.config.copy()

        # Test the timeline access
        success, error_message = test_timeline_access(
            timeline.account, timeline.timeline_type, config
        )

        if success:
            return JsonResponse(
                {
                    "success": True,
                    "message": f"{timeline.get_timeline_type_display()} timeline is accessible",
                }
            )
        else:
            return JsonResponse(
                {
                    "success": False,
                    "error": error_message or "Timeline access test failed",
                }
            )

    except MastodonTimeline.DoesNotExist:
        return JsonResponse(
            {"success": False, "error": "Timeline not found"}, status=404
        )
    except Exception as e:
        logger.error(f"Failed to test timeline {timeline_id}: {e}")
        return JsonResponse(
            {"success": False, "error": "Failed to test timeline connection"},
            status=500,
        )


class TimelineMonitoringView(LoginRequiredMixin, TemplateView):
    """View for monitoring all timeline statuses across all accounts."""

    template_name = "mastodon_integration/monitoring.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["page_title"] = "Timeline Monitoring"

        # Get all timelines for the user with account info
        timelines = (
            MastodonTimeline.objects.filter(account__user=self.request.user)
            .select_related("account")
            .order_by("account__server_url", "account__username", "timeline_type")
        )

        # Group timelines by account for display
        accounts_with_timelines = {}
        for timeline in timelines:
            account_key = f"{timeline.account.username}@{timeline.account.server_url}"
            if account_key not in accounts_with_timelines:
                accounts_with_timelines[account_key] = {
                    "account": timeline.account,
                    "timelines": [],
                }
            accounts_with_timelines[account_key]["timelines"].append(timeline)

        context["accounts_with_timelines"] = accounts_with_timelines

        # Calculate summary statistics
        total_timelines = timelines.count()
        active_timelines = timelines.filter(
            is_active=True, account__is_active=True
        ).count()
        failed_timelines = timelines.filter(
            consecutive_failures__gte=settings.MASTODON_MAX_CONSECUTIVE_FAILURES
        ).count()

        context["stats"] = {
            "total": total_timelines,
            "active": active_timelines,
            "failed": failed_timelines,
            "healthy": active_timelines - failed_timelines,
        }

        return context
