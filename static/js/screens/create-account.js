window.CreateAccountScreen = {
    init() {
        const qrContainer = document.getElementById('qr-code-container');
        // Simple static QR code for the web app registration page
        // Use an API to generate or just an img tag pointing to a generic QR
        qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://coincubby.vercel.app/#/register" alt="QR Code">`;
    }
};
