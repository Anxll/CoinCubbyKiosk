window.LoginScreen = {
    userId: '',
    pin: '',
    activeInput: 'userid',
    showPin: false,
    
    init() {
        this.userId = '';
        this.pin = '';
        this.activeInput = 'userid';
        this.showPin = false;
        this.updateBoxes('userid', 6);
        this.updateBoxes('pin', 6);
        this.updateToggleIcon();
        
        document.getElementById('userid-group').classList.add('input-group-active');
        document.getElementById('pin-group').classList.remove('input-group-active');
        
        if (!this.numpad) {
            this.numpad = new Numpad('numpad-rent', this.handleInput.bind(this));
        }
    },

    togglePinVisibility() {
        this.showPin = !this.showPin;
        this.updateToggleIcon();
        this.updateBoxes('pin', 6);
    },

    updateToggleIcon() {
        const icon = document.getElementById('pin-visibility-icon');
        if (icon) {
            icon.innerText = this.showPin ? 'visibility_off' : 'visibility';
        }
    },

    handleInput(key) {
        let current = this.activeInput === 'userid' ? this.userId : this.pin;
        let maxLen = this.activeInput === 'userid' ? 6 : 6;
        
        if (key === 'CLEAR') {
            current = '';
        } else if (key === 'DEL') {
            current = current.slice(0, -1);
        } else if (current.length < maxLen) {
            current += key;
        }

        if (this.activeInput === 'userid') {
            this.userId = current;
            if (this.userId.length === 6) {
                this.activeInput = 'pin';
                document.getElementById('userid-group').classList.remove('input-group-active');
                document.getElementById('pin-group').classList.add('input-group-active');
            }
        } else {
            this.pin = current;
            if (this.pin.length === 0) {
                 this.activeInput = 'userid';
                 document.getElementById('pin-group').classList.remove('input-group-active');
                 document.getElementById('userid-group').classList.add('input-group-active');
            }
        }
        
        this.updateBoxes('userid', 6);
        this.updateBoxes('pin', 6);
    },

    updateBoxes(type, len) {
        const val = type === 'userid' ? this.userId : this.pin;
        const boxes = document.getElementById(`${type}-boxes`);
        let html = '';
        for (let i = 0; i < len; i++) {
            let active = (type === this.activeInput && i === val.length) ? 'active' : '';
            let char = val[i] || '';
            if (type === 'pin' && char) {
                char = this.showPin ? val[i] : '•';
            }
            html += `<div class="digit-box ${active}">${char}</div>`;
        }
        boxes.innerHTML = html;
    },

    async submit() {
        if (this.userId.length !== 6 || this.pin.length !== 6) {
            alert('Please enter complete User ID and Password.');
            return;
        }
        
        const btn = document.getElementById('btn-login-continue');
        btn.disabled = true;
        App.showLoading('Logging in...');
        
        try {
            const res = await Api.login(this.userId, this.pin);
            App.navigate('account', { user: res.user });
        } catch (e) {
            alert(e.message);
        } finally {
            App.hideLoading();
            btn.disabled = false;
        }
    }
};
