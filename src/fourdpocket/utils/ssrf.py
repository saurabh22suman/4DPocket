"""Public URL validation and bounded, DNS-pinned HTTP requests."""

import ipaddress
import socket
from collections.abc import Iterator, Mapping
from contextlib import contextmanager

import httpx

DEFAULT_BODY_LIMIT = 10 * 1024 * 1024
_REDIRECTS = {301, 302, 303, 307, 308}


class BlockedURLError(ValueError):
    """The URL is outside the public HTTP fetch policy."""


class ResponseTooLargeError(ValueError):
    """The response exceeds the caller's byte limit."""


def _public_ip(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast and not ip.is_reserved


def resolve_and_check(url: str | httpx.URL) -> str | None:
    """Return a public IP to connect to, rejecting mixed public/private answers."""
    try:
        parsed = httpx.URL(url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.host
            or parsed.username
            or parsed.password
        ):
            return None
        answers = socket.getaddrinfo(parsed.raw_host.decode("ascii"), None)
        addresses = list(dict.fromkeys(answer[4][0] for answer in answers))
        if not addresses or not all(_public_ip(address) for address in addresses):
            return None
        # Prefer IPv4 on dual-stack sites while retaining IPv6-only support.
        return next((address for address in addresses if ":" not in address), addresses[0])
    except (OSError, ValueError, httpx.InvalidURL):
        return None


def is_safe_url(url: str) -> bool:
    """Check a URL before storing it. Use the stream helper for network access."""
    return resolve_and_check(url) is not None


@contextmanager
def stream_public_url(
    url: str,
    *,
    headers: Mapping[str, str] | None = None,
    timeout: float = 20,
    max_redirects: int = 5,
) -> Iterator[httpx.Response]:
    """Open a public GET with the checked address, original Host and TLS SNI."""
    try:
        current = httpx.URL(url)
    except httpx.InvalidURL as exc:
        raise BlockedURLError("Invalid public URL") from exc
    request_headers = httpx.Headers(headers)
    for name in ("authorization", "proxy-authorization", "cookie"):
        request_headers.pop(name, None)
    request_headers["Accept-Encoding"] = "identity"

    for _ in range(max_redirects + 1):
        address = resolve_and_check(current)
        if address is None:
            raise BlockedURLError("URL blocked: destination must resolve to public addresses")
        request_headers["Host"] = current.netloc.decode("ascii")
        hostname = current.raw_host.decode("ascii")

        # A separate client per hop keeps TLS connections from being reused
        # across different hostnames that resolve to the same address.
        with httpx.Client(timeout=timeout, trust_env=False, follow_redirects=False) as client:
            with client.stream(
                "GET",
                current.copy_with(host=address),
                headers=request_headers,
                extensions={"sni_hostname": hostname},
            ) as response:
                response.request = httpx.Request("GET", current)
                location = response.headers.get("location")
                if response.status_code in _REDIRECTS and location and max_redirects:
                    try:
                        current = current.join(location)
                    except httpx.InvalidURL as exc:
                        raise BlockedURLError("Invalid redirect URL") from exc
                    continue
                yield response
                return

    raise httpx.TooManyRedirects("Too many public URL redirects")


def iter_bounded(response: httpx.Response, max_bytes: int) -> Iterator[bytes]:
    length = response.headers.get("content-length", "")
    if length.isascii() and length.isdecimal() and (
        len(length) > len(str(max_bytes)) or int(length) > max_bytes
    ):
        raise ResponseTooLargeError("Upstream response exceeds the byte limit")

    total = 0
    for chunk in response.iter_bytes(chunk_size=65536):
        total += len(chunk)
        if total > max_bytes:
            raise ResponseTooLargeError("Upstream response exceeds the byte limit")
        yield chunk


def fetch_public_url(
    url: str,
    *,
    headers: Mapping[str, str] | None = None,
    timeout: float = 20,
    max_redirects: int = 5,
    max_bytes: int = DEFAULT_BODY_LIMIT,
) -> httpx.Response:
    with stream_public_url(
        url, headers=headers, timeout=timeout, max_redirects=max_redirects
    ) as response:
        response.raise_for_status()
        body = b"".join(iter_bounded(response, max_bytes))
        response_headers = response.headers.copy()
        for name in ("content-encoding", "transfer-encoding", "content-length"):
            response_headers.pop(name, None)
        return httpx.Response(
            response.status_code,
            headers=response_headers,
            content=body,
            request=response.request,
        )
