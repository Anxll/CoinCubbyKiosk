window.FixedDurationScreen = {
    tiers: [],
    
    async init() {
        if (!AppState.selectedCompartment) return App.navigate('dashboard');
        
        document.getElementById('duration-compartment').innerText = `Compartment: ${AppState.selectedCompartment.code}`;
        document.getElementById('btn-confirm-duration').disabled = true;
        AppState.durationHours = null;
        
        App.showLoading('Loading pricing...');
        try {
            const pricing = await Api.getPricing(AppState.selectedCompartment.id);
            this.tiers = pricing.fixed_duration_tiers;
            AppState.rentalPricing = pricing;
            this.renderGrid();
        } catch (e) {
            console.error(e);
        } finally {
            App.hideLoading();
        }
    },

    renderGrid() {
        const grid = document.getElementById('duration-grid');
        let html = '';
        
        this.tiers.forEach(tier => {
            const isSelected = AppState.durationHours === tier.hours;
            html += `
                <div class="duration-card ${isSelected ? 'selected' : ''}" onclick="FixedDurationScreen.select(${tier.hours})">
                    <span class="duration-label">${tier.label}</span>
                    <span class="duration-price">₱${tier.price}</span>
                </div>
            `;
        });
        grid.innerHTML = html;
    },

    select(hours) {
        AppState.durationHours = hours;
        this.renderGrid();
        document.getElementById('btn-confirm-duration').disabled = false;
    },

    confirm() {
        if (AppState.durationHours) {
            App.navigate('payment-method', { rentalType: 'fixed' });
        }
    }
};
