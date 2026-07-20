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

    confirm() {
        // Open time doesn't require immediate payment for rent
        App.navigate('rental-confirmed', { rentalType: 'open_time' });
    }
};
