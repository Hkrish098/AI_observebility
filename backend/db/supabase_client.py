from functools import lru_cache

from supabase import Client, create_client

from core.config import settings


@lru_cache(maxsize=1)
def get_supabase() -> Client | None:
    if not settings.supabase_configured:
        return None
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
