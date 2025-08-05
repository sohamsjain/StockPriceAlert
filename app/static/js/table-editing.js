// Inline editing functionality
class TableEditing {
    constructor() {
        this.currentEditingCell = null;
        this.init();
    }

    init() {
        // Functions are attached to window for onclick handlers
        window.startEdit = this.startEdit.bind(this);
    }

    startEdit(cell) {
        // Don't allow editing if cell is updating
        if (cell.classList.contains('cell-updating')) {
            return;
        }

        // If this cell is already being edited, just focus and move cursor to end
        if (this.currentEditingCell === cell) {
            const existingInput = cell.querySelector('.edit-input');
            if (existingInput) {
                existingInput.focus();
                // Move cursor to end and clear selection
                const length = existingInput.value.length;
                existingInput.setSelectionRange(length, length);
            }
            return;
        }

        // Don't allow editing if already editing another cell
        if (this.currentEditingCell && this.currentEditingCell !== cell) {
            return;
        }

        this.currentEditingCell = cell;
        cell.classList.add('editing');

        const cellValue = cell.querySelector('.cell-value');
        const currentValue = cellValue.textContent.replace('₹ ', '').trim();

        // Create input element
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.className = 'edit-input';
        input.value = currentValue;

        // Replace cell content with input
        cellValue.style.display = 'none';
        cell.appendChild(input);

        // Focus and select all text
        input.focus();
        input.select();

        // Handle keyboard events
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                this.finishEdit(cell, input.value);
            } else if (e.key === 'Escape') {
                this.cancelEdit(cell);
            }
        });

        // Handle click outside
        const handleClickOutside = (e) => {
            if (!cell.contains(e.target)) {
                this.finishEdit(cell, input.value);
                document.removeEventListener('click', handleClickOutside);
            }
        };

        // Delay adding the click outside listener to prevent immediate trigger
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 100);
    }

    finishEdit(cell, newValue) {
        const input = cell.querySelector('.edit-input');
        const cellValue = cell.querySelector('.cell-value');
        const originalValue = cellValue.textContent.replace('₹ ', '').trim();

        if (!input) return;

        // Validate input
        const numValue = parseFloat(newValue);
        if (isNaN(numValue) || numValue <= 0) {
            this.cancelEdit(cell);
            return;
        }

        // Check if value actually changed
        if (parseFloat(originalValue) === numValue) {
            this.cancelEdit(cell);
            return;
        }

        // Show loading state
        cell.classList.add('cell-updating');

        // Prepare data for API call
        const zoneId = cell.dataset.zoneId;
        const field = cell.dataset.field;
        const updateData = {};
        updateData[field] = numValue;

        // Make API call to update the zone
        fetch(`/api/zones/${zoneId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                // Success - update the cell value
                cellValue.textContent = `₹ ${numValue.toFixed(2)}`;

                // Update the data-sort attribute for sorting
                cell.setAttribute('data-sort', field);

                console.log('Zone updated successfully');
            } else {
                // Error - revert to original value
                console.error('Failed to update zone:', data.error);
                alert(data.error || 'Failed to update zone');
            }
        })
        .catch(error => {
            console.error('Error updating zone:', error);
            alert('Failed to update zone');
        })
        .finally(() => {
            // Clean up editing state
            this.cleanupEdit(cell);
        });
    }

    cancelEdit(cell) {
        this.cleanupEdit(cell);
    }

    cleanupEdit(cell) {
        const input = cell.querySelector('.edit-input');
        const cellValue = cell.querySelector('.cell-value');

        if (input) {
            input.remove();
        }

        if (cellValue) {
            cellValue.style.display = 'block';
        }

        cell.classList.remove('editing', 'cell-updating');
        this.currentEditingCell = null;
    }
}

// Initialize the table editing
const tableEditing = new TableEditing();