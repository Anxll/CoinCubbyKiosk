window.AdminVerifyOtpScreen = {
    otp: '',
    generatedOtp: '',
    numpad: null,

    init() {
        this.otp = '';
        this.generatedOtp = AppState.adminGeneratedOtp || '';
        this._renderBoxes();

        if (!this.numpad) {
            this.numpad = new Numpad('numpad-admin-otp', (key) => this.handleInput(key));
        }

        // For demonstration, log the OTP or display it in console
        console.log("Admin OTP Generated:", this.generatedOtp);
    },

    handleInput(key) {
        if (key === 'CLEAR') {
            this.otp = '';
        } else if (key === 'DEL') {
            this.otp = this.otp.slice(0, -1);
        } else if (this.otp.length < 6) {
            this.otp += key;
        }

        this._renderBoxes();
    },

    _renderBoxes() {
        const boxes = document.getElementById('admin-otp-boxes');
        if (!boxes) return;
        let html = '';
        for (let i = 0; i < 6; i++) {
            const active = (i === this.otp.length) ? 'active' : '';
            let char = this.otp[i] || '';
            html += `<div class="digit-box ${active}">${char}</div>`;
        }
        boxes.innerHTML = html;
    },

    async submit() {
        if (this.otp.length !== 6) {
            alert('Please enter the 6-digit Verification PIN.');
            return;
        }

        const btn = document.getElementById('btn-admin-verify-otp');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round">hourglass_empty</span> VERIFYING...';

        try {
            // Hit the Supabase backend to verify the OTP
            const res = await Api.adminVerifyOtp(AppState.adminId, this.otp);
            if (!res.success) {
                throw new Error('Invalid Verification PIN. Access Denied.');
            }

            // Success, navigate to dashboard
            App.navigate('admin-dashboard');
        } catch (e) {
            alert(e.message);
            this.otp = '';
            this._renderBoxes();
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'VERIFY';
        }
    }
};
