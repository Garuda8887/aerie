# Data sources

Aerie has no backend, so everything it needs must be public and downloadable by you.

## 1. Fund holdings (required)

SEBI requires every AMC to publish each scheme's portfolio on its website and on AMFI's website, in spreadsheet form, within 10 days of month-end (and half-yearly with ISINs). Start at AMFI's consolidated page:

<https://www.amfiindia.com/online-center/portfolio-disclosure>

Most AMCs publish one workbook per month with a sheet per scheme. A few publish one file per scheme. Both work: drop the file into **Manage funds**.

What Aerie reads from each sheet: instrument name, ISIN, industry or rating, quantity, market value, % to NAV. Only ISIN and one of (% to NAV, market value) are strictly required.

## 2. Large / mid / small cap list (recommended)

AMFI publishes, every half-year, a ranked list of listed companies with their average market capitalisation and a Large / Mid / Small tag (SEBI's definition: top 100 by full market cap = large, 101-250 = mid, 251+ = small). Search for "AMFI categorisation of stocks" for the current Excel.

Load it from **Manage funds > Large, mid and small caps**. Aerie finds the ISIN column and the Large/Mid/Small Cap column by their contents, so header wording and column order do not matter. The list is stored in your browser.

Funds rebalance towards the new list after each release, so use the list that matches the month of your holdings file.

## 3. NAV and scheme metadata (not used in v0.1)

[mfapi.in](https://www.mfapi.in/) is a free community API over AMFI's NAV data (scheme code, name, fund house, category, ISIN, NAV history). It has no holdings. It is the natural source for project 2 (valuing units at today's NAV) and for scheme search.

## What is *not* available

There is no public API that returns a fund's holdings as JSON, and no account-aggregator-free way to see *your* holdings. That is why you enter the amounts yourself.
