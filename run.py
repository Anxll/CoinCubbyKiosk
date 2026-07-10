"""
Coin Cubby Kiosk Application Entry Point
Runs the Flask server that serves both the kiosk UI and the hardware API.
"""
from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=app.config.get('DEBUG', False)
    )
