const fetch = require("node-fetch");
const fs = require("fs");
const { DateTime } = require("luxon");
require("dotenv").config({ path: __dirname + "/.env" });
console.log("process.env.SECRET_KEY", process.env.STRIPE_SECRET);
const stripe = require("stripe")(process.env.STRIPE_SECRET);

let batchNum = 0,
  downloadNum = 0,
  allInvoices = [];

/**
 * Download and save a file from a URL
 * @param {*} url The URL of the file to download
 * @param {*} path Where to save the file
 */
async function downloadFile(url, path) {
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(path);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
}

/**
 * Will download PDFs of all invoices created between startDate and endDate into directory.
 * This function will call itself recursively until all files are downloaded.
 * See https://stripe.com/docs/api/invoices/list
 * @param {String} directory Where to save the invoices
 * @param {Number} unixStart Starting UNIX time of the interval
 * @param {Number} unixEnd Ending UNIX time of the interval
 * @param {Number} limit Page size - will download this amount of invoices concurently, then wait for all of them to finish until starting the next batch.
 * @param {Number} starting_after Used by the Stripe API for pagination.
 */
async function downloadInvoices(
  directory,
  unixStart,
  unixEnd,
  limit = 5,
  starting_after
) {
  const { data, has_more } = await stripe.invoices.list({
    limit,
    starting_after,
    created: {
      gte: unixStart,
      lte: unixEnd,
    },
  });
  batchNum++;
  allInvoices = allInvoices.concat(data);
  console.log(`Batch ${batchNum}: Found ${data.length} invoice(s) to download`);
  // Download the pdfs
  const promises = [];
  for (let i of data) {
    const filePath = directory + i.id + ".pdf";
    promises.push(downloadFile(i.invoice_pdf, filePath));
    console.log("Started downloading", i.invoice_pdf);
    downloadNum++;
  }
  try {
    await Promise.all(promises);
  } catch (error) {
    console.error(`Failed on batch ${batchNum}.`, error);
    return;
  }
  // Start next batch, if it exists
  if (has_more) {
    await downloadInvoices(
      directory,
      unixStart,
      unixEnd,
      limit,
      data[data.length - 1].id
    );
  }
}

async function main() {
  // Parse input
  let year, month, date;
  try {
    year = process.argv[2] && Number(process.argv[2]);
    month = process.argv[3] && Number(process.argv[3]);
    date = process.argv[4] && Number(process.argv[4]);
    if (
      isNaN(year) ||
      (month !== undefined && isNaN(month)) ||
      (date !== undefined && isNaN(date))
    ) {
      throw 0;
    }
  } catch {
    console.error("Format: npm start [fullYear] [month] [date]");
    console.error("Example: npm start 2020 01 01	(parsed as January 1, 2020)");
    return;
  }
  const parsedDate = DateTime.utc(year, month || 1, date || 1);
  if (parsedDate.invalid) {
    console.error(parsedDate.invalidExplanation);
    return;
  }
  let startDate, endDate;
  if (year && !month) {
    startDate = parsedDate.startOf("year");
    endDate = parsedDate.endOf("year");
  } else if (year && month && !date) {
    startDate = parsedDate.startOf("month");
    endDate = parsedDate.endOf("month");
  } else if (year && month && date) {
    startDate = parsedDate.startOf("day");
    endDate = parsedDate.endOf("day");
  }
  console.log(
    `Downloading invoices between ${startDate.toFormat(
      "yyyy-MM-dd"
    )} - ${endDate.toFormat("yyyy-MM-dd")}`
  );

  // Create downloads directory if it doesnt exist
  const dDir = __dirname + "/downloads/";
  if (!fs.existsSync(dDir)) {
    fs.mkdirSync(dDir);
  }
  // Download all pdfs within intervall.
  await downloadInvoices(
    dDir,
    Math.round(startDate.toSeconds()),
    Math.round(endDate.toSeconds())
  );
  console.log(
    `Done. Ran ${batchNum} batches and downloaded ${downloadNum} PDFs.`
  );

  // Calculate & display totals
  const totals = allInvoices
    .reduce(
      ([subtotal, tax, total], invoice) => {
        return [
          subtotal + invoice.subtotal,
          tax + invoice.tax,
          total + invoice.total,
        ];
      },
      [0, 0, 0]
    )
    .map((t) => t / 100);

  console.table({
    "Subtotal (SUM)": totals[0],
    "Tax (SUM)": totals[1],
    "Total (SUM)": totals[2],
  });
}
main();
