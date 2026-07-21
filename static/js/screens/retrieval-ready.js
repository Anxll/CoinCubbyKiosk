window.RetrievalReadyScreen = {
    async init() {
        const btn = document.querySelector('#screen-retrieval-ready .btn-open-compartment');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN LOCKER';
        }

        document.getElementById('retrieval-ready-code').innerText = AppState.compartmentCode;

        // Show/update loading while printing receipt (may already be showing from payment screen)
        App.showLoading('Printing receipt...');
        try {
            await Api.printReceipt({
                type: 'retrieval',
                compartment_code: AppState.compartmentCode,
                rental_type: AppState.selectedRental ? (AppState.selectedRental.rental_type === 'fixed' ? 'Fixed Duration' : 'Open Time') : 'Unknown',
                started_at: AppState.selectedRental ? new Date(AppState.selectedRental.started_at).toLocaleString() : 'Unknown',
                amount: AppState.amountCharged || 0,
                payment_method: AppState.paymentMethod || 'None',
                cash_inserted: AppState.cashInserted || AppState.amountCharged || 0
            });
        } catch (e) {
            console.error("Printer error:", e);
            // Notify the user if there's a printer issue (like out of paper)
            App.showDialog(e.message || "Unable to print receipt. Please notify staff if needed.", 'Printer Status');
        } finally {
            // Add a slight delay so the printing loading screen is visible long enough
            setTimeout(() => {
                App.hideLoading();
            }, 5000);
        }
    },

    async openCompartment() {
        const btn = document.querySelector('#screen-retrieval-ready .btn-open-compartment');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = 'CONFIRMING...';
        }
        App.showLoading('Unlocking locker...');

        try {
            await Api.request(`/hardware/unlock/${AppState.compartmentCode}`, {
                method: 'POST',
                body: JSON.stringify({ device_code: AppState.selectedRental?.device_code || '' })
            });
            App.hideLoading();
            // Show post-retrieval choice dialog (matches post-rental flow)
            App.showPostRetrievalDialog();
        } catch (e) {
            App.hideLoading();
            App.showError(e.message);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN LOCKER';
            }
        }
    }
};