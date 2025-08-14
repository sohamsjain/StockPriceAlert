// Table column visibility functionality
class TableColumnVisibility {
    constructor() {
        this.columns = [
            { id: 'checkbox', label: 'Select', visible: true, required: true },
            { id: 'symbol', label: 'Symbol', visible: true, required: true },
            { id: 'last', label: 'Last Price', visible: true, required: false },
            { id: 'entry', label: 'Entry', visible: true, required: false },
            { id: 'stoploss', label: 'Stoploss', visible: true, required: false },
            { id: 'target', label: 'Target', visible: true, required: false },
            { id: 'status', label: 'Status', visible: true, required: false },
            { id: 'created', label: 'Created', visible: true, required: false },
            { id: 'updated', label: 'Updated', visible: true, required: false },
            { id: 'view', label: 'View', visible: true, required: true }
        ];

        this.presets = {
            essential: ['checkbox', 'symbol', 'last', 'entry', 'stoploss', 'target', 'status', 'view'],
            all: this.columns.map(col => col.id)
        };

        this.storageKey = 'table_column_settings';
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.loadSettings();
            this.createColumnVisibilityUI();
            this.applyColumnVisibility();
            this.setupEventListeners();
        });
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const settings = JSON.parse(saved);
                if (settings.columns && Array.isArray(settings.columns)) {
                    // Merge saved settings with defaults
                    this.columns = this.columns.map(col => {
                        const savedCol = settings.columns.find(s => s.id === col.id);
                        return savedCol ? { ...col, visible: savedCol.visible } : col;
                    });
                }
            }
        } catch (error) {
            console.warn('Error loading column settings:', error);
        }
    }

    saveSettings() {
        try {
            const settings = {
                columns: this.columns,
                timestamp: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(settings));
        } catch (error) {
            console.warn('Error saving column settings:', error);
        }
    }

    createColumnVisibilityUI() {
        // Find where to insert the column visibility button (in the table header)
        const tableHeader = document.querySelector('.table-header .flex.flex-wrap.items-center.gap-3');
        if (!tableHeader) {
            console.warn('Table header not found, cannot add column visibility controls');
            return;
        }

        // Create the column visibility container
        const container = document.createElement('div');
        container.className = 'column-visibility-container';
        container.innerHTML = `
            <button type="button" class="column-visibility-button" id="columnVisibilityButton">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
            </button>

            <div class="column-visibility-dropdown" id="columnVisibilityDropdown">
                <div class="column-visibility-list" id="columnVisibilityList">
                    <!-- Column items will be inserted here -->
                </div>

                <div class="column-visibility-footer">
                    <button type="button" class="preset-button" onclick="tableColumnVisibility.applyPreset('essential')">Essential</button>
                    <button type="button" class="preset-button" onclick="tableColumnVisibility.applyPreset('all')">Show All</button>
                </div>
            </div>
        `;

        // Insert before the delete button if it exists, otherwise append
        const deleteButton = tableHeader.querySelector('#deleteButton');
        if (deleteButton) {
            tableHeader.insertBefore(container, deleteButton);
        } else {
            tableHeader.appendChild(container);
        }

        this.renderColumnList();
    }

    renderColumnList() {
        const list = document.getElementById('columnVisibilityList');
        if (!list) return;

        list.innerHTML = '';

        this.columns.forEach((column) => {
            if (!column.required) {
                const item = document.createElement('div');
                item.className = `column-visibility-item ${column.required ? 'column-required' : ''}`;
                item.dataset.columnId = column.id;

                item.innerHTML = `
                    <div class="column-item-content">
                        <span class="column-label">${column.label}</span>
                    </div>
                    <input type="checkbox"
                           class="w-6 h-6 bg-gray-100 border-gray-300 rounded text-primary-600 focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                           ${column.visible ? 'checked' : ''}
                           onchange="tableColumnVisibility.toggleColumn('${column.id}', this.checked)">
                `;

                list.appendChild(item);
            }
        });
    }

    setupEventListeners() {
        // Toggle dropdown
        const button = document.getElementById('columnVisibilityButton');
        const dropdown = document.getElementById('columnVisibilityDropdown');

        if (button && dropdown) {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!button.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });

            // Prevent dropdown from closing when clicking inside
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + C to toggle column visibility
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                if (dropdown) {
                    dropdown.classList.toggle('show');
                }
            }
        });
    }

    toggleColumn(columnId, visible) {
        const column = this.columns.find(col => col.id === columnId);
        if (column && !column.required) {
            column.visible = visible;
            this.applyColumnVisibility();
            this.saveSettings();
        }
    }

    applyPreset(presetName) {
        if (!this.presets[presetName]) return;

        const visibleColumns = this.presets[presetName];

        this.columns.forEach(column => {
            if (!column.required) {
                column.visible = visibleColumns.includes(column.id);
            }
        });

        this.renderColumnList();
        this.applyColumnVisibility();
        this.saveSettings();

        // Close dropdown
        const dropdown = document.getElementById('columnVisibilityDropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    applyColumnVisibility() {
        // Apply to header columns
        this.columns.forEach(column => {
            const headerCell = this.getHeaderCell(column.id);
            const columnCells = this.getColumnCells(column.id);

            if (column.visible) {
                headerCell?.classList.remove('column-hidden');
                columnCells.forEach(cell => cell?.classList.remove('column-hidden'));
            } else {
                headerCell?.classList.add('column-hidden');
                columnCells.forEach(cell => cell?.classList.add('column-hidden'));
            }
        });

        // Update table layout if needed
        this.updateTableLayout();
    }

    getHeaderCell(columnId) {
        // Map column IDs to their actual selectors
        const selectors = {
            'checkbox': 'th[data-column-id="checkbox"]',
            'symbol': 'th[data-column-id="symbol"]',
            'last': 'th[data-column-id="last"]',
            'entry': 'th[data-column-id="entry"]',
            'stoploss': 'th[data-column-id="stoploss"]',
            'target': 'th[data-column-id="target"]',
            'status': 'th[data-column-id="status"]',
            'created': 'th[data-column-id="created"]',
            'updated': 'th[data-column-id="updated"]',
            'view': 'th[data-column-id="view"]'
        };

        const selector = selectors[columnId];
        return selector ? document.querySelector(selector) : null;
    }

    getColumnCells(columnId) {
        const headerCell = this.getHeaderCell(columnId);
        if (!headerCell) return [];

        // Get the column index
        const headers = Array.from(document.querySelectorAll('thead th'));
        const columnIndex = headers.indexOf(headerCell);

        if (columnIndex === -1) return [];

        // Get all cells in that column
        const cells = [];
        const rows = document.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const cell = row.children[columnIndex];
            if (cell) cells.push(cell);
        });

        return cells;
    }

    updateTableLayout() {
        // Recalculate minimum table width based on visible columns
        const table = document.getElementById('sortableTable');
        if (!table) return;

        const visibleColumns = this.columns.filter(col => col.visible);
        const minWidth = visibleColumns.length * 120; // Minimum 120px per column

        table.style.minWidth = `${Math.max(minWidth, 800)}px`;
    }

    // Public methods for external use
    showColumn(columnId) {
        this.toggleColumn(columnId, true);
    }

    hideColumn(columnId) {
        this.toggleColumn(columnId, false);
    }

    isColumnVisible(columnId) {
        const column = this.columns.find(col => col.id === columnId);
        return column ? column.visible : false;
    }

    getVisibleColumns() {
        return this.columns.filter(col => col.visible).map(col => col.id);
    }

    resetToDefaults() {
        this.columns.forEach(column => {
            column.visible = true;
        });

        this.renderColumnList();
        this.applyColumnVisibility();
        this.saveSettings();
    }

    // Get column visibility statistics
    getColumnStats() {
        const total = this.columns.filter(col => !col.required).length;
        const visible = this.columns.filter(col => col.visible && !col.required).length;
        const hidden = total - visible;

        return {
            total,
            visible,
            hidden,
            percentage: Math.round((visible / total) * 100)
        };
    }

    // Bulk operations
    showAllColumns() {
        this.applyPreset('all');
    }

    hideAllOptionalColumns() {
        this.columns.forEach(column => {
            if (!column.required) {
                column.visible = false;
            }
        });

        this.renderColumnList();
        this.applyColumnVisibility();
        this.saveSettings();
    }

    // Toggle multiple columns at once
    toggleColumns(columnIds, visible) {
        columnIds.forEach(columnId => {
            const column = this.columns.find(col => col.id === columnId);
            if (column && !column.required) {
                column.visible = visible;
            }
        });

        this.renderColumnList();
        this.applyColumnVisibility();
        this.saveSettings();
    }
}

// Initialize the column visibility system
const tableColumnVisibility = new TableColumnVisibility();

// Export for global use
window.tableColumnVisibility = tableColumnVisibility;