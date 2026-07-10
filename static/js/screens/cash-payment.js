window.CashPaymentScreen = {
    evtSource: null,
    
    async init() {
        const due = AppState.totalDue;
        document.getElementById('cash-amount-due').innerText = `₱${due.toFixed(2)}`;
        document.getElementById('cash-inserted').innerText = `₱0.00`;
        document.getElementById('cash-remaining').innerText = `₱${due.toFixed(2)}`;
        document.getElementById('cash-progress').style.width = '0%';
        
        try {
            await Api.startCash(due);
            this.startStream();
        } catch (e) {
            alert('Hardware Error: ' + e.message);
        }
    },

    startStream() {
        this.evtSource = new EventSource('/api/hardware/cash/status');
        this.evtSource.onmessage = async (e) => {
            const data = JSON.parse(e.data);
            
            document.getElementById('cash-inserted').innerText = `₱${data.inserted.toFixed(2)}`;
            document.getElementById('cash-remaining').innerText = `₱${data.remaining.toFixed(2)}`;
            
            const pct = Math.min(100, (data.inserted / AppState.totalDue) * 100);
            document.getElementById('cash-progress').style.width = `${pct}%`;

            if (data.complete) {
                this.cleanup();
                await this.processSuccess();
            }
        };
    },

    async processSuccess() {
        try {
            if (AppState.flow === 'rent') {
                await Api.createRental({
                    user_id: AppState.user.id,
                    compartment_id: AppState.selectedCompartment.id,
                    rental_type: 'fixed',
                    duration_hours: AppState.durationHours,
                    payment_method: 'cash'
                });
                App.navigate('rental-confirmed', { paymentMethod: 'cash' });
            } else {
                const res = await Api.retrieveRental(AppState.selectedRental.id, 'cash');
                App.navigate('retrieval-ready', { amountCharged: res.amount_charged, compartmentCode: res.compartment_code });
            }
        } catch (e) {
            alert(e.message);
        }
    },

    async cancel() {
        this.cleanup();
        await Api.stopCash();
        App.goBack();
    },

    cleanup() {
        if (this.evtSource) {
            this.evtSource.close();
            this.evtSource = null;
        }
    }
};
