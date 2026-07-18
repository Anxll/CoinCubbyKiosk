"""
Coin Cubby Kiosk Application Entry Point
Runs the Flask server that serves both the kiosk UI and the hardware API.
"""
import os
os.environ["GPIOZERO_PIN_FACTORY"] = 'pigpio'
from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(
        host=os.getenv('FLASK_HOST', '127.0.0.1'),
        port=int(os.getenv('FLASK_PORT', '5000')),
        debug=app.config.get('DEBUG', False),
        threaded=True
    )
