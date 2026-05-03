"""20-ticker watchlist across 5 sectors. Drives every ETL pipeline."""

WATCHLIST = {
    "tech":       ["AAPL", "MSFT", "NVDA", "META", "GOOGL"],
    "finance":    ["JPM",  "BAC",  "GS",   "V",    "BRK-B"],
    "energy":     ["XOM",  "CVX",  "COP",  "SLB",  "EOG"],
    "healthcare": ["JNJ",  "UNH",  "PFE",  "ABBV", "MRK"],
    "consumer":   ["AMZN", "TSLA", "WMT",  "KO",   "MCD"],
}

# Friendly names + sectors used to seed the `companies` table.
COMPANY_META = {
    "AAPL":  ("Apple Inc.",                  "tech",       "Consumer Electronics"),
    "MSFT":  ("Microsoft Corporation",       "tech",       "Software"),
    "NVDA":  ("NVIDIA Corporation",          "tech",       "Semiconductors"),
    "META":  ("Meta Platforms Inc.",         "tech",       "Internet Content & Information"),
    "GOOGL": ("Alphabet Inc.",               "tech",       "Internet Content & Information"),
    "JPM":   ("JPMorgan Chase & Co.",        "finance",    "Banks - Diversified"),
    "BAC":   ("Bank of America Corporation", "finance",    "Banks - Diversified"),
    "GS":    ("Goldman Sachs Group Inc.",    "finance",    "Capital Markets"),
    "V":     ("Visa Inc.",                   "finance",    "Credit Services"),
    "BRK-B": ("Berkshire Hathaway Inc.",     "finance",    "Insurance - Diversified"),
    "XOM":   ("Exxon Mobil Corporation",     "energy",     "Oil & Gas Integrated"),
    "CVX":   ("Chevron Corporation",         "energy",     "Oil & Gas Integrated"),
    "COP":   ("ConocoPhillips",              "energy",     "Oil & Gas E&P"),
    "SLB":   ("Schlumberger Limited",        "energy",     "Oil & Gas Equipment"),
    "EOG":   ("EOG Resources Inc.",          "energy",     "Oil & Gas E&P"),
    "JNJ":   ("Johnson & Johnson",           "healthcare", "Drug Manufacturers"),
    "UNH":   ("UnitedHealth Group Inc.",     "healthcare", "Healthcare Plans"),
    "PFE":   ("Pfizer Inc.",                 "healthcare", "Drug Manufacturers"),
    "ABBV":  ("AbbVie Inc.",                 "healthcare", "Drug Manufacturers"),
    "MRK":   ("Merck & Co. Inc.",            "healthcare", "Drug Manufacturers"),
    "AMZN":  ("Amazon.com Inc.",             "consumer",   "Internet Retail"),
    "TSLA":  ("Tesla Inc.",                  "consumer",   "Auto Manufacturers"),
    "WMT":   ("Walmart Inc.",                "consumer",   "Discount Stores"),
    "KO":    ("The Coca-Cola Company",       "consumer",   "Beverages"),
    "MCD":   ("McDonald's Corporation",      "consumer",   "Restaurants"),
}


def all_tickers() -> list[str]:
    return [t for tickers in WATCHLIST.values() for t in tickers]
