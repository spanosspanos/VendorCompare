"""Security configuration helpers."""
import os

DEFAULT_SECRET_KEY = "dev-secret-change-in-prod"
_DEV_ENVS = {"", "development", "dev", "local", "test", "testing"}


def get_secret_key() -> str:
    """Return SECRET_KEY, refusing unsafe production configuration.

    Local/dev runs keep the historical convenience default. Any production-like
    runtime must provide a real per-environment/per-install secret.
    """
    secret = os.getenv("SECRET_KEY")
    env = (
        os.getenv("VENDORCOMPARE_ENV")
        or os.getenv("APP_ENV")
        or os.getenv("ENVIRONMENT")
        or os.getenv("NODE_ENV")
        or ""
    ).lower()
    is_prod = env not in _DEV_ENVS or os.getenv("VENDORCOMPARE_FAIL_FAST_SECRET", "").lower() in {"1", "true", "yes"}

    if is_prod and (not secret or secret == DEFAULT_SECRET_KEY):
        raise RuntimeError("SECRET_KEY must be set to a non-default value in production")

    return secret or DEFAULT_SECRET_KEY
