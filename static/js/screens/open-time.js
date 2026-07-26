window.OpenTimeScreen = {
    async init() {
        if (!AppState.selectedCompartment) return App.navigate('dashboard');
        
        document.getElementById('open-time-compartment').innerText = `Compartment: ${AppState.selectedCompartment.code}`;
        
        App.showLoading('Loading pricing...');
        try {
            const pricing = await Api.getPricing(AppState.selectedCompartment.id);
            document.getElementById('open-time-rate').innerText = pricing.rate_per_hour;
            AppState.rentalPricing = pricing;
        } catch (e) {
            console.error(e);
        } finally {
            App.hideLoading();
        }
    },

    async confirm() {
        App.showLoading('Setting up rental...');
        try {
            const res = await Api.createRental({
                user_id: AppState.user.id,
                compartment_id: AppState.selectedCompartment.id,
                rental_type: 'open_time',
                payment_method: null
            });
            AppState.rentalId = res.rental.id;
            AppState.totalDue = 0;
            AppState.durationHours = null;
            AppState.paymentMethod = 'None';
            App.navigate('rental-confirmed', { rentalType: 'open_time' });
        } catch (e) {
            App.showDialog(
                e.message || 'Failed to create rental',
                'Rental Creation Failed',
                'error',
                'TRY AGAIN'
            );
        } finally {
            App.hideLoading();
        }
    }
};
