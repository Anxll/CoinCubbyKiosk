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

            let data = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }

            if (!response.ok) {
                const error = new Error((data && data.error) || 'API Request Failed');
                error.status = response.status;
                error.data = data;
                throw error;
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

    static async cashoutInventory() {
        return this.request('/inventory/cashout', {
            method: 'POST'
        });
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
        // The thermal printer blocks indefinitely when out of paper.
        // The server enforces a 15s timeout and returns HTTP 408 / error:'no_paper'.
        // We add a 8s client-side AbortController as a last-resort safety net.
        const RECEIPT_TIMEOUT_MS = 8_000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), RECEIPT_TIMEOUT_MS);

        try {
            const response = await fetch(`${API_BASE}/hardware/print-receipt`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Kiosk-Token': this.getKioskToken(),
                },
                body: JSON.stringify(data),
            });

            clearTimeout(timer);

            let payload = null;
            try { payload = await response.json(); } catch { /* no body */ }

            if (!response.ok) {
                if (payload && payload.error === 'no_paper') {
                    const err = new Error('no_paper');
                    err.code = 'no_paper';
                    throw err;
                }
                throw new Error((payload && payload.error) || 'Print request failed');
            }
            return payload;
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') {
                const timeoutErr = new Error('no_paper');
                timeoutErr.code = 'no_paper';
                throw timeoutErr;
            }
            throw err;
        }
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

    static async adminResendOtp(admin_id) {
        return this.request('/auth/admin/resend-otp', {
            method: 'POST',
            body: JSON.stringify({ admin_id })
        });
    }
}
window.Api = ApiClient;
