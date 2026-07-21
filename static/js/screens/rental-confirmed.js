window.RentalConfirmedScreen = {
    async init() {
        const btn = document.getElementById('btn-open-compartment');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN LOCKER';
        }

        document.getElementById('confirmed-compartment').innerText = AppState.selectedCompartment.code;

        if (AppState.rentalType === 'fixed') {
            document.getElementById('confirmed-rental-type').innerText = 'Fixed Duration';
            const expires = new Date(Date.now() + AppState.durationHours * 3600 * 1000);
            document.getElementById('confirmed-retrieval-time').innerText = expires.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } else {
            document.getElementById('confirmed-rental-type').innerText = 'Open Time';
            document.getElementById('confirmed-retrieval-time').innerText = 'N/A';
        }

        // Show/update loading while printing receipt (may already be showing from payment screen)
        App.showLoading('Printing receipt...');
        try {
            const expiresAt = AppState.rentalType === 'fixed'
                ? new Date(Date.now() + AppState.durationHours * 3600 * 1000)
                    .toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                : null;

            await Api.printReceipt({
                type: 'rental',
                compartment_code: AppState.selectedCompartment.code,
                module: AppState.selectedCompartment.module,
                locker_name: `${AppState.selectedCompartment.size ? AppState.selectedCompartment.size.charAt(0).toUpperCase() + AppState.selectedCompartment.size.slice(1) : ''} Locker (${AppState.selectedCompartment.code})`,
                rental_type: AppState.rentalType === 'fixed' ? 'Fixed Duration' : 'Open Time',
                duration: AppState.rentalType === 'fixed' ? `${AppState.durationHours} hours` : null,
                expires_at: expiresAt,
                total: AppState.totalDue,
                payment_method: AppState.paymentMethod || 'None',
                wallet_credit: AppState.walletCredit || 0
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
        const btn = document.getElementById('btn-open-compartment');
        btn.disabled = true;
        btn.innerHTML = 'CONFIRMING...';
        App.showLoading('Unlocking locker...');

        try {
            await Api.request(`/hardware/unlock/${AppState.selectedCompartment.code}`, {
                method: 'POST',
                body: JSON.stringify({ device_code: AppState.selectedCompartment.device_code })
            });
            App.showLoading('Locker unlocked!');
            setTimeout(() => {
                App.hideLoading();
                App.showPostRentalDialog();
            }, 1200);
        } catch (e) {
            App.hideLoading();
            alert(e.message);
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN LOCKER';
        }
    }
};
