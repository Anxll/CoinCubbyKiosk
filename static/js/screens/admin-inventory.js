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

    async fetchStatus() {
        try {
            const data = await ApiClient.request('/inventory/status');
            
            document.getElementById('admin-inventory-balance').innerText = data.change_amount.toFixed(2);
            document.getElementById('admin-inventory-last-amount').innerText = data.last_refilled_amount.toFixed(2);
            
            if (data.last_refilled_at) {
                const date = new Date(data.last_refilled_at);
                document.getElementById('admin-inventory-last-date').innerText = date.toLocaleString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric', 
                    hour: 'numeric', minute: '2-digit', hour12: true 
                });
            } else {
                document.getElementById('admin-inventory-last-date').innerText = 'Never';
            }
        } catch (e) {
            console.error("Error fetching inventory status:", e);
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
            const data = await ApiClient.request('/inventory/refill', {
                method: 'POST',
                body: JSON.stringify({ amount: totalAmount })
            });
            
            if (hideLoading) hideLoading.call(App);
            
            // Success
            this.inputCoins = 0;
            this.updateDisplay();
            await this.fetchStatus();
            alert(`Successfully added ₱${totalAmount.toFixed(2)} to inventory!`);
        } catch (e) {
            console.error("Error refilling:", e);
            if (hideLoading) hideLoading.call(App);
            alert("Network error while refilling: " + (e.message || "Unknown error"));
            if (btnRefill) btnRefill.disabled = false;
        }
    }
};
