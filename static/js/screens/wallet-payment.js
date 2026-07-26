window.WalletPaymentScreen = {
    init() {
        const bal = AppState.user.wallet_balance;
        const due = AppState.totalDue;
        const rem = bal - due;
        
        document.getElementById('wallet-amount-due').innerText = `₱${due.toFixed(2)}`;
        document.getElementById('wallet-balance').innerText = `₱${bal.toFixed(2)}`;
        
        const remEl = document.getElementById('wallet-remaining');
        remEl.innerText = `₱${rem.toFixed(2)}`;
        
        const btn = document.getElementById('btn-wallet-confirm');
        if (rem < 0) {
            remEl.classList.remove('wallet-value-green');
            remEl.classList.add('text-red');
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons-round">error</span> INSUFFICIENT FUNDS';
        } else {
            remEl.classList.add('wallet-value-green');
            remEl.classList.remove('text-red');
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">check_circle</span> CONFIRM';
        }
    },

    async confirm() {
        const btn = document.getElementById('btn-wallet-confirm');
        btn.disabled = true;
        AppState.paymentMethod = 'wallet';
        App.showLoading('Processing payment...');

        try {
            if (AppState.flow === 'rent') {
                const res = await Api.createRental({
                    user_id: AppState.user.id,
                    compartment_id: AppState.selectedCompartment.id,
                    rental_type: 'fixed',
                    duration_hours: AppState.durationHours,
                    payment_method: 'wallet'
                });
                // Sync wallet balance so header / account screen reflect the deduction
                if (typeof res.new_wallet_balance === 'number') {
                    AppState.user.wallet_balance = res.new_wallet_balance;
                }
                // Keep loading active — rental-confirmed init() will hide it after printing receipt
                App.navigate('rental-confirmed', { paymentMethod: 'wallet' });
            } else {
                // Retrieval flow
                const res = await Api.retrieveRental(AppState.selectedRental.id, 'wallet', AppState.user.id);
                // Sync wallet balance so header / account screen reflect the deduction
                if (typeof res.new_wallet_balance === 'number') {
                    AppState.user.wallet_balance = res.new_wallet_balance;
                }
                // Keep loading active — retrieval-ready init() will hide it after printing receipt
                App.navigate('retrieval-ready', { amountCharged: res.amount_charged, compartmentCode: res.compartment_code });
            }
        } catch (e) {
            App.hideLoading();
            App.showDialog(
                e.message,
                'Payment Failed',
                'error',
                'TRY AGAIN'
            );
            btn.disabled = false;
        }
    }
};
