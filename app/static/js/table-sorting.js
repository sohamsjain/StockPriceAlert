// Table sorting functionality
class TableSorting {
    constructor() {
        this.currentSort = { column: null, direction: 'asc' };
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupSortingEvents();
        });
    }

    setupSortingEvents() {
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', (e) => {
                // Don't sort if clicking on resize handle
                if (e.target.classList.contains('resize-handle') ||
                    e.target.closest('.resize-handle')) {
                    return;
                }

                const column = header.dataset.column;
                const type = header.dataset.type;

                // Determine sort direction
                if (this.currentSort.column === column) {
                    this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this.currentSort.direction = 'asc';
                }
                this.currentSort.column = column;

                // Update visual indicators
                this.updateSortIndicators(header, this.currentSort.direction);

                // Sort the table
                this.sortTable(column, type, this.currentSort.direction);
            });
        });
    }

    updateSortIndicators(activeHeader, direction) {
        // Remove sort classes from all headers
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });

        // Add sort class to active header
        activeHeader.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }

    sortTable(column, type, direction) {
        const tbody = document.getElementById('tableBody');
        const rows = Array.from(tbody.querySelectorAll('tr:not(.new-zone-row):not(.empty-state)'));

        rows.sort((a, b) => {
            const aCell = a.querySelector(`[data-sort="${column}"]`);
            const bCell = b.querySelector(`[data-sort="${column}"]`);

            if (!aCell || !bCell) return 0;

            let aValue, bValue;

            // Handle different data types
            switch (type) {
                case 'number':
                    // Extract numeric values, handle '-' for missing values
                    aValue = aCell.textContent.trim();
                    bValue = bCell.textContent.trim();
                    aValue = aValue === '-' ? -Infinity : parseFloat(aValue.replace(/[^\d.-]/g, ''));
                    bValue = bValue === '-' ? -Infinity : parseFloat(bValue.replace(/[^\d.-]/g, ''));
                    break;
                case 'date':
                    // Use data-sort-value if available (contains full ISO date), otherwise fall back to text content
                    aValue = aCell.dataset.sortValue || aCell.textContent.trim();
                    bValue = bCell.dataset.sortValue || bCell.textContent.trim();
                    aValue = new Date(aValue);
                    bValue = new Date(bValue);
                    break;
                case 'text':
                default:
                    aValue = aCell.textContent.trim().toLowerCase();
                    bValue = bCell.textContent.trim().toLowerCase();
                    break;
            }

            // Compare values
            let comparison = 0;
            if (aValue < bValue) comparison = -1;
            else if (aValue > bValue) comparison = 1;

            return direction === 'asc' ? comparison : -comparison;
        });

        // Clear tbody and append sorted rows, maintaining new zone row at top if it exists
        const newZoneRow = document.getElementById('new-zone-row');
        tbody.innerHTML = '';

        if (newZoneRow) {
            tbody.appendChild(newZoneRow);
        }

        rows.forEach(row => tbody.appendChild(row));
    }
}

// Initialize the table sorting
const tableSorting = new TableSorting();