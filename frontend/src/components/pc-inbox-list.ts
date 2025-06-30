import { LitElement } from "lit";

import "./pc-inbox-list.css";

export default class PCInboxListElement extends LitElement {
  disconnectAbortSignal?: AbortController;
  selectAllCheckbox?: HTMLInputElement | null;
  bulkActionSelect?: HTMLSelectElement | null;
  applyBulkButton?: HTMLButtonElement | null;
  selectionCountSpan?: HTMLElement | null;
  bulkActionsForm?: HTMLFormElement | null;
  selectedItems: Set<string> = new Set();

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    this.disconnectAbortSignal = new AbortController();
    
    // Find bulk action elements
    this.selectAllCheckbox = this.querySelector("#select-all");
    this.bulkActionSelect = this.querySelector("#bulk-action");
    this.applyBulkButton = this.querySelector("#apply-bulk");
    this.selectionCountSpan = this.querySelector("#selection-count");
    this.bulkActionsForm = this.querySelector("#bulk-actions-form");

    super.connectedCallback();
    this.setupEventListeners();
    this.updateUI();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectAbortSignal!.abort();
  }

  setupEventListeners() {
    // Listen for individual item selection changes
    this.addEventListener(
      "inbox-item-selection-changed",
      this.handleItemSelectionChanged.bind(this),
      { signal: this.disconnectAbortSignal!.signal }
    );

    // Handle "Select All" checkbox
    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.addEventListener(
        "change",
        this.handleSelectAllChanged.bind(this),
        { signal: this.disconnectAbortSignal!.signal }
      );
    }

    // Handle bulk action application
    if (this.applyBulkButton) {
      this.applyBulkButton.addEventListener(
        "click",
        this.handleApplyBulk.bind(this),
        { signal: this.disconnectAbortSignal!.signal }
      );
    }
  }

  handleItemSelectionChanged(event: CustomEvent) {
    const { itemId, selected } = event.detail;
    
    if (selected) {
      this.selectedItems.add(itemId);
    } else {
      this.selectedItems.delete(itemId);
    }

    this.updateUI();
  }

  handleSelectAllChanged() {
    const isChecked = this.selectAllCheckbox?.checked || false;
    const itemCheckboxes = this.querySelectorAll<HTMLInputElement>(".item-checkbox");

    itemCheckboxes.forEach((checkbox) => {
      checkbox.checked = isChecked;
      if (isChecked) {
        this.selectedItems.add(checkbox.value);
      } else {
        this.selectedItems.delete(checkbox.value);
      }
    });

    this.updateUI();
  }

  handleApplyBulk() {
    const selectedAction = this.bulkActionSelect?.value;
    
    if (!selectedAction || this.selectedItems.size === 0) {
      return;
    }

    // Show confirmation dialog
    const itemCount = this.selectedItems.size;
    const actionText = this.getActionDisplayName(selectedAction);
    
    let confirmMessage = `${actionText} ${itemCount} item${itemCount > 1 ? 's' : ''}?`;
    
    if (selectedAction === 'trash') {
      confirmMessage = `Permanently delete ${itemCount} item${itemCount > 1 ? 's' : ''}? This action cannot be undone.`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    // Submit the bulk action
    this.submitBulkAction(selectedAction);
  }

  getActionDisplayName(action: string): string {
    const actions: { [key: string]: string } = {
      'mark_read': 'Mark as read',
      'mark_unread': 'Mark as unread',
      'archive': 'Archive',
      'trash': 'Delete',
      'add_to_collection': 'Add to collection'
    };
    return actions[action] || action;
  }

  submitBulkAction(action: string) {
    if (!this.bulkActionsForm) return;

    // Create hidden input field with selected item IDs
    const selectedItemsInput = document.createElement('input');
    selectedItemsInput.type = 'hidden';
    selectedItemsInput.name = 'selected_items';
    selectedItemsInput.value = Array.from(this.selectedItems).join(',');

    // Create hidden input for action type
    const actionInput = document.createElement('input');
    actionInput.type = 'hidden';
    actionInput.name = 'bulk_action';
    actionInput.value = action;

    // Clear any existing hidden inputs
    this.bulkActionsForm.querySelectorAll('input[type="hidden"][name="selected_items"], input[type="hidden"][name="bulk_action"]').forEach(input => input.remove());

    // Add the hidden inputs
    this.bulkActionsForm.appendChild(selectedItemsInput);
    this.bulkActionsForm.appendChild(actionInput);

    // Set form action URL
    this.bulkActionsForm.action = `/inbox/bulk/${action.replace('_', '-')}/`;

    // Submit the form
    this.bulkActionsForm.submit();
  }

  updateUI() {
    const count = this.selectedItems.size;
    const hasSelection = count > 0;

    // Update selection count display
    if (this.selectionCountSpan) {
      this.selectionCountSpan.textContent = hasSelection ? 
        `${count} item${count > 1 ? 's' : ''} selected` : '';
    }

    // Enable/disable bulk action controls
    if (this.bulkActionSelect) {
      this.bulkActionSelect.disabled = !hasSelection;
    }
    
    if (this.applyBulkButton) {
      this.applyBulkButton.disabled = !hasSelection;
    }

    // Update "Select All" checkbox state
    if (this.selectAllCheckbox) {
      const itemCheckboxes = this.querySelectorAll<HTMLInputElement>(".item-checkbox");
      const checkedCount = Array.from(itemCheckboxes).filter(cb => cb.checked).length;
      
      if (checkedCount === 0) {
        this.selectAllCheckbox.checked = false;
        this.selectAllCheckbox.indeterminate = false;
      } else if (checkedCount === itemCheckboxes.length) {
        this.selectAllCheckbox.checked = true;
        this.selectAllCheckbox.indeterminate = false;
      } else {
        this.selectAllCheckbox.checked = false;
        this.selectAllCheckbox.indeterminate = true;
      }
    }
  }

  render() {
    // Additional rendering logic can go here if needed
  }
}


customElements.define("pc-inbox-list", PCInboxListElement);