window.RentalConfirmedScreen = {
    _printed: false,  // guard: only print once per rental session

    async init() {
        const btn = document.getElementById('btn-open-compartment');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN COMPARTMENT';
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
        // Guard: only print once. init() can be called multiple times if the navigator
        // re-initialises the screen (e.g. on navigation flicker), which would fire
        // a duplicate print job with stale buffered data.
        if (this._printed) return;
        this._printed = true;
        let noPaper = false;
        App.showLoading('Printing receipt...');
        try {
            const expiresAt = AppState.rentalType === 'fixed'
                ? new Date(Date.now() + AppState.durationHours * 3600 * 1000)
                    .toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                : null;

            const amountDue = AppState.totalDue || 0;
            const amountPaid = AppState.paymentMethod === 'cash'
                ? (AppState.cashInserted || amountDue)
                : amountDue;
            // Use the stored total change amount if available, otherwise calculate it
            const changeAmount = AppState.paymentMethod === 'cash'
                ? (AppState.totalChangeAmount !== undefined ? AppState.totalChangeAmount : Math.max(0, amountPaid - amountDue))
                : 0;
            const walletCredit = AppState.cashWalletCredit || 0;

            await Api.printReceipt({
                type: 'rental',
                compartment_code: AppState.selectedCompartment.code,
                module: AppState.selectedCompartment.module === '1' ? 'M1' : AppState.selectedCompartment.module,
                locker_name: `${AppState.selectedCompartment.size ? AppState.selectedCompartment.size.charAt(0).toUpperCase() + AppState.selectedCompartment.size.slice(1) : ''} Compartment (${AppState.selectedCompartment.code})`,
                rental_type: AppState.rentalType === 'fixed' ? 'Fixed Duration' : 'Open Time',
                duration: AppState.rentalType === 'fixed' ? `${AppState.durationHours} hours` : null,
                expires_at: expiresAt,
                total: amountDue,
                payment_method: AppState.paymentMethod || 'None',
                // Payment breakdown
                amount_due: amountDue,
                amount_paid: amountPaid,
                // change_amount = gross overpayment (total change before any dispensing)
                change_amount: changeAmount,
                // wallet_credit = portion of change that was added to wallet (after coins dispensed)
                wallet_credit: walletCredit,
                refund_amount: 0 // No refunds on rental
            });
        } catch (e) {
            if (e.code === 'no_paper') {
                noPaper = true;
                console.warn('Printer timeout — no receipt paper:', e);
                App.hideLoading();
                App.showNoPaperDialog();
            } else {
                console.error('Printer error:', e);
            }
        } finally {
            if (!noPaper) {
                setTimeout(() => {
                    App.hideLoading();
                }, 2500);
            }
        }
    },

    async openCompartment() {
        const btn = document.getElementById('btn-open-compartment');
        btn.disabled = true;
        btn.innerHTML = 'CONFIRMING...';
        App.showLoading('Unlocking compartment...');

        try {
            await Api.request(`/hardware/unlock/${AppState.selectedCompartment.code}`, {
                method: 'POST',
                body: JSON.stringify({ device_code: AppState.selectedCompartment.device_code })
            });
            App.hideLoading();
            this._printed = false; // reset for next session
            // Navigate to the locker warning screen (security step before post-rental options)
            AppState._lockerWarningFlow = 'rental';
            App.navigate('locker-warning');
        } catch (e) {
            App.hideLoading();
            App.showDialog(
                e.message,
                'Unlock Failed',
                'error',
                'OK'
            );
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN COMPARTMENT';
        }
    }
};
