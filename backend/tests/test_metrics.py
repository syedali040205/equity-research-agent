"""Pure-math tests for derived metrics — no DB, no network."""
from tools.financials import Financials, FinancialPeriod
from tools.metrics import compute_derived_metrics


def _fin(latest_revenue, latest_net, prior_revenue=None,
         gross=None, op=None, debt=None, equity=None, fcf=None):
    periods = [FinancialPeriod(
        period_end="2024-09-30",
        revenue=latest_revenue, net_income=latest_net,
        gross_profit=gross, operating_income=op,
        total_debt=debt, total_equity=equity, free_cash_flow=fcf,
    )]
    if prior_revenue is not None:
        periods.append(FinancialPeriod(period_end="2023-09-30", revenue=prior_revenue))
    return Financials(ticker="X", period_type="annual", periods=periods)


def test_net_margin():
    m = compute_derived_metrics(_fin(latest_revenue=1000, latest_net=250))
    assert m.net_margin_pct == 25.0


def test_revenue_growth():
    m = compute_derived_metrics(_fin(latest_revenue=1200, latest_net=0, prior_revenue=1000))
    assert m.revenue_yoy_growth_pct == 20.0


def test_debt_to_equity():
    m = compute_derived_metrics(_fin(
        latest_revenue=100, latest_net=10, debt=500, equity=250,
    ))
    assert m.debt_to_equity == 2.0


def test_div_by_zero_returns_none():
    m = compute_derived_metrics(_fin(latest_revenue=0, latest_net=10))
    assert m.net_margin_pct is None


def test_no_periods_returns_error():
    f = Financials(ticker="X", period_type="annual", periods=[])
    m = compute_derived_metrics(f)
    assert m.error is not None
