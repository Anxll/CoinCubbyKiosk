window.OpenTimeScreen = {
    async init() {
        if (!AppState.selectedCompartment) return App.navigate('dashboard');
        
        document.getElementById('open-time-compartment').innerText = `Compartment: ${AppState.selectedCompartment.code}`;
        
        try {
            const pricing = await Api.getPricing(AppState.selectedCompartment.id);
            document.getElementById('open-time-rate').innerText = pricing.rate_per_hour;
            document.getElementById('open-time-service').innerText = pricing.service_fee;
            AppState.rentalPricing = pricing;
        } catch (e) {
            console.error(e);
        }
    },

    confirm() {
        // Open time doesn't require immediate payment for rent
        App.navigate('rental-confirmed', { rentalType: 'open_time' });
    }
};
