// Table filtering functionality - Simplified inline version
class TableFilters {
    constructor() {
        this.filters = {
            symbol: '',
            status: [],
            type: []
        };
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupFilterEvents();
            this.updatePillCounts();
        });

        // Attach functions to window for onclick handlers
        window.applyFilters = this.applyFilters.bind(this);
        window.clearAllFilters = this.clearAllFilters.bind(this);
        window.toggleStatusFilter = this.toggleStatusFilter.bind(this);
        window.toggleTypeFilter = this.toggleTypeFilter.bind(this);
    }

    setupFilterEvents() {
        // Setup keyboard shortcut for symbol search
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'f' && e.ctrlKey) {
                e.preventDefault();
                document.getElementById('symbol-filter')?.focus();
            }
        });

        // Setup debounced input handlers
        const debounce = (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        // Debounced filter application for text inputs
        const debouncedApplyFilters = debounce(() => this.applyFilters(), 300);

        // Add event listeners when DOM is ready
        setTimeout(() => {
            document.getElementById('symbol-filter')?.addEventListener('input', debouncedApplyFilters);
        }, 100);
    }

    toggleStatusFilter(element, status) {
        element.classList.toggle('selected');

        if (this.filters.status.includes(status)) {
            this.filters.status = this.filters.status.filter(s => s !== status);
        } else {
            this.filters.status.push(status);
        }

        this.applyFilters();
    }

    toggleTypeFilter(element, type) {
        element.classList.toggle('selected');

        if (this.filters.type.includes(type)) {
            this.filters.type = this.filters.type.filter(t => t !== type);
        } else {
            this.filters.type.push(type);
        }

        this.applyFilters();
    }

    applyFilters() {
        // Get filter values
        this.filters.symbol = document.getElementById('symbol-filter')?.value.toLowerCase() || '';

        const rows = document.querySelectorAll('#tableBody tr:not(.new-zone-row)');
        let visibleCount = 0;

        rows.forEach(row => {
            const isEmpty = row.querySelector('.empty-state');
            if (isEmpty) return;

            let shouldShow = this.rowMatchesFilters(row);

            if (shouldShow) {
                row.classList.remove('row-filtered-out');
                row.classList.add('row-filtered-in');
                visibleCount++;
            } else {
                row.classList.add('row-filtered-out');
                row.classList.remove('row-filtered-in');
            }
        });

        this.updateResultsCount(visibleCount);
    }

    rowMatchesFilters(row) {
        // Symbol filter
        if (this.filters.symbol) {
            const symbol = this.getRowSymbol(row).toLowerCase();
            if (!symbol.includes(this.filters.symbol)) {
                return false;
            }
        }

        // Status filter
        if (this.filters.status.length > 0) {
            const status = this.getRowStatus(row);
            if (!this.filters.status.includes(status)) {
                return false;
            }
        }

        // Type filter
        if (this.filters.type.length > 0) {
            const type = this.getRowType(row);
            if (!this.filters.type.includes(type)) {
                return false;
            }
        }

        return true;
    }

    // Helper methods to extract data from rows
    getRowSymbol(row) {
        return row.querySelector('[data-symbol]')?.dataset.symbol || '';
    }

    getRowStatus(row) {
        // Skip if this is an empty state row
        if (row.querySelector('.empty-state')) {
            return null;
        }

        const statusElement = row.querySelector('[data-sort="status"] span');
        return statusElement?.textContent.trim() || '';
    }

    getRowType(row) {
        // Skip if this is an empty state row
        if (row.querySelector('.empty-state')) {
            return null;
        }

        const symbolCell = row.querySelector('.symbol-cell');
        if (!symbolCell) {
            return null;
        }

        const hasGreenDot = symbolCell.querySelector('.bg-green-700');
        return hasGreenDot ? 'Long Zone' : 'Short Zone';
    }

    clearAllFilters() {
        // Reset filter object
        this.filters = {
            symbol: '',
            status: [],
            type: []
        };

        // Clear form inputs
        const symbolFilter = document.getElementById('symbol-filter');
        if (symbolFilter) symbolFilter.value = '';

        // Clear all pill selections
        document.querySelectorAll('.filter-checkbox-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Apply cleared filters
        this.applyFilters();
    }

    updatePillCounts() {
        // Count zones by status
        const statusCounts = {
            'Active': 0,
            'Entry Hit': 0,
            'Target Hit': 0,
            'Stoploss Hit': 0,
            'Failed': 0
        };

        // Count zones by type
        const typeCounts = {
            'Long Zone': 0,
            'Short Zone': 0
        };

        // Count all rows (excluding new zone row and empty state)
        const rows = document.querySelectorAll('#tableBody tr:not(.new-zone-row)');

        rows.forEach(row => {
            // Skip empty state rows
            if (row.querySelector('.empty-state')) {
                return;
            }

            const status = this.getRowStatus(row);
            const type = this.getRowType(row);

            if (statusCounts.hasOwnProperty(status)) {
                statusCounts[status]++;
            }

            if (typeCounts.hasOwnProperty(type)) {
                typeCounts[type]++;
            }
        });

        // Update status count displays
        const activeCountEl = document.getElementById('active-count');
        const entryHitCountEl = document.getElementById('entry-hit-count');
        const targetHitCountEl = document.getElementById('target-hit-count');
        const stoplossHitCountEl = document.getElementById('stoploss-hit-count');
        const failedCountEl = document.getElementById('failed-count');
        const longZoneCountEl = document.getElementById('long-zone-count');
        const shortZoneCountEl = document.getElementById('short-zone-count');

        if (activeCountEl) activeCountEl.textContent = statusCounts['Active'];
        if (entryHitCountEl) entryHitCountEl.textContent = statusCounts['Entry Hit'];
        if (targetHitCountEl) targetHitCountEl.textContent = statusCounts['Target Hit'];
        if (stoplossHitCountEl) stoplossHitCountEl.textContent = statusCounts['Stoploss Hit'];
        if (failedCountEl) failedCountEl.textContent = statusCounts['Failed'];

        // Update type count displays
        if (longZoneCountEl) longZoneCountEl.textContent = typeCounts['Long Zone'];
        if (shortZoneCountEl) shortZoneCountEl.textContent = typeCounts['Short Zone'];
    }

    updateResultsCount(visibleCount) {
        const totalRows = document.querySelectorAll('#tableBody tr:not(.new-zone-row):not(.empty-state)').length;

        // Update main pagination info
        const showingElement = document.querySelector('#showing-info .font-semibold');
        if (showingElement) {
            showingElement.textContent = visibleCount;
        }
    }

    // Export filtered data
    exportFilteredData() {
        const visibleRows = document.querySelectorAll('#tableBody tr:not(.row-filtered-out):not(.new-zone-row):not(.empty-state)');
        const data = [];

        visibleRows.forEach(row => {
            data.push({
                symbol: this.getRowSymbol(row),
                status: this.getRowStatus(row),
                type: this.getRowType(row)
            });
        });

        return data;
    }
}

// Initialize the table filters
const tableFilters = new TableFilters();