from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from .forms import ProfileUpdateForm


@login_required
def profile_view(request):
    profile = request.user.profile  # Get the user's profile
    if request.method == "POST":
        form = ProfileUpdateForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            return redirect("profile")  # Redirect to profile page after saving
    else:
        form = ProfileUpdateForm(instance=profile)
    return render(request, "profiles/profile.html", {"form": form})
