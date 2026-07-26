window.RetrievalPaymentScreen = {
    async init() {
        if (!AppState.selectedRental) return App.navigate('dashboard');

        const r = AppState.selectedRental;

        // Populate compartment info
        document.getElementById('retrieval-compartment').innerText = r.compartment_code;
        document.getElementById('retrieval-rental-type').innerText = r.rental_type === 'fixed' ? 'Fixed Duration' : 'Open Time';

        // Populate rental code reminder banner
        const reminderEl = document.getElementById('retrieval-reminder-code');
        if (reminderEl) reminderEl.innerText = r.compartment_code;

        const start = new Date(r.started_at);
        document.getElementById('retrieval-start-time').innerText = start.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        // Reset panels
        const paymentMethodsPanel = document.getElementById('retrieval-payment-methods');
        if (paymentMethodsPanel) paymentMethodsPanel.style.display = 'none';
        const refundSection = document.getElementById('refund-section');
        if (refundSection) refundSection.style.display = 'none';

        if (r.rental_type === 'fixed') {
            const overdueMin = Math.round((r.overdue_hours || 0) * 60);
            if (overdueMin > 0) {
                document.getElementById('retrieval-duration').innerText = `${r.duration_hours}h + ${overdueMin} min overdue`;
            } else {
                document.getElementById('retrieval-duration').innerText = `${r.duration_hours}h`;
            }

            // Check for early retrieval refund scenario (awaited so refund section is set)
            await this.checkRefundEligibility();
        } else {
            const elapsedMin = Math.round((r.elapsed_hours || 0) * 60);
            if (elapsedMin < 60) {
                document.getElementById('retrieval-duration').innerText = `${elapsedMin} min`;
            } else {
                const hrs = Math.floor(elapsedMin / 60);
                const mins = elapsedMin % 60;
                document.getElementById('retrieval-duration').innerText = mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
            }
        }

        document.getElementById('retrieval-amount-due').innerHTML = `<strong>&#8369;${r.outstanding.toFixed(2)}</strong>`;

        // Determine refund eligibility AFTER the async check completes
        const isRefund = refundSection && refundSection.style.display !== 'none';

        // Update action button / payment panel based on scenario
        const btn = document.getElementById('btn-retrieval-open');
        const backBtn = document.getElementById('btn-retrieval-back');
        if (backBtn) backBtn.style.display = 'none'; // hidden by default

        if (isRefund) {
            // Refund: single button, no payment needed
            if (btn) {
                btn.style.display = 'flex';
                btn.innerHTML = '<span class="material-icons-round">account_balance_wallet</span> GET REFUND & OPEN COMPARTMENT';
            }
        } else if (r.outstanding > 0) {
            // Payment required — show inline payment method buttons, hide single action btn
            if (btn) btn.style.display = 'none';
            if (paymentMethodsPanel) paymentMethodsPanel.style.display = 'flex';
            // Set totalDue so wallet-payment and cash-payment screens know the amount
            AppState.totalDue = r.outstanding;
        } else {
            // Free retrieval
            if (btn) {
                btn.style.display = 'flex';
                if (r.rental_type === 'fixed') {
                    btn.innerHTML = '<span class="material-icons-round">check_circle</span> CONFIRM RETRIEVAL';
                    if (backBtn) backBtn.style.display = 'block'; // Show BACK for fixed duration confirm screen
                } else {
                    btn.innerHTML = '<span class="material-icons-round">lock_open</span> OPEN COMPARTMENT (FREE)';
                }
            }
        }
    },

    async checkRefundEligibility() {
        const r = AppState.selectedRental;

        // Only check refunds for fixed-duration rentals that haven't exceeded time
        if (r.rental_type !== 'fixed' || r.status === 'duration_exceeded') {
            document.getElementById('refund-section').style.display = 'none';
            return;
        }

        try {
            const response = await Api.request(`/rentals/${r.id}/refund-preview`);
            const refundData = response.refund_details;

            if (refundData && refundData.refund_amount > 0) {
                // Helper: convert 30-min blocks to a readable duration string
                const blocksToTime = (blocks) => {
                    const totalMin = blocks * 30;
                    const hrs = Math.floor(totalMin / 60);
                    const mins = totalMin % 60;
                    if (hrs === 0) return `${mins} min`;
                    if (mins === 0) return `${hrs}h`;
                    return `${hrs}h ${mins}min`;
                };

                document.getElementById('refund-section').style.display = 'block';
                document.getElementById('refund-paid-blocks').innerText = blocksToTime(refundData.paid_blocks);
                document.getElementById('refund-used-blocks').innerText = blocksToTime(refundData.used_blocks);
                document.getElementById('refund-amount').innerText = refundData.refund_amount.toFixed(2);
            } else {
                document.getElementById('refund-section').style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking refund eligibility:', error);
            document.getElementById('refund-section').style.display = 'none';
        }
    },

    // Called only for refund scenario and free retrieval (single action button)
    openCompartment() {
        const refundSection = document.getElementById('refund-section');
        const isRefund = refundSection && refundSection.style.display !== 'none';

        if (isRefund) {
            this.processRefundRetrieval();
        } else {
            // Free retrieval (outstanding === 0)
            this.processFreeRetrieval();
        }
    },

    async processFreeRetrieval() {
        const r = AppState.selectedRental;
        App.showLoading('Processing retrieval...');
        try {
            const res = await Api.retrieveRental(r.id, null, AppState.user.id);
            AppState.compartmentCode = res.compartment_code;
            AppState.amountCharged = 0;
            AppState.refundAmount = 0;
            App.navigate('retrieval-ready', { compartmentCode: res.compartment_code, amountCharged: 0 });
        } catch (error) {
            App.hideLoading();
            App.showDialog(
                error.message || 'Failed to process retrieval',
                'Retrieval Error',
                'error',
                'OK'
            );
        }
    },

    async processRefundRetrieval() {
        App.showLoading('Processing retrieval and refund...');

        try {
            const response = await Api.request(`/rentals/${AppState.selectedRental.id}/retrieve`, {
                method: 'POST',
                body: JSON.stringify({ user_id: AppState.user.id })
            });

            AppState.compartmentCode = response.compartment_code;
            AppState.amountCharged = 0;
            AppState.refundAmount = response.refund_amount || 0;

            if (typeof response.new_wallet_balance === 'number') {
                AppState.user.wallet_balance = response.new_wallet_balance;
            }

            App.hideLoading();
            App.navigate('retrieval-ready');
        } catch (error) {
            App.hideLoading();
            App.showDialog(
                error.message || 'Failed to process retrieval',
                'Retrieval Error',
                'error',
                'OK'
            );
        }
    }
};
