window.AdminVerifyOtpScreen = {
    otp: '',
    generatedOtp: '',
    numpad: null,
    timerInterval: null,
    timeLeft: 60,

    init() {
        this.otp = '';
        this.generatedOtp = AppState.adminGeneratedOtp || '';
        this._renderBoxes();

        // Clear any old timer before starting fresh
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.startTimer();

        if (!this.numpad) {
            this.numpad = new Numpad('numpad-admin-otp', (key) => this.handleInput(key));
        }

        console.log("Admin OTP Generated:", this.generatedOtp);
    },

    startTimer() {
        const self = this;
        self.timeLeft = 60;

        const timerText = document.getElementById('admin-otp-timer-text');
        const resendBtn = document.getElementById('btn-admin-resend-otp');
        const timerEl = document.getElementById('admin-otp-timer');

        if (!timerEl) return;

        timerText.style.display = 'inline-block';
        resendBtn.style.display = 'none';
        timerEl.innerText = self.timeLeft;

        if (self.timerInterval) clearInterval(self.timerInterval);

        self.timerInterval = setInterval(function () {
            self.timeLeft--;
            timerEl.innerText = self.timeLeft;

            if (self.timeLeft <= 0) {
                clearInterval(self.timerInterval);
                self.timerInterval = null;
                timerText.style.display = 'none';
                resendBtn.style.display = 'inline-block';
            }
        }, 1000);
    },

    async resendOtp() {
        const resendBtn = document.getElementById('btn-admin-resend-otp');
        resendBtn.innerText = 'SENDING...';
        resendBtn.disabled = true;
        App.showAdminLoading('Loading...');

        try {
            const res = await Api.adminResendOtp(AppState.adminId);
            if (!res.success) throw new Error('Failed to generate new OTP.');

            // Update stored OTP for display
            AppState.adminGeneratedOtp = res.generated_otp;
            console.log("Admin OTP Resent:", res.generated_otp);

            // Restart countdown
            this.startTimer();
        } catch (e) {
            console.error(e);
            App.showDialog('Failed to resend OTP: ' + (e.message || e), 'Resend Failed');
        } finally {
            App.hideAdminLoading();
            resendBtn.innerText = 'RESEND CODE';
            resendBtn.disabled = false;
        }
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
            App.showDialog('Please enter the 6-digit Verification PIN.', 'Verification Required');
            return;
        }

        const btn = document.getElementById('btn-admin-verify-otp');
        btn.disabled = true;
        btn.innerHTML = 'VERIFYING...';
        App.showAdminLoading('Loading...');

        try {
            const response = await fetch('/api/auth/admin/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Kiosk-Token': document.querySelector('meta[name="kiosk-api-token"]')?.content || ''
                },
                body: JSON.stringify({
                    admin_id: AppState.adminId,
                    verification_code: this.otp
                })
            });

            const res = await response.json();
            console.log('OTP verification response:', res);

            if (!response.ok) {
                throw new Error(res.error || 'Invalid Verification PIN. Access Denied.');
            }

            if (!res.success) {
                throw new Error('Invalid Verification PIN. Access Denied.');
            }

            App.navigate('admin-dashboard');
        } catch (e) {
            App.showDialog(e.message || 'Verification failed.', 'Verification Failed');
            this.otp = '';
            this._renderBoxes();
        } finally {
            App.hideAdminLoading();
            btn.disabled = false;
            btn.innerHTML = 'VERIFY';
        }
    }
};
