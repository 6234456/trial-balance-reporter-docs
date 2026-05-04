# Reveal.js Report

## Output Contract

The main export is a self-contained interactive HTML file.

It MUST embed:

- Reveal.js runtime
- D3 runtime
- report theme CSS
- StatementModel JSON
- ChartDataModel JSON
- chart renderers
- runtime controls

It MUST NOT rely on CDN or network calls.

## Runtime Controls

The exported HTML SHOULD support:

- amount scale: raw / thousand / million
- PL view mode: YTD / period activity
- replay animation
- basic tooltips
