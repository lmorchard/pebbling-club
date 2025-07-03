/**
 * Custom Element for Mastodon server connection form functionality
 * Handles server validation and OAuth initiation
 */

class MastodonServerConnectElement extends HTMLElement {
    private serverForm: HTMLFormElement | null = null;
    private serverConfirmation: HTMLElement | null = null;
    private validateBtn: HTMLButtonElement | null = null;
    private serverError: HTMLElement | null = null;
    private proceedBtn: HTMLButtonElement | null = null;
    private backBtn: HTMLButtonElement | null = null;
    private validateServerUrl: string | null = null;
    private initiateOauthUrl: string | null = null;
    private validatedServerInfo: any = null;

    connectedCallback() {
        this.init();
    }

    private init() {
        // Get URLs from data attributes
        this.validateServerUrl = this.dataset.validateServerUrl || null;
        this.initiateOauthUrl = this.dataset.initiateOauthUrl || null;

        // Find form elements
        this.serverForm = this.querySelector('#server-form') as HTMLFormElement;
        this.serverConfirmation = this.querySelector('#server-confirmation') as HTMLElement;
        this.validateBtn = this.querySelector('#validate-btn') as HTMLButtonElement;
        this.serverError = this.querySelector('#server-error') as HTMLElement;
        this.proceedBtn = this.querySelector('#proceed-oauth-btn') as HTMLButtonElement;
        this.backBtn = this.querySelector('#back-to-form-btn') as HTMLButtonElement;

        if (!this.serverForm || !this.validateServerUrl || !this.initiateOauthUrl) {
            console.error('Required elements or URLs not found');
            return;
        }

        // Set up event listeners
        this.serverForm.addEventListener('submit', (e) => this.handleServerValidation(e));
        
        if (this.backBtn) {
            this.backBtn.addEventListener('click', () => this.handleBackToForm());
        }
        
        if (this.proceedBtn) {
            this.proceedBtn.addEventListener('click', () => this.handleProceedToOAuth());
        }
    }

    private async handleServerValidation(e: Event) {
        e.preventDefault();

        const serverUrl = (this.querySelector('#server_url') as HTMLInputElement)?.value?.trim();
        
        if (!serverUrl) {
            this.showError('Please enter a server URL');
            return;
        }

        // Show loading state
        if (this.validateBtn) {
            this.validateBtn.disabled = true;
            this.validateBtn.textContent = 'Validating...';
        }
        this.hideError();

        try {
            const formData = new FormData();
            formData.append('server_url', serverUrl);
            
            // Get CSRF token
            const csrfToken = (document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement)?.value;
            if (csrfToken) {
                formData.append('csrfmiddlewaretoken', csrfToken);
            }

            const response = await fetch(this.validateServerUrl!, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.validatedServerInfo = data.server_info;
                this.showServerConfirmation(data.server_info);
            } else {
                this.showError(data.error || 'Failed to validate server');
            }
        } catch (error) {
            console.error('Validation error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            if (this.validateBtn) {
                this.validateBtn.disabled = false;
                this.validateBtn.textContent = 'Validate Server';
            }
        }
    }

    private handleBackToForm() {
        if (this.serverConfirmation && this.serverForm) {
            this.serverConfirmation.classList.add('hidden');
            this.serverForm.classList.remove('hidden');
        }
    }

    private handleProceedToOAuth() {
        if (!this.validatedServerInfo || !this.initiateOauthUrl) {
            return;
        }

        // Create form to submit server info for OAuth initiation
        const oauthForm = document.createElement('form');
        oauthForm.method = 'POST';
        oauthForm.action = this.initiateOauthUrl;

        // Add CSRF token
        const csrfToken = (document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement)?.value;
        if (csrfToken) {
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = 'csrfmiddlewaretoken';
            csrfInput.value = csrfToken;
            oauthForm.appendChild(csrfInput);
        }

        // Add server info
        const serverUrlInput = document.createElement('input');
        serverUrlInput.type = 'hidden';
        serverUrlInput.name = 'server_url';
        serverUrlInput.value = this.validatedServerInfo.server_url;
        oauthForm.appendChild(serverUrlInput);

        const serverTitleInput = document.createElement('input');
        serverTitleInput.type = 'hidden';
        serverTitleInput.name = 'server_title';
        serverTitleInput.value = this.validatedServerInfo.title;
        oauthForm.appendChild(serverTitleInput);

        const serverDescInput = document.createElement('input');
        serverDescInput.type = 'hidden';
        serverDescInput.name = 'server_description';
        serverDescInput.value = this.validatedServerInfo.description;
        oauthForm.appendChild(serverDescInput);

        // Submit form
        document.body.appendChild(oauthForm);
        oauthForm.submit();
    }

    private showServerConfirmation(serverInfo: any) {
        const serverNameElement = this.querySelector('#confirmed-server-name') as HTMLElement;
        const serverDescElement = this.querySelector('#confirmed-server-description') as HTMLElement;

        if (serverNameElement) {
            serverNameElement.textContent = serverInfo.title;
        }
        if (serverDescElement) {
            serverDescElement.textContent = serverInfo.description || 'No description available';
        }

        if (this.serverForm && this.serverConfirmation) {
            this.serverForm.classList.add('hidden');
            this.serverConfirmation.classList.remove('hidden');
        }
    }

    private showError(message: string) {
        if (this.serverError) {
            this.serverError.textContent = message;
            this.serverError.classList.remove('hidden');
        }
    }

    private hideError() {
        if (this.serverError) {
            this.serverError.classList.add('hidden');
        }
    }
}

customElements.define('pc-mastodon-server-connect', MastodonServerConnectElement);

export { MastodonServerConnectElement };