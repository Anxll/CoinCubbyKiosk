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
                locker_name: AppState.selectedRental
                    ? `${AppState.selectedRental.compartment_size ? AppState.selectedRental.compartment_size.charAt(0).toUpperCase() + AppState.selectedRental.compartment_size.slice(1) : ''} Locker (${AppState.compartmentCode})`
                    : AppState.compartmentCode,
                rental_type: AppState.selectedRental ? (AppState.selectedRental.rental_type === 'fixed' ? 'Fixed Duration' : 'Open Time') : 'Unknown',
                started_at: AppState.selectedRental ? new Date(AppState.selectedRental.started_at).toLocaleString() : 'Unknown',
                amount: AppState.amountCharged || 0
            });
        } catch (e) {
            console.error("Printer error:", e);
        } finally {
            // Add a slight delay so the printing loading screen is visible long enough
            setTimeout(() => {
                App.hideLoading();
            }, 2500);
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
            alert(e.message);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN LOCKER';
            }
        }
    }
};