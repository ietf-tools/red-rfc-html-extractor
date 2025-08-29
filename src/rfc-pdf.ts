import { extractText, getDocumentProxy, renderPageAsImage } from 'unpdf'
import { createCanvas } from '@napi-rs/canvas'
import { blankRfcCommon } from './rfc.ts'
import { PUBLIC_SITE } from './utilities/url.ts'
import { BLANK_HTML, getDOMParser, rfcDocumentToPojo } from './utilities/dom.ts'
import { DEFAULT_WIDTH_PX } from './utilities/layout.ts'
import { rfcImagePathBuilder } from './utilities/s3.ts'
import type { TableOfContents } from './utilities/rfc-validators.ts'
import type { RfcBucketHtmlDocument } from './rfc.ts'

export const fetchRfcPDF = async (
  rfcNumber: number
): Promise<ArrayBuffer | null> => {
  const url = `${PUBLIC_SITE}/rfc/rfc${rfcNumber}.pdf`
  const response = await fetch(url)
  if (!response.ok) {
    console.warn(
      `Unable to fetch ${rfcNumber} PDF response was ${response.status} ${response.statusText} at ${url}`
    )
    return null
  }
  const blob = await response.blob()
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return buffer
}

type PdfPage = {
  filename: string
  imageData: Uint8Array
  altText: string
}

export const rfcBucketPdfToRfcDocument = async (
  pdfBuffer: ArrayBuffer,
  rfcNumber: number
): Promise<[RfcBucketHtmlDocument, PdfPage[]]> => {
  const pdfBytes = new Uint8Array(pdfBuffer)
  const pdfDocument = await getDocumentProxy(pdfBytes)
  const { totalPages, text } = await extractText(pdfDocument, {
    mergePages: false
  })

  const pdfPages: PdfPage[] = []

  const domParser = await getDOMParser()

  const dom = domParser.parseFromString(BLANK_HTML, 'text/html')

  const tableOfContents: TableOfContents = { title: '', sections: [] }

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    const pagePng = await renderPageAsImage(pdfBytes, pageNum, {
      canvasImport: () => import('@napi-rs/canvas'),
      scale: 1
    })
    const pageTitle = `Page ${pageNum}`

    const domId = `page${pageNum}`

    // Extract alt text

    const altText = text[pageNum]

    console.log({ altText })
            
    // Convert canvas to buffer
    

    const filename = `${rfcNumber}-page${pageNum}.png`

    const imageData = new Uint8Array(pagePng)

    pdfPages.push({ filename, imageData, altText })

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
    pageImg.setAttribute('src', rfcImagePathBuilder(filename))
    pageImg.setAttribute('width', DEFAULT_WIDTH_PX.toString())
    pageImg.setAttribute('height', DEFAULT_WIDTH_PX.toString())
    pageImg.setAttribute('alt', altText)
    if (pageNum > 1) {
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
