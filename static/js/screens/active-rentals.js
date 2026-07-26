window.ActiveRentalsScreen = {
    rentals: [],

    async init() {
        if (!AppState.user) return App.navigate('dashboard');
        
        App.showLoading('Loading active rentals...');
        try {
            const res = await Api.getActiveRentals(AppState.user.id);
            this.rentals = res.rentals;
            this.renderList();
        } catch (e) {
            console.error(e);
        } finally {
            App.hideLoading();
        }
    },

    renderList() {
        const list = document.getElementById('active-rentals-list');
        const footer = document.querySelector('#screen-active-rentals .compartment-footer');
        
        if (this.rentals.length === 0) {
            if (footer) footer.style.display = 'none';
            list.innerHTML = `
                <div class="card card-center" style="margin: 40px auto 0;">
                    <div class="icon-circle icon-circle-orange-light">
                        <span class="material-icons-round">sentiment_dissatisfied</span>
                    </div>
                    <h2 class="card-title">No Active Rentals</h2>
                    <p class="card-subtitle">You don't have any items stored currently.</p>
                    <button class="btn btn-outline" onclick="App.navigate('dashboard')">HOME</button>
                </div>
            `;
            return;
        }

        if (footer) footer.style.display = 'flex';
        let html = '';
        this.rentals.forEach(r => {
            const isReady = r.status === 'ready_for_retrieval';
            const badgeCls = isReady ? 'badge-ready' : 'badge-exceeded';
            const badgeIcon = isReady ? 'check_circle' : 'warning';
            const badgeText = isReady ? 'Ready for Retrieval' : 'Duration Exceeded';
            const feeColor = r.outstanding > 0 ? 'text-orange' : 'text-green';
            const typeLabel = r.rental_type === 'fixed' ? 'Fixed Duration' : 'Open Time';

            html += `
                <div class="rental-card" onclick="ActiveRentalsScreen.select('${r.id}')">
                    <div class="rental-info-left">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                            <span class="rental-compartment">Compartment</span>
                            <span style="font-size:20px; font-weight:900; color:var(--accent-orange); background:rgba(255,109,0,0.12); padding:2px 10px; border-radius:8px; letter-spacing:1px;">${r.compartment_code}</span>
                        </div>
                        <div class="rental-status-badge ${badgeCls}">
                            <span class="material-icons-round" style="font-size:14px">${badgeIcon}</span>
                            ${badgeText}
                        </div>
                        <span class="rental-details">${typeLabel}</span>
                    </div>
                    <div class="rental-info-right">
                        <span class="fee-label">AMOUNT DUE</span>
                        <span class="fee-amount ${feeColor}">&#8369;${r.outstanding.toFixed(2)}</span>
                    </div>
                </div>
            `;
        });
        
        list.innerHTML = html;
    },

    select(rentalId) {
        const rental = this.rentals.find(r => r.id === rentalId);
        if (!rental) return;
        
        AppState.selectedRental = rental;
        
        if (rental.outstanding > 0 || rental.rental_type === 'fixed') {
            // Always show retrieval-payment for fixed-duration (may have early refund even if outstanding=0)
            AppState.totalDue = rental.outstanding;
            App.navigate('retrieval-payment');
        } else {
            // Open-time with no outstanding: process directly
            this.processRetrieval(rental);
        }
    },

    async processRetrieval(rental) {
        App.showLoading('Processing retrieval...');
        try {
            const res = await Api.retrieveRental(rental.id, null, AppState.user.id);
            // Keep loading active — retrieval-ready init() will hide it after printing receipt
            App.navigate('retrieval-ready', { compartmentCode: res.compartment_code, amountCharged: 0 });
        } catch (e) {
            App.hideLoading();
            App.showDialog(
                e.message,
                'Error Loading Rentals',
                'error',
                'OK'
            );
        }
    }
};
