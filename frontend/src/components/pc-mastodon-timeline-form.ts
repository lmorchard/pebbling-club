/**
 * Custom Element for Mastodon timeline form functionality
 * Handles dynamic form fields and list loading
 */

class MastodonTimelineFormElement extends HTMLElement {
    private timelineTypeSelect: HTMLSelectElement | null = null;
    private hashtagField: HTMLElement | null = null;
    private listField: HTMLElement | null = null;
    private listSelect: HTMLSelectElement | null = null;
    private listLoading: HTMLElement | null = null;
    private accountId: string | null = null;
    private fetchListsUrl: string | null = null;

    connectedCallback() {
        this.init();
    }

    private init() {
        // Get configuration from data attributes
        this.accountId = this.dataset.accountId || null;
        this.fetchListsUrl = this.dataset.fetchListsUrl || null;

        // Find form elements
        this.timelineTypeSelect = this.querySelector('#id_timeline_type') as HTMLSelectElement;
        this.hashtagField = this.querySelector('.hashtag-field') as HTMLElement;
        this.listField = this.querySelector('.list-field') as HTMLElement;
        this.listSelect = this.querySelector('#id_list_choice') as HTMLSelectElement;
        this.listLoading = this.querySelector('.list-loading') as HTMLElement;

        if (!this.timelineTypeSelect) {
            console.error('Timeline type select not found');
            return;
        }

        // Set up event listeners
        this.timelineTypeSelect.addEventListener('change', () => {
            this.handleTimelineTypeChange(this.timelineTypeSelect!.value);
        });

        // Set initial state
        this.handleTimelineTypeChange(this.timelineTypeSelect.value);
    }

    private handleTimelineTypeChange(timelineType: string) {
        // Hide all conditional fields
        if (this.hashtagField) {
            this.hashtagField.classList.add('hidden');
        }
        if (this.listField) {
            this.listField.classList.add('hidden');
        }

        // Show relevant field based on selection
        if (timelineType === 'HASHTAG' && this.hashtagField) {
            this.hashtagField.classList.remove('hidden');
            const hashtagInput = this.querySelector('#id_hashtag') as HTMLInputElement;
            if (hashtagInput) {
                hashtagInput.focus();
            }
        } else if (timelineType === 'LIST' && this.listField) {
            this.listField.classList.remove('hidden');
            
            // Load lists if not already loaded
            if (this.listSelect && this.listSelect.options.length <= 1) {
                this.loadMastodonLists();
            }
        }
    }

    private async loadMastodonLists() {
        if (!this.fetchListsUrl || !this.listSelect || !this.listLoading) {
            return;
        }

        this.listLoading.classList.remove('hidden');

        try {
            const response = await fetch(this.fetchListsUrl);
            const data = await response.json();

            if (data.success) {
                // Store current selection for edit forms
                const currentValue = this.listSelect.value;
                
                // Clear existing options
                this.listSelect.innerHTML = '<option value="">Select a list...</option>';

                // Add lists to select
                data.lists.forEach((list: { id: string; title: string }) => {
                    const option = document.createElement('option');
                    option.value = list.id;
                    option.textContent = list.title;
                    if (list.id === currentValue) {
                        option.selected = true;
                    }
                    this.listSelect!.appendChild(option);
                });

                if (data.lists.length === 0) {
                    this.listSelect.innerHTML = '<option value="">No lists found</option>';
                }
            } else {
                this.listSelect.innerHTML = `<option value="">Failed to load lists: ${data.error || 'Unknown error'}</option>`;
            }

        } catch (error) {
            console.error('Failed to load lists:', error);
            this.listSelect.innerHTML = '<option value="">Failed to load lists</option>';
        } finally {
            this.listLoading.classList.add('hidden');
        }
    }
}

customElements.define('pc-mastodon-timeline-form', MastodonTimelineFormElement);

export { MastodonTimelineFormElement };