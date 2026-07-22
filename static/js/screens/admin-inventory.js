window.AdminInventoryScreen = {
    inputCoins: 0,
    COIN_VALUE: 5,

    init() {
        this.inputCoins = 0;
        this.updateDisplay();
        this.fetchStatus();
    },

    increment() {
        if (this.inputCoins < 9999) {
            this.inputCoins++;
            this.updateDisplay();
        }
    },

    decrement() {
        if (this.inputCoins > 0) {
            this.inputCoins--;
            this.updateDisplay();
        }
    },

    clear() {
        this.inputCoins = 0;
        this.updateDisplay();
    },

    updateDisplay() {
        const elInput = document.getElementById('admin-inventory-input-display');
        const elCalcAmount = document.getElementById('admin-inventory-calc-amount');
        const btnRefill = document.getElementById('btn-admin-refill');
        
        if (elInput) elInput.innerText = this.inputCoins.toString();
        if (elCalcAmount) elCalcAmount.innerText = (this.inputCoins * this.COIN_VALUE).toFixed(2);
        
        if (btnRefill) {
            btnRefill.disabled = this.inputCoins <= 0;
            if (this.inputCoins <= 0) {
                btnRefill.style.opacity = '0.5';
            } else {
                btnRefill.style.opacity = '1';
            }
        }
    },

    async fetchStatus(showOverlay = true) {
        const btnRefill = document.getElementById('btn-admin-refill');
        const showLoading = App?.showAdminLoading ?? App?.showLoading;
        const hideLoading = App?.hideAdminLoading ?? App?.hideLoading;

        if (showOverlay && btnRefill) {
            btnRefill.disabled = true;
            btnRefill.style.opacity = '0.5';
        }

        if (showOverlay && showLoading) {
            showLoading.call(App, 'Loading inventory...');
        }

        try {
            const data = await ApiClient.request('/inventory/status');
            
            const balanceEl = document.getElementById('admin-inventory-balance');
            const lastAmountEl = document.getElementById('admin-inventory-last-amount');
            const lastDateEl = document.getElementById('admin-inventory-last-date');

            if (balanceEl) balanceEl.innerText = data.change_amount.toFixed(2);
            if (lastAmountEl) lastAmountEl.innerText = data.last_refilled_amount.toFixed(2);
            
            if (data.last_refilled_at) {
                const date = new Date(data.last_refilled_at);
                if (lastDateEl) lastDateEl.innerText = date.toLocaleString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric', 
                    hour: 'numeric', minute: '2-digit', hour12: true 
                });
            } else if (lastDateEl) {
                lastDateEl.innerText = 'Never';
            }
        } catch (e) {
            console.error("Error fetching inventory status:", e);
        } finally {
            if (showOverlay && hideLoading) {
                hideLoading.call(App);
            }
            this.updateDisplay();
        }
    },

    async submit() {
        if (this.inputCoins <= 0) return;
        
        const totalAmount = this.inputCoins * this.COIN_VALUE;
        const btnRefill = document.getElementById('btn-admin-refill');
        if (btnRefill) btnRefill.disabled = true;
        
        const showLoading = App?.showAdminLoading ?? App?.showLoading;
        const hideLoading = App?.hideAdminLoading ?? App?.hideLoading;
        
        if (showLoading) showLoading.call(App, 'Processing...');
        
        try {
            await ApiClient.request('/inventory/refill', {
                method: 'POST',
                body: JSON.stringify({ amount: totalAmount })
            });
            
            // Success
            this.inputCoins = 0;
            this.updateDisplay();
            await this.fetchStatus(false);
            if (App?.showDialog) {
                App.showDialog(`Successfully added ₱${totalAmount.toFixed(2)} to inventory!`, 'Inventory Updated', 'check_circle');
            } else {
                alert(`Successfully added ₱${totalAmount.toFixed(2)} to inventory!`);
            }
        } catch (e) {
            console.error("Error refilling:", e);
            if (App?.showDialog) {
                App.showDialog("Network error while refilling: " + (e.message || "Unknown error"), 'Refill Failed', 'warning');
            } else {
                alert("Network error while refilling: " + (e.message || "Unknown error"));
            }
            if (btnRefill) btnRefill.disabled = false;
        } finally {
            if (hideLoading) hideLoading.call(App);
        }
    }
};
