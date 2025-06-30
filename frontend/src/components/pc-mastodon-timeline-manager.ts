/**
 * Custom Element for Mastodon timeline management functionality
 * Handles timeline toggle and test operations
 */

class MastodonTimelineManagerElement extends HTMLElement {
    connectedCallback() {
        this.init();
    }

    private init() {
        // Handle timeline toggle buttons
        this.querySelectorAll('.toggle-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const button = e.target as HTMLButtonElement;
                const timelineId = button.dataset.timelineId;
                const currentState = button.dataset.currentState === 'true';
                
                if (timelineId) {
                    this.toggleTimeline(timelineId, !currentState, button);
                }
            });
        });

        // Handle timeline test buttons
        this.querySelectorAll('.test-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const button = e.target as HTMLButtonElement;
                const timelineId = button.dataset.timelineId;
                
                if (timelineId) {
                    this.testTimeline(timelineId, button);
                }
            });
        });
    }

    private async toggleTimeline(timelineId: string, newState: boolean, button: HTMLButtonElement) {
        const originalText = button.textContent || '';
        button.disabled = true;
        button.textContent = 'Processing...';

        try {
            const formData = new FormData();
            const csrfToken = (document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement)?.value;
            if (csrfToken) {
                formData.append('csrfmiddlewaretoken', csrfToken);
            }

            const response = await fetch(`/mastodon/timelines/${timelineId}/toggle/`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                // Update button state
                button.dataset.currentState = data.is_active ? 'true' : 'false';
                button.textContent = data.is_active ? 'Disable' : 'Enable';

                // Update status indicator
                const card = button.closest('.timeline-card');
                if (card) {
                    const statusIndicator = card.querySelector('.status-indicator');
                    if (statusIndicator) {
                        statusIndicator.className = `status-indicator ${data.is_active ? 'active' : 'inactive'}`;
                        statusIndicator.textContent = data.is_active ? 'Active' : 'Disabled';
                    }
                }

                // Show success message
                this.showMessage(data.message, 'success');
            } else {
                throw new Error(data.error || 'Failed to toggle timeline');
            }
        } catch (error) {
            console.error('Toggle failed:', error);
            this.showMessage('Failed to toggle timeline', 'error');
            button.textContent = originalText;
        } finally {
            button.disabled = false;
        }
    }

    private async testTimeline(timelineId: string, button: HTMLButtonElement) {
        const originalText = button.textContent || '';
        button.disabled = true;
        button.textContent = 'Testing...';

        try {
            const formData = new FormData();
            const csrfToken = (document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement)?.value;
            if (csrfToken) {
                formData.append('csrfmiddlewaretoken', csrfToken);
            }

            const response = await fetch(`/mastodon/timelines/${timelineId}/test/`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage(data.message, 'success');
            } else {
                this.showMessage(data.error || 'Timeline test failed', 'error');
            }
        } catch (error) {
            console.error('Timeline test failed:', error);
            this.showMessage('Failed to test timeline connection', 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    private showMessage(text: string, type: string) {
        // Find or create messages container
        let messagesDiv = this.querySelector('.messages');
        if (!messagesDiv) {
            messagesDiv = this.createMessagesDiv();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = text;
        messagesDiv.appendChild(messageDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    private createMessagesDiv(): HTMLElement {
        const messagesDiv = document.createElement('div');
        messagesDiv.className = 'messages';
        
        const accountSummary = this.querySelector('.account-summary');
        if (accountSummary && accountSummary.parentNode) {
            accountSummary.parentNode.insertBefore(messagesDiv, accountSummary);
        } else {
            this.insertBefore(messagesDiv, this.firstChild);
        }
        
        return messagesDiv;
    }
}

customElements.define('pc-mastodon-timeline-manager', MastodonTimelineManagerElement);

export { MastodonTimelineManagerElement };