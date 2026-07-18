const API_BASE = '/api';

class ApiClient {
    static getKioskToken() {
        const meta = document.querySelector('meta[name="kiosk-api-token"]');
        return meta ? meta.content : '';
    }

    static async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Kiosk-Token': this.getKioskToken(),
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

    static async retrieveRental(rentalId, paymentMethod = null, userId = null, cashInserted = null) {
        const body = { payment_method: paymentMethod };
        if (userId) {
            body.user_id = userId;
        }
        if (cashInserted !== null) {
            body.cash_inserted = cashInserted;
        }
        return this.request(`/rentals/${rentalId}/retrieve`, {
            method: 'POST',
            body: JSON.stringify(body)
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

    static async getCashDebug() {
        return this.request('/hardware/cash/debug');
    }

    static async insertCash(amount) {
        return this.request('/hardware/cash/insert', {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
    }

    static async getCompartmentRental(compartmentId) {
        return this.request(`/rentals/compartment/${compartmentId}/active`);
    }

    static async adminLogin(kiosk_admin_id, kiosk_admin_password) {
        return this.request('/auth/admin/login', {
            method: 'POST',
            body: JSON.stringify({ kiosk_admin_id, kiosk_admin_password })
        });
    }

    static async adminVerifyOtp(admin_id, verification_code) {
        return this.request('/auth/admin/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ admin_id, verification_code })
        });
    }

    static async adminEmergencyUnlock(compartmentId) {
        return this.request(`/rentals/compartment/${compartmentId}/emergency-unlock`, {
            method: 'POST'
        });
    }
}
window.Api = ApiClient;
