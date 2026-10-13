"""
Shared rate limiter using slowapi. Keyed by client IP by default — good
enough for MVP. For production behind a load balancer, make sure
X-Forwarded-For is trusted/parsed correctly (see slowapi docs), or move
rate limiting to a reverse-proxy layer (e.g. Nginx, Cloudflare) instead.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
