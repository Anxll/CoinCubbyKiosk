window.AdminLoginScreen = {
    userId: '',
    pin: '',
    activeInput: 'userid',
    numpad: null,

    init() {
        this.userId = '';
        this.pin = '';
        this.activeInput = 'userid';
        document.getElementById('admin-login-error').innerText = '';

        this._render();

        document.getElementById('admin-userid-group').classList.add('input-group-active');
        document.getElementById('admin-pin-group').classList.remove('input-group-active');

        if (!this.numpad) {
            this.numpad = new Numpad('numpad-admin', (key) => this.handleInput(key));
        }
    },

    handleInput(key) {
        let current = this.activeInput === 'userid' ? this.userId : this.pin;

        if (key === 'CLEAR') {
            current = '';
        } else if (key === 'DEL') {
            current = current.slice(0, -1);
        } else if (current.length < 6) {
            current += key;
        }

        if (this.activeInput === 'userid') {
            this.userId = current;
            if (this.userId.length === 6) {
                this.activeInput = 'pin';
                document.getElementById('admin-userid-group').classList.remove('input-group-active');
                document.getElementById('admin-pin-group').classList.add('input-group-active');
            }
        } else {
            this.pin = current;
            if (this.pin.length === 0) {
                this.activeInput = 'userid';
                document.getElementById('admin-pin-group').classList.remove('input-group-active');
                document.getElementById('admin-userid-group').classList.add('input-group-active');
            }
        }

        this._render();
    },

    _render() {
        this._renderBoxes('admin-userid-boxes', this.userId, this.activeInput === 'userid', false);
        this._renderBoxes('admin-pin-boxes',    this.pin,    this.activeInput === 'pin',    true);
    },

    _renderBoxes(containerId, val, isActive, mask) {
        const boxes = document.getElementById(containerId);
        if (!boxes) return;
        let html = '';
        for (let i = 0; i < 6; i++) {
            const active = (isActive && i === val.length) ? 'active' : '';
            let char = val[i] || '';
            if (mask && char) char = '•';
            html += `<div class="digit-box ${active}">${char}</div>`;
        }
        boxes.innerHTML = html;
    },

    async submit() {
        const errorEl = document.getElementById('admin-login-error');
        errorEl.innerText = '';
        if (this.userId.length !== 6 || this.pin.length !== 6) {
            errorEl.innerText = 'Please enter complete Admin ID and Password.';
            return;
        }

        App.showLoading('Verifying Admin Credentials...');
        const btn = document.getElementById('btn-admin-continue');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-circle"></span> VERIFYING...';

        try {
            // Call the real API
            const res = await Api.adminLogin(this.userId, this.pin);
            
            if (!res.success) {
                throw new Error('Invalid admin credentials.');
            }

            // Save the returned OTP and admin UUID in state to pass to verify screen
            AppState.adminId = res.admin_id;
            AppState.adminGeneratedOtp = res.generated_otp;

            // Navigate to OTP verify screen
            App.navigate('admin-verify-otp');
        } catch (e) {
            errorEl.innerText = e.message || 'Login failed.';
        } finally {
            App.hideLoading();
            btn.disabled = false;
            btn.innerHTML = 'CONTINUE';
        }
    }
};

