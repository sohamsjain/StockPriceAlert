// Checkbox selection functionality
class TableSelection {
    constructor() {
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupCheckboxEvents();
        });
    }

    setupCheckboxEvents() {
        const headerCheckbox = document.getElementById('checkbox-all');
        const rowCheckboxes = document.querySelectorAll('.row-checkbox');

        // Header checkbox event
        if (headerCheckbox) {
            headerCheckbox.addEventListener('change', () => {
                const isChecked = headerCheckbox.checked;
                rowCheckboxes.forEach(checkbox => {
                    checkbox.checked = isChecked;
                });
                tableCore.updateUI();
            });
        }

        // Row checkbox events
        rowCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                tableCore.updateHeaderCheckbox();
                tableCore.updateUI();
            });
        });

        // Prevent editing when clicking on checkbox
        document.addEventListener('click', (e) => {
            if (e.target.closest('.row-checkbox') || e.target.closest('input[type="checkbox"]')) {
                e.stopPropagation();
            }
        });
    }
}

// Delete selected zones function
window.deleteSelectedZones = function() {
    const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
    const zoneIds = Array.from(checkedCheckboxes).map(cb => cb.value);

    if (zoneIds.length === 0) {
        return;
    }

    // Use fetch to send DELETE request to API endpoint
    const apiUrl = `/api/zones?ids=${zoneIds.join(',')}`;

    fetch(apiUrl, {
        method: 'DELETE',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
        }
    }).then(response => {
        return response.json().then(data => {
            if (response.ok) {
                // Remove deleted rows from DOM
                checkedCheckboxes.forEach(checkbox => {
                    const row = checkbox.closest('tr');
                    if (row) {
                        row.remove();
                    }
                });

                // Check if table is now empty and show empty state
                const remainingRows = document.querySelectorAll('#tableBody tr:not(.new-zone-row)').length;
                if (remainingRows === 0) {
                    tableCore.showEmptyState();
                }

                // Reset UI
                tableCore.updateHeaderCheckbox();
                tableCore.updateUI();

                // Update the total count in the footer
                const showingElement = document.querySelector('#showing-info .font-semibold');
                const totalZonesElement = document.getElementById('total-zones');

                if (showingElement) {
                    showingElement.textContent = remainingRows;
                }
                if (totalZonesElement) {
                    totalZonesElement.textContent = remainingRows;
                }

                // Show success message if available
                if (data.message) {
                    console.log(data.message);
                }
            } else {
                // Handle errors
                console.error('Failed to delete zones:', data.error || 'Unknown error');
            }
        });
    }).catch(error => {
        console.error('Error deleting zones:', error);
    });
};

// Initialize the table selection
const tableSelection = new TableSelection();