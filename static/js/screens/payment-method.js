window.PaymentMethodScreen = {
    init() {
        if (!AppState.selectedCompartment) return App.navigate('dashboard');

        document.getElementById('payment-compartment').innerText = AppState.selectedCompartment.code;
        
        if (AppState.rentalType === 'fixed') {
            const tier = AppState.rentalPricing.fixed_duration_tiers.find(t => t.hours === AppState.durationHours);
            const total = tier.price + AppState.rentalPricing.service_fee;
            
            document.getElementById('payment-rental-type').innerText = 'Fixed Duration';
            document.getElementById('payment-duration-row').style.display = 'flex';
            document.getElementById('payment-duration').innerText = tier.label;
            document.getElementById('payment-rental-fee').innerText = `₱${tier.price}`;
            document.getElementById('payment-service-fee').innerText = `₱${AppState.rentalPricing.service_fee}`;
            document.getElementById('payment-total').innerHTML = `<strong>₱${total}</strong>`;
            
            AppState.totalDue = total;
        }
    }
};
