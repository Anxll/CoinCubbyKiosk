"""
Kiosk security helpers for local API access control.
"""
from functools import wraps
from flask import current_app, jsonify, request


def require_kiosk_token(view_function):
    @wraps(view_function)
    def wrapped(*args, **kwargs):
        expected_token = current_app.config.get('KIOSK_API_TOKEN')
        provided_token = request.headers.get('X-Kiosk-Token') or request.args.get('token')

        if not expected_token or provided_token != expected_token:
            return jsonify({'error': 'Unauthorized'}), 401

        return view_function(*args, **kwargs)

    return wrapped
