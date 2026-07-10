const API_BASE = '/api';

class ApiClient {
    static async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'API Request Failed');
            }
            return data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    static async login(user_code, pin) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ user_code, pin })
        });
    }

    static async getUser(user_code) {
        return this.request(`/auth/user/${user_code}`);
    }

    static async getCompartments(module = '') {
        const query = module ? `?module=${module}` : '';
        return this.request(`/compartments/${query}`);
    }

    static async getPricing(compartmentId) {
        return this.request(`/rentals/pricing?compartment_id=${compartmentId}`);
    }

    static async createRental(data) {
        return this.request('/rentals/', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async getActiveRentals(userId) {
        return this.request(`/rentals/active/${userId}`);
    }

    static async retrieveRental(rentalId, paymentMethod = null) {
        return this.request(`/rentals/${rentalId}/retrieve`, {
            method: 'POST',
            body: JSON.stringify({ payment_method: paymentMethod })
        });
    }

    static async printReceipt(data) {
        return this.request('/hardware/print-receipt', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async startCash(targetAmount) {
        return this.request('/hardware/cash/start', {
            method: 'POST',
            body: JSON.stringify({ target_amount: targetAmount })
        });
    }

    static async stopCash() {
        return this.request('/hardware/cash/stop', { method: 'POST' });
    }
}
window.Api = ApiClient;
