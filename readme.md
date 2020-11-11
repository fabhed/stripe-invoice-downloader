# Stripe Invoice Downloader
A Node.js CLI to download PDF invoices from Stripe.

## Install
```sh
git clone https://github.com/minifjurt123/stripe-invoice-downloader
cd stripe-invoice-downloader
cp .env.example .env
npm i
```
Edit `.env` and enter your Stripe secret key. 

## Usage
```sh
# year is required, month and date are optional
npm start [year] [month] [date]
```
The downloaded PDFs will be put into a `downloads` folder in the repo.
## Examples
```sh
# Will get all invoices created between 2020-01-01 - 2020-12-31
npm start 2020
```

```sh
# Will get all invoices created between 2020-01-01 - 2020-01-29
npm start 2020 1
```

```sh
# Will get all invoices created on 2020-01-01
npm start 2020 1 1
```
## Background
This tool was created to easily get PDF versions of VAT Invoices required when bookkeeping in Sweden.
