window.PaymentMethodScreen = {
    init() {
        if (AppState.flow === 'rent' && !AppState.selectedCompartment) return App.navigate('dashboard');
        if (AppState.flow === 'retrieve' && !AppState.selectedRental) return App.navigate('dashboard');

        const isRetrieveFlow = AppState.flow === 'retrieve';
        const compartmentCode = isRetrieveFlow ? AppState.selectedRental.compartment_code : AppState.selectedCompartment.code;

        document.getElementById('payment-compartment').innerText = compartmentCode;

        const durationRow = document.getElementById('payment-duration-row');
        const durationLabel = durationRow.querySelector('.summary-label');
        const durationValue = document.getElementById('payment-duration');
        const feeValue = document.getElementById('payment-rental-fee');
        const totalValue = document.getElementById('payment-total');

        durationRow.style.display = 'flex';

        if (isRetrieveFlow) {
            const rental = AppState.selectedRental;
            const total = Number(rental.outstanding || 0);

            document.getElementById('payment-rental-type').innerText = rental.rental_type === 'fixed' ? 'Retrieval - Fixed Duration' : 'Retrieval - Open Time';
            durationLabel.innerText = rental.rental_type === 'fixed' ? 'Duration' : 'Time Used';
            durationValue.innerText = rental.rental_type === 'fixed'
                ? `${rental.duration_hours || 0}h${rental.overdue_hours ? ` + ${rental.overdue_hours}h overdue` : ''}`
                : `${rental.elapsed_hours || 0} hour(s)`;
            feeValue.innerText = `₱${total.toFixed(2)}`;
            totalValue.innerHTML = `<strong>₱${total.toFixed(2)}</strong>`;

            AppState.totalDue = total;
            return;
        }

        if (AppState.rentalType === 'fixed') {
            const tier = AppState.rentalPricing.fixed_duration_tiers.find(t => t.hours === AppState.durationHours);
            const total = tier.price;

            document.getElementById('payment-rental-type').innerText = 'Fixed Duration';
            durationLabel.innerText = 'Duration';
            durationValue.innerText = tier.label;
            feeValue.innerText = `₱${tier.price}`;
            totalValue.innerHTML = `<strong>₱${total}</strong>`;

            AppState.totalDue = total;
        }
    }
};
