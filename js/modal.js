/**
 * ========================================
 * Modal Manager
 * Handles opening/closing modals
 * ========================================
 */

const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
const modalTitle = document.getElementById('modalTitle');
const modalIcon = document.getElementById('modalIcon');
const modalClose = document.getElementById('modalClose');
const modalFooter = document.getElementById('modalFooter');

let currentTool = null;

/**
 * Open a modal with tool content
 * @param {string} title - Tool title
 * @param {string} icon - Tool icon (emoji)
 * @param {string} contentHTML - HTML content for modal body
 * @param {Function} onOpen - Callback after modal opens
 */
export function openModal(title, icon, contentHTML, onOpen = null) {
    // Set title and icon
    modalTitle.textContent = title;
    modalIcon.textContent = icon;
    
    // Set body content
    modalBody.innerHTML = contentHTML;
    
    // Show modal
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Execute callback if provided
    if (typeof onOpen === 'function') {
        setTimeout(onOpen, 100);
    }
}

/**
 * Close the current modal
 */
export function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    // Clear body content after animation
    setTimeout(() => {
        if (!modalOverlay.classList.contains('active')) {
            // Optionally clear content
        }
    }, 300);
}

/**
 * Set footer buttons
 * @param {Array} buttons - Array of {text, className, onClick}
 */
export function setModalFooter(buttons = []) {
    if (!buttons || buttons.length === 0) {
        modalFooter.innerHTML = '';
        modalFooter.style.display = 'none';
        return;
    }
    modalFooter.style.display = 'flex';
    modalFooter.innerHTML = buttons.map(btn => `
        <button class="btn ${btn.className || 'btn-secondary'}" data-action="${btn.action || ''}">
            ${btn.text}
        </button>
    `).join('');
    
    // Attach event listeners
    modalFooter.querySelectorAll('button').forEach((btnEl, index) => {
        btnEl.addEventListener('click', (e) => {
            const btn = buttons[index];
            if (btn && typeof btn.onClick === 'function') {
                btn.onClick(e);
            }
        });
    });
}

/**
 * Reset modal to default state
 */
export function resetModal() {
    modalFooter.innerHTML = '';
    modalFooter.style.display = 'none';
}

// ===== Event Listeners =====

// Close button
modalClose.addEventListener('click', closeModal);

// Click outside to close
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        closeModal();
    }
});

// Escape key to close
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        closeModal();
    }
});