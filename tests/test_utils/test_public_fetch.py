import socket

import httpx
import pytest

from fourdpocket.utils.ssrf import ResponseTooLargeError, fetch_public_url


def test_public_redirect_rechecks_dns_and_preserves_hostname(monkeypatch):
    resolutions = {
        "example.com": "93.184.215.14",
        "example.org": "93.184.215.15",
    }
    seen = []

    def resolve(host, _service):
        return [(socket.AF_INET, socket.SOCK_STREAM, 0, "", (resolutions[host], 0))]

    def handler(request):
        seen.append((request.url.host, request.headers["Host"], request.extensions["sni_hostname"]))
        if request.headers["Host"] == "example.com":
            return httpx.Response(302, headers={"Location": "https://example.org/content"})
        return httpx.Response(200, content=b"hello")

    original_client = httpx.Client
    monkeypatch.setattr("socket.getaddrinfo", resolve)
    monkeypatch.setattr("httpx.Client", lambda **kwargs: original_client(
        transport=httpx.MockTransport(handler), **kwargs,
    ))
    response = fetch_public_url("https://example.com/")
    assert response.content == b"hello"
    assert str(response.url) == "https://example.org/content"
    assert seen == [
        ("93.184.215.14", "example.com", "example.com"),
        ("93.184.215.15", "example.org", "example.org"),
    ]


def test_public_fetch_caps_body_without_content_length(monkeypatch):
    class Content(httpx.SyncByteStream):
        def __iter__(self):
            yield b"example"

    original_client = httpx.Client
    monkeypatch.setattr("fourdpocket.utils.ssrf.resolve_and_check", lambda _url: "93.184.215.14")
    monkeypatch.setattr("httpx.Client", lambda **kwargs: original_client(
        transport=httpx.MockTransport(lambda _request: httpx.Response(200, stream=Content())),
        **kwargs,
    ))
    with pytest.raises(ResponseTooLargeError):
        fetch_public_url("https://example.com/", max_bytes=5)
