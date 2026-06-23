# Secrets — VendorCompare Backend

## SECRET_KEY
- Used to sign JWT login tokens (`auth_deps.py`)
- Default `dev-secret-change-in-prod` is **unsafe for production**
- The default value was present in early commits — **rotate before any production deploy**
- To rotate: generate a new value, deploy with new value, old JWTs invalidate on restart (acceptable — users re-login)
- Generate: `python3 -c "import secrets; print(secrets.token_hex(32))"`
- Store in `.env` (gitignored), never in code or version control
