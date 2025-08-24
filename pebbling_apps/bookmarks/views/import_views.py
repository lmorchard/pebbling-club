"""Import functionality views."""

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import redirect
from django.utils import timezone
from django.views import View
from django.views.generic import TemplateView

from ..models import ImportJob
from ..forms import ImportJobForm
from ..services import save_import_file


class BookmarkImportView(LoginRequiredMixin, TemplateView):
    """Display the import page with form and job list."""

    template_name = "bookmarks/import.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["form"] = ImportJobForm()
        import_jobs = ImportJob.objects.filter(user=self.request.user).order_by(
            "-created_at"
        )
        context["import_jobs"] = import_jobs

        # Check if any jobs are pending or processing to enable auto-refresh
        context["needs_refresh"] = import_jobs.filter(
            status__in=["pending", "processing"]
        ).exists()

        return context


class BookmarkImportSubmitView(LoginRequiredMixin, View):
    """Handle import form submission."""

    def post(self, request):
        form = ImportJobForm(request.POST, request.FILES)

        if form.is_valid():
            # Save the uploaded file
            uploaded_file = form.cleaned_data["file"]
            file_path = save_import_file(uploaded_file, request.user)

            # Create import job
            import_job = ImportJob.objects.create(
                user=request.user,
                file_path=file_path,
                file_size=uploaded_file.size,
                import_options={
                    "duplicate_handling": form.cleaned_data["duplicate_handling"]
                },
            )

            # Trigger async processing task
            from ..tasks import process_import_job

            process_import_job.delay(import_job.id)

            messages.success(
                request, "Import job has been queued for background processing."
            )
            return redirect("bookmarks:import")
        else:
            # Add form errors to messages
            for field, errors in form.errors.items():
                for error in errors:
                    messages.error(request, f"{field}: {error}")
            return redirect("bookmarks:import")


class BookmarkImportRetryView(LoginRequiredMixin, View):
    """Handle retry action for failed import jobs."""

    def post(self, request):
        import_job_id = request.POST.get("import_job_id")

        if not import_job_id:
            messages.error(request, "Invalid import job.")
            return redirect("bookmarks:import")

        try:
            import_job = ImportJob.objects.get(id=import_job_id, user=request.user)

            if import_job.status != "failed":
                messages.error(request, "Only failed imports can be retried.")
                return redirect("bookmarks:import")

            # Reset job to pending status
            import_job.status = "pending"
            import_job.error_message = None
            import_job.failed_bookmark_details = []
            import_job.processed_bookmarks = 0
            import_job.failed_bookmarks = 0
            import_job.started_at = None
            import_job.completed_at = None
            import_job.save()

            # Trigger the processing task again
            from ..tasks import process_import_job

            process_import_job.delay(import_job.id)

            messages.success(request, "Import job has been queued for retry.")

        except ImportJob.DoesNotExist:
            messages.error(request, "Import job not found.")
        except Exception as e:
            messages.error(request, f"Failed to retry import: {str(e)}")

        return redirect("bookmarks:import")


class BookmarkImportCancelView(LoginRequiredMixin, View):
    """Handle cancel action for pending/processing import jobs."""

    def post(self, request):
        import_job_id = request.POST.get("import_job_id")

        if not import_job_id:
            messages.error(request, "Invalid import job.")
            return redirect("bookmarks:import")

        try:
            import_job = ImportJob.objects.get(id=import_job_id, user=request.user)

            if import_job.status not in ["pending", "processing"]:
                messages.error(
                    request, "Only pending or processing imports can be cancelled."
                )
                return redirect("bookmarks:import")

            # Update status to cancelled
            import_job.status = "cancelled"
            import_job.completed_at = timezone.now()
            import_job.save()

            # TODO: Attempt to revoke the Celery task if it's still pending
            # This would require task ID tracking or other task management

            messages.success(request, "Import job has been cancelled.")

        except ImportJob.DoesNotExist:
            messages.error(request, "Import job not found.")
        except Exception as e:
            messages.error(request, f"Failed to cancel import: {str(e)}")

        return redirect("bookmarks:import")
