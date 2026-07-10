class Numpad {
    constructor(containerId, onInputCallback) {
        this.container = document.getElementById(containerId);
        this.onInput = onInputCallback;
        this.render();
    }

    render() {
        const keys = ['1','2','3','4','5','6','7','8','9','CLEAR','0','DEL'];
        let html = '<div class="numpad">';
        keys.forEach(k => {
            html += `<button class="numpad-btn" data-key="${k}">
                ${k === 'DEL' ? '<span class="material-icons-round">backspace</span>' : k}
            </button>`;
        });
        html += '</div>';
        this.container.innerHTML = html;

        this.container.querySelectorAll('.numpad-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.onInput(btn.getAttribute('data-key'));
            });
        });
    }
}
window.Numpad = Numpad;
