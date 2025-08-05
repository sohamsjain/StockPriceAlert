// Core table functionality
class TableCore {
    constructor() {
        this.currentSort = { column: null, direction: 'asc' };
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeUI();
            this.setupGlobalKeyboardShortcuts();
        });
    }

    initializeUI() {
        this.updateHeaderCheckbox();
        this.updateUI();
        this.setupSymbolCellClicks();
    }

    setupGlobalKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Press 'T' to open new zone form (only if not already editing or in input field)
            if (e.key.toLowerCase() === 't' &&
                !e.target.matches('input, textarea, select') &&
                !document.getElementById('new-zone-row')) {
                e.preventDefault();
                window.addNewZoneRow();
            }
        });
    }

    setupSymbolCellClicks() {
        document.querySelectorAll('.symbol-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                const symbol = cell.dataset.symbol;
                this.openChart(symbol);
            });
        });
    }

    openChart(symbol) {
        const url = `https://www.tradingview.com/chart/?symbol=${symbol}`;
        window.open(url, '_blank');
    }

    updateHeaderCheckbox() {
        const headerCheckbox = document.getElementById('checkbox-all');
        const rowCheckboxes = document.querySelectorAll('.row-checkbox');

        if (!headerCheckbox) return;

        const checkedCount = document.querySelectorAll('.row-checkbox:checked').length;
        const totalCount = rowCheckboxes.length;

        if (checkedCount === 0) {
            headerCheckbox.checked = false;
            headerCheckbox.indeterminate = false;
        } else if (checkedCount === totalCount) {
            headerCheckbox.checked = true;
            headerCheckbox.indeterminate = false;
        } else {
            headerCheckbox.checked = false;
            headerCheckbox.indeterminate = true;
        }
    }

    updateUI() {
        const checkedCount = document.querySelectorAll('.row-checkbox:checked').length;
        const deleteButton = document.getElementById('deleteButton');
        const newZoneButton = document.getElementById('newZoneButton');
        const deleteButtonText = document.getElementById('deleteButtonText');
        const showingInfo = document.getElementById('showing-info');
        const selectedInfo = document.getElementById('selected-info');
        const selectedCount = document.getElementById('selected-count');

        if (checkedCount > 0) {
            // Show delete button, hide new zone button
            deleteButton?.classList.remove('hidden');
            newZoneButton?.classList.add('hidden');

            // Update delete button text
            if (deleteButtonText) {
                deleteButtonText.textContent = `Delete (${checkedCount})`;
            }

            // Show selection info, hide normal pagination
            showingInfo?.classList.add('hidden');
            selectedInfo?.classList.remove('hidden');
            if (selectedCount) {
                selectedCount.textContent = checkedCount;
            }
        } else {
            // Hide delete button, show new zone button
            deleteButton?.classList.add('hidden');
            newZoneButton?.classList.remove('hidden');

            // Show normal pagination, hide selection info
            showingInfo?.classList.remove('hidden');
            selectedInfo?.classList.add('hidden');
        }
    }

    showEmptyState() {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <div class="empty-state-icon">
                        <svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <p class="text-gray-500 dark:text-gray-400 mb-6">Get started by creating your first trading zone</p>
                    <button onclick="addNewZoneRow()" class="create-zone-button">
                        <svg class="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                        </svg>
                        Create Zone (Press T)
                    </button>
                </td>
            </tr>
        `;
    }
}

// Initialize the table core
const tableCore = new TableCore();