"""
Flask application factory for Coin Cubby Kiosk.
"""
from flask import Flask
from .config import Config


def create_app():
    app = Flask(
        __name__,
        static_folder='../static',
        template_folder='../templates'
    )
    app.config.from_object(Config)

    # Initialize hardware manager
    from .hardware.manager import HardwareManager
    app.hardware = HardwareManager(app.config)

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.compartments import compartments_bp
    from .routes.rentals import rentals_bp
    from .routes.hardware import hardware_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(compartments_bp, url_prefix='/api/compartments')
    app.register_blueprint(rentals_bp, url_prefix='/api/rentals')
    app.register_blueprint(hardware_bp, url_prefix='/api/hardware')

    # Serve the kiosk UI
    from flask import render_template

    @app.route('/')
    def index():
        return render_template('index.html', kiosk_api_token=app.config['KIOSK_API_TOKEN'])

    return app
