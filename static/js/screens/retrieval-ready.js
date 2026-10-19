window.RetrievalReadyScreen = {
    _printed: false,  // guard: only print once per retrieval session

    async init() {
        const btn = document.querySelector('#screen-retrieval-ready .btn-open-compartment');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN COMPARTMENT';
        }

        document.getElementById('retrieval-ready-code').innerText = AppState.compartmentCode;

        // Show refund notification if there was a refund
        const refundNotification = document.getElementById('refund-notification');
        if (AppState.refundAmount && AppState.refundAmount > 0) {
            document.getElementById('refund-display-amount').innerText = AppState.refundAmount.toFixed(2);
            refundNotification.style.display = 'flex';
            
            // Update title for refund scenario
            document.querySelector('#screen-retrieval-ready .success-title').innerText = 'Refund Processed';
        } else {
            refundNotification.style.display = 'none';
        }

        // Show/update loading while printing receipt (may already be showing from payment screen)
        // Guard: only print once per session to prevent duplicate/stale print jobs.
        if (this._printed) return;
        this._printed = true;
        let noPaper = false;
        App.showLoading('Printing receipt...');
        try {
            const amountDue = AppState.amountCharged || AppState.selectedRental?.outstanding || 0;
            const amountPaid = AppState.paymentMethod === 'cash'
                ? (AppState.amountPaid || amountDue)
                : amountDue;
            // Use the stored total change amount if available, otherwise calculate it
            const changeAmount = AppState.paymentMethod === 'cash'
                ? (AppState.totalChangeAmount !== undefined ? AppState.totalChangeAmount : Math.max(0, amountPaid - amountDue))
                : 0;
            const walletCredit = AppState.cashWalletCredit || 0;

            await Api.printReceipt({
                type: 'retrieval',
                compartment_code: AppState.compartmentCode,
                module: AppState.selectedRental?.module === '1' ? 'M1' : (AppState.selectedRental?.module || 'M1'),
                locker_name: AppState.selectedRental
                    ? `${AppState.selectedRental.compartment_size ? AppState.selectedRental.compartment_size.charAt(0).toUpperCase() + AppState.selectedRental.compartment_size.slice(1) : ''} Compartment (${AppState.compartmentCode})`
                    : AppState.compartmentCode,
                rental_type: AppState.selectedRental ? (AppState.selectedRental.rental_type === 'fixed' ? 'Fixed Duration' : 'Open Time') : 'Unknown',
                started_at: AppState.selectedRental ? new Date(AppState.selectedRental.started_at).toLocaleString() : 'Unknown',
                amount: amountDue,
                // Payment breakdown
                amount_due: amountDue,
                amount_paid: amountPaid,
                // change_amount = gross overpayment (total change before any dispensing)
                change_amount: changeAmount,
                // wallet_credit = portion of change that was added to wallet (after coins dispensed)
                wallet_credit: walletCredit,
                refund_amount: AppState.refundAmount || 0,
                payment_method: AppState.paymentMethod || (amountDue > 0 ? 'Unknown' : 'None')
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
        const btn = document.querySelector('#screen-retrieval-ready .btn-open-compartment');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = 'CONFIRMING...';
        }
        App.showLoading('Unlocking compartment...');

        try {
            await Api.request(`/hardware/unlock/${AppState.compartmentCode}`, {
                method: 'POST',
                body: JSON.stringify({ device_code: AppState.selectedRental?.device_code || '' })
            });
            App.hideLoading();
            this._printed = false; // reset for next session
            // Navigate to the locker warning screen (security step before post-retrieval options)
            AppState._lockerWarningFlow = 'retrieval';
            App.navigate('locker-warning');
        } catch (e) {
            App.hideLoading();
            App.showDialog(
                e.message,
                'Unlock Failed',
                'error',
                'OK'
            );
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN COMPARTMENT';
            }
        }
    }
};