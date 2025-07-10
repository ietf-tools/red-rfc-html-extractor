/**
 * This is derived from https://github.com/ietf-tools/red-rfc-html-extractor/blob/main/src/utils.ts
 *
 * Only the imports have changed.
 */

import { getDOMParser, isHtmlElement, isTextNode } from '../dom.ts'
import { blankRfcCommon } from '../rfc.ts'
import type { RfcCommon, RfcBucketHtmlDocument, RfcEditorToc } from '../rfc.ts'
import { assertNever } from '../typescript.ts'
import { parsePlaintextBody, parsePlaintextHead } from './plaintext.ts'
import { parseXml2RfcBody, parseXml2RfcHead } from './xml2rfc.ts'

export const fetchSourceRfcHtml = async (
  rfcNumber: number
): Promise<string> => {
  const url = `https://www.rfc-editor.org/rfc-neue/rfc${rfcNumber}.html`
  const response = await fetch(url)
  if (!response.ok) {
    throw Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`)
  }
  return response.text()
}

export type RfcAndToc = {
  rfc: RfcCommon
  tableOfContents?: RfcEditorToc
}

export const rfcBucketHtmlToRfcDocument = async (
  rfcBucketHtml: string
): Promise<RfcBucketHtmlDocument> => {
  const parser = await getDOMParser()
  const dom = parser.parseFromString(rfcBucketHtml, 'text/html')

  const rfcAndToc: RfcAndToc = {
    rfc: {
      ...blankRfcCommon
    },
    tableOfContents: undefined
  }

  const documentHtmlType = sniffRfcBucketHtmlType(dom)

  let rfcDocument: Node[] = []

  switch (documentHtmlType) {
    case 'plaintext':
      parsePlaintextHead(dom.head, rfcAndToc)
      parsePlaintextBody(dom.body, rfcAndToc)

      rfcDocument = Array.from(dom.body.childNodes).filter((node) => {
        if (isHtmlElement(node)) {
          switch (node.nodeName.toLowerCase()) {
            case 'script':
              return false
          }
        }
        return true
      })
      break
    case 'xml2rfc':
      parseXml2RfcHead(dom.head, rfcAndToc)
      parseXml2RfcBody(dom.body, rfcAndToc)

      rfcDocument = Array.from(dom.body.childNodes).filter((node) => {
        if (isHtmlElement(node)) {
          switch (node.nodeName.toLowerCase()) {
            case 'script':
              return false
            case 'table':
              if (node.classList.contains('ears')) {
                return false
              }
              break
          }
          const idsToRemove = ['toc', 'external-metadata', 'internal-metadata']
          if (idsToRemove.includes(node.id)) {
            return false
          }
        }
        return true
      })
      break
    default:
      assertNever(documentHtmlType)
      break
  }

  const documentHtml = rfcDocument
    .map((node): string => {
      if (isHtmlElement(node)) {
        return node.outerHTML
      } else if (isTextNode(node)) {
        return node.textContent ?? ''
      }
      return ''
    })
    .join('')
    .trim()

  return {
    rfc: rfcAndToc.rfc,
    tableOfContents: rfcAndToc.tableOfContents,
    documentHtmlType,
    documentHtml
  }
}

export const rfcBucketHtmlFilenameBuilder = (rfcNumber: number) =>
  `rfc${rfcNumber}-html.json`

const sniffRfcBucketHtmlType = (
  dom: Document
): RfcBucketHtmlDocument['documentHtmlType'] => {
  const isPlaintext = dom.querySelector('pre.newpage')
  const generator = dom.querySelector('meta[name=generator]')

  if (generator) {
    const content = generator.getAttribute('content')
    if (content?.startsWith('xml2rfc')) return 'xml2rfc'
  }

  if (isPlaintext) {
    return 'plaintext'
  }

  throw Error('Unable to sniff RFC HTML type. Please report this error.')
}
