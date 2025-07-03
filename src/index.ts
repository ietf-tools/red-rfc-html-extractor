import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fsPromise from 'node:fs/promises'

import {
  apiRfcBucketHtmlURLBuilder,
  rfcBucketHtmlToRfcDocument,
  rfcBucketHtmlFilenameBuilder
} from './utils.ts'
import type { RfcBucketHtmlDocument } from './rfc.ts'

const __dirname = import.meta.dirname

const main = async (rfcNumber: number): Promise<void> => {
  const rfcBucketHtmlDocument = await processRfcBucketHtml(rfcNumber)

  // write file
  const rfcBucketHtmlJSON = JSON.stringify(rfcBucketHtmlDocument)
  const targetPath = path.join(
    __dirname,
    '../out/',
    rfcBucketHtmlFilenameBuilder(rfcBucketHtmlDocument.rfc.number)
  )
  await fsPromise.writeFile(targetPath, rfcBucketHtmlJSON, {
    encoding: 'utf-8'
  })
  process.stdout.write(`RFC HTML JSON written to ${targetPath}`)
}

export const processRfcBucketHtml = async (
  rfcNumber: number
): Promise<RfcBucketHtmlDocument> => {
  const url = apiRfcBucketHtmlURLBuilder(rfcNumber)
  const response = await fetch(url)
  if (!response.ok) {
    throw Error(
      `Unable to fetch ${url}: ${response.status} ${response.statusText}`
    )
  }
  const html = await response.text()
  return rfcBucketHtmlToRfcDocument(html)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // module was not imported but called directly

  const rfcNumberArg = process.argv[2]

  if (!rfcNumberArg) {
    throw Error(
      `Script requires RFC Number arg but argv was ${JSON.stringify(process.argv)}`
    )
  }

  main(parseInt(rfcNumberArg, 10)).catch(console.error)
}
