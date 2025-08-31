import { blankRfcCommon } from './rfc.ts'
import { apiRfcBucketDocumentURLBuilder, PUBLIC_SITE } from './utilities/url.ts'
import { gc } from './utilities/gc.ts'
import { BLANK_HTML, getDOMParser, rfcDocumentToPojo } from './utilities/dom.ts'
import { DEFAULT_WIDTH_PX } from './utilities/layout.ts'
import { rfcImageFileNameBuilder } from './utilities/s3.ts'
import type { TableOfContents } from './utilities/rfc-validators.ts'
import type { RfcBucketHtmlDocument } from './rfc.ts'
import {
  getTextDetails,
  takeScreenshotOfPage
} from './utilities/unpdf-parent.ts'

export const fetchRfcPDF = async (rfcNumber: number) => {
  const url = `${PUBLIC_SITE}/rfc/rfc${rfcNumber}.pdf`
  const response = await fetch(url)
  if (!response.ok) {
    console.warn(
      `Unable to fetch ${rfcNumber} PDF response was ${response.status} ${response.statusText} at ${url}`
    )
    return null
  }
  const blob = await response.arrayBuffer()

  return Buffer.from(blob).toString('base64')
}

type PdfPage = {
  fileName: string
  altText: string
}

/**
 * Note that this also uploads page screenshots
 */
export const rfcBucketPdfToRfcDocument = async (
  rfcNumber: number,
  shouldUploadPageImagesToS3: boolean
): Promise<[RfcBucketHtmlDocument, PdfPage[]] | null> => {
  const base64 = await fetchRfcPDF(rfcNumber)

  if (base64 === null) {
    return null
  }

  await gc() // attempt to free memory after fetch()
  const pdfPages: PdfPage[] = []
  const domParser = await getDOMParser()
  const dom = domParser.parseFromString(BLANK_HTML, 'text/html')
  const tableOfContents: TableOfContents = { title: '', sections: [] }

  const textDetails = await getTextDetails(base64)

  for (
    let pageNumber = 1;
    pageNumber < textDetails.text.totalPages;
    pageNumber++
  ) {
    const fileName = rfcImageFileNameBuilder(rfcNumber, pageNumber)
    await gc() // attempt to free bytes from fork
    await takeScreenshotOfPage(
      base64,
      pageNumber,
      fileName,
      shouldUploadPageImagesToS3
    )
    const pageTitle = `Page ${pageNumber}`
    const domId = `page${pageNumber}`

    // Extract alt text

    const altText = ''

    pdfPages.push({ fileName, altText: '' })

    tableOfContents.sections.push({
      links: [
        {
          title: pageTitle,
          id: domId
        }
      ]
    })

    const pageNode = dom.createElement('div')
    const pageHeading = dom.createElement('h2')
    pageHeading.textContent = pageTitle
    pageHeading.id = domId
    pageNode.appendChild(pageHeading)
    const pageImg = dom.createElement('img')
    pageImg.setAttribute('src', apiRfcBucketDocumentURLBuilder(fileName))
    pageImg.setAttribute('width', DEFAULT_WIDTH_PX.toString())
    pageImg.setAttribute('height', DEFAULT_WIDTH_PX.toString())
    pageImg.setAttribute('alt', altText)
    if (pageNumber > 1) {
      // for pages 2+ we'll lazy load images
      // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#loading
      pageImg.setAttribute('loading', 'lazy')
    }
    pageNode.appendChild(pageImg)
    dom.body.append(pageNode)
  }

  const doc: RfcBucketHtmlDocument = {
    rfc: structuredClone(blankRfcCommon),
    tableOfContents,
    documentHtmlType: 'pdf-or-ps',
    documentHtmlObj: rfcDocumentToPojo(Array.from(dom.body.childNodes)),
    maxPreformattedLineLength: {
      // won't be used for a PDF document
      max: 80,
      maxWithAnchorSuffix: 80
    }
  }

  return [doc, pdfPages]
}
