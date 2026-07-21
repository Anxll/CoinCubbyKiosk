/**
 * Admin Inventory Screen
 * Manages the change dispenser amount directly in Pesos via Supabase.
 */
window.AdminInventoryScreen = {
    _inputValue: 0,
    _currentAmount: 0,
    _lastRefilledAt: null,
    _lastRefilledAmount: 0,
    LOW_STOCK_THRESHOLD: 50, // ₱50 limit
    numpadObj: null,

    // ── Lifecycle ─────────────────────────────────────────────────
    async init() {
        this._inputValue = 0;
        this._refreshInput();
        
        // Bind standard Numpad component
        if (!this.numpadObj) {
            this.numpadObj = new Numpad('numpad-admin-inventory', (key) => this.handleInput(key));
        }

        await this.fetchInventory();
    },

    // ── API Calls ─────────────────────────────────────────────────
    async fetchInventory() {
        try {
            const data = await Api.request('/inventory');

            this._currentAmount = parseFloat(data.change_amount) || 0;
            this._lastRefilledAt = data.last_refilled_at;
            this._lastRefilledAmount = parseFloat(data.last_refilled_amount) || 0;
            
            this._refreshDisplay();
            this._updateDashSummary();
        } catch (err) {
            console.error('Failed to fetch inventory:', err);
            App.showError('Failed to load inventory: ' + (err.message || err));
        }
    },

    // ── Numpad Input Handler ─────────────────────────────────────
    handleInput(key) {
        if (key === 'CLEAR') {
            this._inputValue = 0;
        } else if (key === 'DEL') {
            this._inputValue = Math.floor(this._inputValue / 10);
        } else {
            const digit = parseInt(key, 10);
            if (isNaN(digit)) return;
            const next = parseInt(`${this._inputValue}${key}`, 10);
            if (next > 99999) return; // max ₱99,999 limit
            this._inputValue = next;
        }
        this._refreshInput();
    },

    addQuickAmount(amount) {
        this._inputValue += amount;
        if (this._inputValue > 99999) this._inputValue = 99999;
        this._refreshInput();
    },

    // ── Actions ──────────────────────────────────────────────────
    async addCoins() {
        if (this._inputValue <= 0) return;
        
        App.showLoading('Updating inventory...');
        
        try {
            const data = await Api.request('/inventory/refill', {
                method: 'POST',
                body: JSON.stringify({ amount: this._inputValue })
            });

            this._inputValue = 0;
            this._currentAmount = parseFloat(data.inventory.change_amount);
            this._lastRefilledAt = data.inventory.last_refilled_at;
            this._lastRefilledAmount = parseFloat(data.inventory.last_refilled_amount);
            
            this._refreshDisplay();
            this._refreshInput();
            this._updateDashSummary();
            
            App.showLoading(`✓ Added! New level: ₱${this._currentAmount}.`);
            setTimeout(() => App.hideLoading(), 1600);
            
        } catch (err) {
            console.error('Failed to add coins:', err);
            App.hideLoading();
            App.showError('Failed to update inventory: ' + (err.message || err));
        }
    },

    resetToZero() {
        App.showConfirm(
            'Are you sure you want to set the change level to ₱0?',
            'Reset Inventory',
            async (confirmed) => {
                if (!confirmed) return;
                
                App.showLoading('Resetting inventory...');
                
                try {
                    const data = await Api.request('/inventory/reset', {
                        method: 'POST'
                    });

                    this._currentAmount = 0;
                    // Not resetting last_refilled here, it stays until next refill
                    
                    this._refreshDisplay();
                    this._updateDashSummary();
                    
                    App.showLoading('Change level reset to ₱0.');
                    setTimeout(() => App.hideLoading(), 1400);
                    
                } catch (err) {
                    console.error('Failed to reset inventory:', err);
                    App.hideLoading();
                    App.showError('Failed to reset inventory: ' + (err.message || err));
                }
            }
        );
    },

    // ── Private: update current stock display ────────────────────
    _refreshDisplay() {
        const amount = this._currentAmount;

        const valueEl = document.getElementById('inv-coin-value');
        const warnEl  = document.getElementById('inv-low-warning');
        const lastRefilledEl = document.getElementById('inv-last-refilled');

        if (valueEl) valueEl.textContent = `₱${amount}`;
        if (warnEl)  warnEl.style.display = amount <= this.LOW_STOCK_THRESHOLD ? 'flex' : 'none';
        
        if (lastRefilledEl) {
            if (this._lastRefilledAt) {
                const date = new Date(this._lastRefilledAt).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
                });
                lastRefilledEl.textContent = `₱${this._lastRefilledAmount} on ${date}`;
            } else {
                lastRefilledEl.textContent = 'Never';
            }
        }
    },

    // ── Private: update numpad input display ─────────────────────
    _refreshInput() {
        const displayEl = document.getElementById('inv-input-display');
        const addBtn    = document.getElementById('btn-inv-add');

        if (displayEl) displayEl.textContent = this._inputValue;
        if (addBtn)    addBtn.disabled        = this._inputValue <= 0;
    },

    // ── Private: sync the Admin Dashboard "Refill" card subtitle ─
    _updateDashSummary() {
        const el = document.getElementById('admin-dash-coin-summary');
        if (!el) return;
        const amount = this._currentAmount;
        if (amount <= this.LOW_STOCK_THRESHOLD) {
            el.innerHTML = `<span style="color:var(--admin-pink);font-weight:700;">⚠ LOW: ₱${amount} change remaining</span>`;
        } else {
            el.textContent = `₱${amount} change remaining`;
        }
    }
};
