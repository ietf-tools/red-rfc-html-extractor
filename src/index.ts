import path from "node:path";
import fsPromise from "node:fs/promises";

import {
  apiRfcBucketHtmlURLBuilder,
  rfcBucketHtmlToRfcDocument,
  rfcBucketHtmlFilenameBuilder,
} from "./utils.ts";

const __dirname =  import.meta.dirname;

const main = async (rfcNumber: number): Promise<void> => {
  const url = apiRfcBucketHtmlURLBuilder(rfcNumber);
  const response = await fetch(url);
  if (!response.ok) {
    throw Error(
      `Unable to fetch ${url}: ${response.status} ${response.statusText}`,
    );
  }
  const html = await response.text();

  const rfcBucketHtmlDocument = await rfcBucketHtmlToRfcDocument(html);

  const rfcBucketHtmlJSON = JSON.stringify(rfcBucketHtmlDocument);

  const targetPath = path.join(
    __dirname,
    "../out/",
    rfcBucketHtmlFilenameBuilder(rfcNumber),
  );

  await fsPromise.writeFile(targetPath, rfcBucketHtmlJSON, {
    encoding: "utf-8",
  });

  process.stdout.write(`RFC HTML JSON written to ${targetPath}`);
};

const rfcNumberArg = process.argv[2];

if (!rfcNumberArg) {
  throw Error(
    `Script requires RFC Number arg but argv was ${JSON.stringify(process.argv)}`,
  );
}

main(parseInt(rfcNumberArg, 10)).catch(console.error);
