DEMO_ACCOUNT_EMAILS = {
    "free": "free@example.com",
    "premium": "premium@example.com",
    "admin": "admin@example.com",
}

# Older demo databases used .local addresses that EmailStr correctly rejects
# at the API boundary. A successful login migrates the matching legacy row.
LEGACY_DEMO_ACCOUNT_EMAILS = {
    "free@example.com": "free@demo.local",
    "premium@example.com": "premium@demo.local",
    "admin@example.com": "admin@demo.local",
}
