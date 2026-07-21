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
        App.showLoading('Starting rental...');
        try {
            await Api.createRental({
                user_id: AppState.user.id,
                compartment_id: AppState.selectedCompartment.id,
                rental_type: 'open_time',
                payment_method: null
            });
            App.hideLoading();
            App.navigate('rental-confirmed', { rentalType: 'open_time', totalDue: 0 });
        } catch (e) {
            App.hideLoading();
            App.showDialog('Failed to start rental: ' + e.message, 'Error');
        }
    }
};
