"""Pure-function tests for shared helpers — no DB, no network."""
from tools._common import normalize_ticker, safe_float, safe_int


def test_normalize_valid():
    assert normalize_ticker("aapl") == "AAPL"
    assert normalize_ticker("BRK-B") == "BRK-B"
    assert normalize_ticker("BRK.B") == "BRK.B"
    assert normalize_ticker("  msft  ") == "MSFT"


def test_normalize_invalid():
    assert normalize_ticker("") is None
    assert normalize_ticker(None) is None
    assert normalize_ticker("123") is None
    assert normalize_ticker("TOOLONGTICKER") is None
    assert normalize_ticker("AB CD") is None


def test_safe_float():
    assert safe_float(1.5) == 1.5
    assert safe_float("2.0") == 2.0
    assert safe_float(None) is None
    assert safe_float(float("nan")) is None
    assert safe_float(float("inf")) is None
    assert safe_float("not a number") is None


def test_safe_int():
    assert safe_int(1.7) == 1
    assert safe_int(None) is None
    assert safe_int(float("nan")) is None
