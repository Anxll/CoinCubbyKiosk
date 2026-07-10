window.RentalTypeScreen = {
    init() {
        if (!AppState.selectedCompartment) return App.navigate('dashboard');
        document.getElementById('rental-type-compartment').innerText = `Compartment: ${AppState.selectedCompartment.code}`;
    }
};
