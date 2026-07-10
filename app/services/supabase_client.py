"""
Supabase client singleton for database operations.
"""
from supabase import create_client, Client
from ..config import Config

_client: Client = None


def get_supabase() -> Client:
    """Get or create the Supabase client singleton."""
    global _client
    if _client is None:
        _client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
    return _client
