window.ActiveRentalsScreen = {
    rentals: [],

    async init() {
        if (!AppState.user) return App.navigate('dashboard');
        
        try {
            const res = await Api.getActiveRentals(AppState.user.id);
            this.rentals = res.rentals;
            this.renderList();
        } catch (e) {
            console.error(e);
        }
    },

    renderList() {
        const list = document.getElementById('active-rentals-list');
        
        if (this.rentals.length === 0) {
            list.innerHTML = `
                <div class="card card-center">
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

        let html = '';
        this.rentals.forEach(r => {
            const isReady = r.status === 'ready_for_retrieval';
            const badgeCls = isReady ? 'badge-ready' : 'badge-exceeded';
            const badgeIcon = isReady ? 'check_circle' : 'warning';
            const badgeText = isReady ? 'Ready for Retrieval' : 'Duration Exceeded';
            const feeColor = r.outstanding > 0 ? 'text-orange' : 'text-green';

            html += `
                <div class="rental-card" onclick="ActiveRentalsScreen.select('${r.id}')">
                    <div class="rental-info-left">
                        <span class="rental-compartment">Compartment ${r.compartment_code}</span>
                        <div class="rental-status-badge ${badgeCls}">
                            <span class="material-icons-round" style="font-size:14px">${badgeIcon}</span>
                            ${badgeText}
                        </div>
                        <span class="rental-details">${r.rental_type === 'fixed' ? 'Fixed Duration' : 'Open Time'}</span>
                    </div>
                    <div class="rental-info-right">
                        <span class="fee-label">AMOUNT DUE</span>
                        <span class="fee-amount ${feeColor}">₱${r.outstanding.toFixed(2)}</span>
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
        
        if (rental.outstanding > 0) {
            AppState.totalDue = rental.outstanding;
            App.navigate('retrieval-payment');
        } else {
            // Free retrieval
            this.processRetrieval(rental);
        }
    },

    async processRetrieval(rental) {
        try {
            const res = await Api.retrieveRental(rental.id, null);
            App.navigate('retrieval-ready', { compartmentCode: res.compartment_code, amountCharged: 0 });
        } catch (e) {
            alert(e.message);
        }
    }
};
