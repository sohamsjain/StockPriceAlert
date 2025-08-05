// Column resize functionality
class TableResize {
    constructor() {
        this.isResizing = false;
        this.currentResizeHandle = null;
        this.startX = 0;
        this.startWidth = 0;
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupResizeHandlers();
        });
    }

    setupResizeHandlers() {
        // Add resize functionality
        document.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.isResizing = true;
                this.currentResizeHandle = handle;
                this.startX = e.clientX;

                const th = handle.parentElement;
                this.startWidth = parseInt(window.getComputedStyle(th).width, 10);

                // Add visual feedback
                handle.classList.add('resizing');
                document.body.classList.add('resizing');

                // Prevent text selection during resize
                document.addEventListener('selectstart', this.preventSelection);
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing || !this.currentResizeHandle) return;

            e.preventDefault();

            const diff = e.clientX - this.startX;
            const newWidth = Math.max(50, this.startWidth + diff); // Minimum width of 50px

            const th = this.currentResizeHandle.parentElement;
            th.style.width = newWidth + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (this.isResizing) {
                this.isResizing = false;

                if (this.currentResizeHandle) {
                    this.currentResizeHandle.classList.remove('resizing');
                    this.currentResizeHandle = null;
                }

                document.body.classList.remove('resizing');
                document.removeEventListener('selectstart', this.preventSelection);
            }
        });
    }

    preventSelection(e) {
        e.preventDefault();
    }
}

// Initialize the table resize
const tableResize = new TableResize();