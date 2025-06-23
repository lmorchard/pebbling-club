from django.shortcuts import render, redirect
from django.contrib.auth.views import LoginView
from django.contrib.auth import login, logout
from django.conf import settings
from django.http import Http404
from .forms import CustomUserCreationForm


class CustomLoginView(LoginView):
    template_name = "users/login.html"


def register(request):
    # Check if user registration is allowed
    if not getattr(settings, "ALLOW_USER_REGISTRATION", True):
        raise Http404("User registration is disabled")

    if request.method == "POST":
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)  # Auto-login after registration
            return redirect(
                "profiles:view", user.username
            )  # Redirect to a dashboard or home page
    else:
        form = CustomUserCreationForm()
    return render(request, "users/register.html", {"form": form})


def logout_view(request):
    logout(request)
    return redirect("users:login")  # Redirect to login after logging out
