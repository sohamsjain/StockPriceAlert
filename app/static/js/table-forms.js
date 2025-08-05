// New zone form functionality
class TableForms {
    constructor() {
        this.currentDropdownIndex = -1;
        this.dropdownItems = [];
        this.symbolSearchTimeout = null;
        this.init();
    }

    init() {
        // Attach functions to window for onclick handlers
        window.addNewZoneRow = this.addNewZoneRow.bind(this);
        window.createZone = this.createZone.bind(this);
        window.cancelNewZone = this.cancelNewZone.bind(this);
        window.selectSymbol = this.selectSymbol.bind(this);
        window.selectSymbolByIndex = this.selectSymbolByIndex.bind(this);
    }

    addNewZoneRow() {
        // Check if there's already a new zone row
        if (document.getElementById('new-zone-row')) {
            return;
        }

        const tbody = document.getElementById('tableBody');

        // Remove empty state if it exists
        const emptyState = tbody.querySelector('.empty-state');
        if (emptyState) {
            emptyState.closest('tr').remove();
        }

        const newRow = document.createElement('tr');
        newRow.id = 'new-zone-row';
        newRow.className = 'new-zone-row border-b dark:border-gray-600';

        newRow.innerHTML = `
            <td class="w-4 px-4 py-2">
                <div class="flex items-center">
                    <svg class="w-6 h-6 text-blue-600" fill="#4B5563" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
                    </svg>
                </div>
            </td>
            <td class="px-4 py-2 font-medium">
                <div class="relative">
                    <input type="text" id="symbol-input" class="form-input" placeholder="Search symbol..." autocomplete="off">
                    <div id="symbol-dropdown" class="symbol-dropdown hidden"></div>
                </div>
            </td>
            <td class="px-4 py-2 font-medium text-right">
                <span id="last-price" class="text-white">-</span>
            </td>
            <td class="px-4 py-2 font-medium text-right">
                <input type="number" id="entry-input" class="form-input" placeholder="Entry" step="0.01">
            </td>
            <td class="px-4 py-2 font-medium text-right">
                <input type="number" id="stoploss-input" class="form-input" placeholder="Stoploss" step="0.01">
            </td>
            <td class="px-4 py-2 font-medium text-right">
                <input type="number" id="target-input" class="form-input" placeholder="Target" step="0.01">
            </td>
            <td class="px-4 py-2 font-medium text-right">
                <span id="zone-type" class="text-sm text-gray-500"></span>
            </td>
            <td class="px-4 py-2 text-right">
                <input type="text" id="notes-input" class="form-input" placeholder="Notes (optional)">
            </td>
            <td class="px-4 py-2 justify-end flex gap-1">
                <button id="create-button" class="px-2 py-1 text-base bg-green-700 text-white rounded hover:bg-green-800">
                    Create
                </button>
                <button id="cancel-button" class="px-2 py-1 text-base bg-gray-700 text-white rounded hover:bg-gray-800">
                    Cancel
                </button>
            </td>
            <td class="px-4 py-2 text-right">
            </td>
        `;

        // Insert at the beginning of tbody
        tbody.insertBefore(newRow, tbody.firstChild);

        // Setup enhanced symbol search with keyboard navigation
        this.setupEnhancedSymbolSearch();

        // Setup zone type inference
        this.setupZoneTypeInference();

        // Setup form keyboard navigation
        this.setupFormKeyboardNavigation();

        // Focus on symbol input
        document.getElementById('symbol-input').focus();
    }

    setupEnhancedSymbolSearch() {
        const symbolInput = document.getElementById('symbol-input');
        const dropdown = document.getElementById('symbol-dropdown');

        symbolInput.addEventListener('input', () => {
            const query = symbolInput.value.trim();
            this.currentDropdownIndex = -1; // Reset selection

            clearTimeout(this.symbolSearchTimeout);

            if (query.length < 1) {
                dropdown.classList.add('hidden');
                this.dropdownItems = [];
                return;
            }

            this.symbolSearchTimeout = setTimeout(() => {
                fetch(`/api/tickers/search?q=${encodeURIComponent(query)}`)
                    .then(response => response.json())
                    .then(data => {
                        this.displayEnhancedSymbolResults(data.tickers);
                    })
                    .catch(error => {
                        console.error('Error searching symbols:', error);
                    });
            }, 300);
        });

        // Enhanced keyboard navigation for symbol input
        symbolInput.addEventListener('keydown', (e) => {
            const dropdown = document.getElementById('symbol-dropdown');

            if (dropdown.classList.contains('hidden')) {
                // If dropdown is hidden, handle Tab normally
                if (e.key === 'Tab') {
                    return; // Allow default tab behavior
                }
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigateDropdown(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigateDropdown(-1);
                    break;
                case 'Tab':
                    e.preventDefault();
                    this.selectCurrentOrFirstOption();
                    this.focusNextField('entry-input');
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (this.currentDropdownIndex >= 0) {
                        this.selectCurrentOrFirstOption();
                        this.focusNextField('entry-input');
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    dropdown.classList.add('hidden');
                    this.currentDropdownIndex = -1;
                    break;
            }
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!symbolInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
                this.currentDropdownIndex = -1;
            }
        });
    }

    displayEnhancedSymbolResults(tickers) {
        const dropdown = document.getElementById('symbol-dropdown');

        if (tickers.length === 0) {
            dropdown.classList.add('hidden');
            this.dropdownItems = [];
            return;
        }

        this.dropdownItems = tickers;
        this.currentDropdownIndex = -1; // Reset selection

        dropdown.innerHTML = tickers.map((ticker, index) => `
            <div class="symbol-option" data-index="${index}" onclick="selectSymbolByIndex(${index})">
                <div class="font-medium">${ticker.symbol}</div>
                <div class="text-xs text-gray-100">₹${ticker.last_price ? ticker.last_price.toFixed(2) : '-'}</div>
            </div>
        `).join('');

        dropdown.classList.remove('hidden');
    }

    navigateDropdown(direction) {
        if (this.dropdownItems.length === 0) return;

        // Remove highlight from current item
        if (this.currentDropdownIndex >= 0) {
            const currentItem = document.querySelector(`[data-index="${this.currentDropdownIndex}"]`);
            if (currentItem) {
                currentItem.style.backgroundColor = '';
            }
        }

        // Update index
        this.currentDropdownIndex += direction;

        // Wrap around
        if (this.currentDropdownIndex >= this.dropdownItems.length) {
            this.currentDropdownIndex = 0;
        } else if (this.currentDropdownIndex < 0) {
            this.currentDropdownIndex = this.dropdownItems.length - 1;
        }

        // Highlight new item
        const newItem = document.querySelector(`[data-index="${this.currentDropdownIndex}"]`);
        if (newItem) {
            newItem.style.backgroundColor = '#374151'; // Dark gray highlight
            newItem.scrollIntoView({ block: 'nearest' });
        }
    }

    selectCurrentOrFirstOption() {
        const indexToSelect = this.currentDropdownIndex >= 0 ? this.currentDropdownIndex : 0;
        if (this.dropdownItems[indexToSelect]) {
            this.selectSymbolByIndex(indexToSelect);
        }
    }

    selectSymbolByIndex(index) {
        if (!this.dropdownItems[index]) return;

        const ticker = this.dropdownItems[index];
        document.getElementById('symbol-input').value = ticker.symbol;
        document.getElementById('last-price').textContent = ticker.last_price ? `₹ ${ticker.last_price.toFixed(2)}` : '-';
        document.getElementById('symbol-dropdown').classList.add('hidden');
        this.currentDropdownIndex = -1;
    }

    selectSymbol(symbol, lastPrice) {
        document.getElementById('symbol-input').value = symbol;
        document.getElementById('last-price').textContent = lastPrice ? `₹ ${lastPrice.toFixed(2)}` : '-';
        document.getElementById('symbol-dropdown').classList.add('hidden');
        this.currentDropdownIndex = -1;
    }

    focusNextField(fieldId) {
        setTimeout(() => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.focus();
                field.select();
            }
        }, 100);
    }

    setupFormKeyboardNavigation() {
        const form = document.getElementById('new-zone-row');
        if (!form) return;

        // Add keyboard navigation for the entire form
        form.addEventListener('keydown', (e) => {
            // Handle global form shortcuts
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.createZone();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelNewZone();
                return;
            }
        });

        // Enhanced navigation for input fields
        const inputFields = ['symbol-input', 'entry-input', 'stoploss-input', 'target-input', 'notes-input'];

        inputFields.forEach((fieldId, index) => {
            const field = document.getElementById(fieldId);
            if (!field) return;

            field.addEventListener('keydown', (e) => {
                // Skip symbol input special handling (already handled above)
                if (fieldId === 'symbol-input') return;

                if (e.key === 'Tab') {
                    // Let default tab behavior work for these fields
                    return;
                }

                if (e.key === 'Enter') {
                    e.preventDefault();

                    // If this is the last field or notes field, create the zone
                    if (index === inputFields.length - 1 || fieldId === 'notes-input') {
                        this.createZone();
                    } else {
                        // Move to next field
                        const nextIndex = index + 1;
                        if (nextIndex < inputFields.length) {
                            this.focusNextField(inputFields[nextIndex]);
                        }
                    }
                }
            });
        });

        // Button event handlers
        document.getElementById('create-button').addEventListener('click', () => this.createZone());
        document.getElementById('cancel-button').addEventListener('click', () => this.cancelNewZone());

        // Button keyboard handlers
        document.getElementById('create-button').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.createZone();
            }
        });

        document.getElementById('cancel-button').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.cancelNewZone();
            }
        });
    }

    setupZoneTypeInference() {
        const entryInput = document.getElementById('entry-input');
        const stoplossInput = document.getElementById('stoploss-input');
        const targetInput = document.getElementById('target-input');
        const zoneTypeSpan = document.getElementById('zone-type');

        const updateZoneType = () => {
            const entry = parseFloat(entryInput.value);
            const stoploss = parseFloat(stoplossInput.value);
            const target = parseFloat(targetInput.value);

            if (!isNaN(entry) && !isNaN(stoploss) && !isNaN(target)) {
                let type = '';
                let color = '';

                if (target > entry && stoploss < entry) {
                    type = 'Long Zone';
                    color = 'text-green-600';
                } else if (target < entry && stoploss > entry) {
                    type = 'Short Zone';
                    color = 'text-red-600';
                } else {
                    type = 'Invalid';
                    color = 'text-red-500';
                }

                zoneTypeSpan.textContent = type;
                zoneTypeSpan.className = `text-sm font-medium ${color}`;
            } else {
                zoneTypeSpan.textContent = '-';
                zoneTypeSpan.className = 'text-sm text-gray-500';
            }
        };

        entryInput.addEventListener('input', updateZoneType);
        stoplossInput.addEventListener('input', updateZoneType);
        targetInput.addEventListener('input', updateZoneType);
    }

    createZone() {
        const symbolInput = document.getElementById('symbol-input');
        const entryInput = document.getElementById('entry-input');
        const stoplossInput = document.getElementById('stoploss-input');
        const targetInput = document.getElementById('target-input');
        const notesInput = document.getElementById('notes-input');

        // Validate inputs
        if (!symbolInput.value.trim()) {
            alert('Please select a symbol');
            symbolInput.focus();
            return;
        }

        const entry = parseFloat(entryInput.value);
        const stoploss = parseFloat(stoplossInput.value);
        const target = parseFloat(targetInput.value);

        if (isNaN(entry) || isNaN(stoploss) || isNaN(target)) {
            alert('Please enter valid numbers for entry, stoploss, and target');

            // Focus on first invalid field
            if (isNaN(entry)) entryInput.focus();
            else if (isNaN(stoploss)) stoplossInput.focus();
            else if (isNaN(target)) targetInput.focus();

            return;
        }

        // Disable form during submission
        const formInputs = document.querySelectorAll('#new-zone-row input, #new-zone-row button');
        formInputs.forEach(input => input.disabled = true);

        // Create zone data
        const zoneData = {
            symbol: symbolInput.value.trim().toUpperCase(),
            entry: entry,
            stoploss: stoploss,
            target: target,
            notes: notesInput.value.trim()
        };

        // Send to API
        fetch('/api/zones/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(zoneData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                // Success - reload the page to show the new zone
                window.location.reload();
            } else {
                alert(data.error || 'Failed to create zone');
                // Re-enable form
                formInputs.forEach(input => input.disabled = false);
                symbolInput.focus();
            }
        })
        .catch(error => {
            console.error('Error creating zone:', error);
            alert('Failed to create zone');
            // Re-enable form
            formInputs.forEach(input => input.disabled = false);
            symbolInput.focus();
        });
    }

    cancelNewZone() {
        const newRow = document.getElementById('new-zone-row');
        if (newRow) {
            newRow.remove();

            // Check if we need to show empty state again
            const remainingRows = document.querySelectorAll('#tableBody tr').length;
            if (remainingRows === 0) {
                tableCore.showEmptyState();
            }
        }
    }
}

// Initialize the table forms
const tableForms = new TableForms();