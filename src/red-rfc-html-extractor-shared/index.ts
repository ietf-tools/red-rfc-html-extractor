import {
  elementAttributesToObject,
  getDOMParser,
  isCommentNode,
  isHtmlElement,
  isTextNode
} from '../dom.ts'
import type {
  DocumentPojo,
  MaxPreformattedLineLengthSchemaType,
  NodePojo,
} from '../rfc-validators.ts'
import {
  isNodePojo,
  RfcBucketHtmlDocumentSchema
} from '../rfc-validators.ts'
import { blankRfcCommon } from '../rfc.ts'
import type { RfcCommon, RfcBucketHtmlDocument, RfcEditorToc } from '../rfc.ts'
import { assertNever } from '../typescript.ts'
import { PUBLIC_SITE } from '../url.ts'
import {
  getPlaintextMaxLineLength,
  getPlaintextRfcDocument,
  parsePlaintextBody,
  parsePlaintextHead
} from './plaintext.ts'
import {
  getXml2RfcMaxLineLength,
  getXml2RfcRfcDocument,
  parseXml2RfcBody,
  parseXml2RfcHead
} from './xml2rfc.ts'

export const fetchSourceRfcHtml = async (
  rfcNumber: number
): Promise<string> => {
  const url = `https://www.rfc-editor.org/rfc-neue/rfc${rfcNumber}.html`
  const response = await fetch(url)
  if (!response.ok) {
    throw Error(
      `Unable to fetch ${url}: ${response.status} ${response.statusText}`
    )
  }
  return response.text()
}

export type RfcAndToc = {
  rfc: RfcCommon
  tableOfContents?: RfcEditorToc
}

export const rfcBucketHtmlToRfcDocument = async (
  rfcBucketHtml: string,
  rfcId: string
): Promise<RfcBucketHtmlDocument> => {
  const parser = await getDOMParser()
  const dom = parser.parseFromString(rfcBucketHtml, 'text/html')

  const rfcAndToc: RfcAndToc = {
    rfc: structuredClone(blankRfcCommon),
    tableOfContents: undefined
  }

  const documentHtmlType = sniffRfcBucketHtmlType(dom)

  let maxPreformattedLineLength: MaxPreformattedLineLengthSchemaType = {
    max: 80,
    maxWithAnchorSuffix: 80,
  }

  let rfcDocument: Node[] = []

  switch (documentHtmlType) {
    case 'plaintext':
      parsePlaintextHead(dom.head, rfcAndToc)
      parsePlaintextBody(dom.body, rfcAndToc)
      rfcDocument = getPlaintextRfcDocument(dom)
      maxPreformattedLineLength = await getPlaintextMaxLineLength(dom)
      break
    case 'xml2rfc':
      parseXml2RfcHead(dom.head, rfcAndToc)
      parseXml2RfcBody(dom.body, rfcAndToc)
      rfcDocument = getXml2RfcRfcDocument(dom)
      maxPreformattedLineLength = await getXml2RfcMaxLineLength(dom)
      break
    default:
      assertNever(documentHtmlType)
      break
  }

  makeRfcEditorProdLinksRelative(rfcDocument)

  const response: RfcBucketHtmlDocument = {
    rfc: rfcAndToc.rfc,
    tableOfContents: rfcAndToc.tableOfContents,
    documentHtmlType,
    documentHtmlObj: rfcDocumentToPojo(rfcDocument),
    maxPreformattedLineLength,
  }

  /**
   * Serializing to JSON and parsing again can result in an cloned object with missing keys, see
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#description
   * eg, an object's key's value of `undefined` would have the object key removed, which could affect schema validation.
   * This particularly affects the Red client which will parse JSON and validate against the schema.
   * So we will roundtrip through JSON to simulate a realistic object that should pass schema validation.
   */
  const responseRoundTrippedThroughJSON = JSON.parse(JSON.stringify(response))

  const validationResult = RfcBucketHtmlDocumentSchema.safeParse(responseRoundTrippedThroughJSON)

  if (validationResult.error) {
    const errorTitle = `Failed to convert ${rfcId} due to validation error:`
    console.log(errorTitle, validationResult.error)
    throw Error(`${errorTitle}. See console for details.`)
  }

  return validationResult.data
}

export const rfcBucketHtmlFilenameBuilder = (rfcNumber: number) =>
  `rfc${rfcNumber}-html.json`

const sniffRfcBucketHtmlType = (
  dom: Document
): RfcBucketHtmlDocument['documentHtmlType'] => {
  const isPlaintext = dom.querySelector('body > pre')
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

const rfcDocumentToPojo = (rfcDocument: Node[]): DocumentPojo => {
  const walk = (node: Node): NodePojo | undefined => {
    if (isHtmlElement(node)) {
      return {
        type: 'Element',
        // the nodeName name is either:
        // 1) the data-component attribute (eg, 'HorizontalScrollable')
        // 2) the html element nodeName (eg 'a' or 'pre')
        nodeName: node.dataset.component ?? node.nodeName.toLowerCase(),
        attributes: elementAttributesToObject(node.attributes),
        children: Array.from(node.childNodes).map(walk).filter(isNodePojo)
      }
    } else if (isTextNode(node)) {
      return {
        type: 'Text',
        textContent: node.textContent ?? ''
      }
    }else if (isCommentNode(node)) {
      return undefined
    }
    const errorTitle = `rfcDocumentToPojo: Unsupported nodeType ${node.nodeType}`
    console.error(errorTitle, node)
    throw Error(`${errorTitle}. See console for details.`)
  }

  return rfcDocument.map(walk).filter(isNodePojo)
}

/**
 * In RFC HTML there are links to prod using absolute URLs (eg)
 * `https://www.rfc-editor.org/info/rfcN` that should be replaced
 * with relative URLs `/info/rfcN` so that
 * 1) the Nuxt SPA nav works on prod,
 * 2) links on other domains like localhost/staging stay on their
 *    domain.
 * 
 * This mutates the input document to update `<a href>`s.
 **/
const makeRfcEditorProdLinksRelative = (rfcDocument: Node[]): void => {
  const publicSiteUrl = new URL(PUBLIC_SITE)
  const walk = (node: Node): void => {
    if (isHtmlElement(node)) {
      if (node.nodeName.toLowerCase() === 'a') {
        const href = node.getAttribute('href')
        if (href) {
          const url = new URL(href, 'https://example.com')
          if(
            url.protocol === publicSiteUrl.protocol &&
            url.host === publicSiteUrl.host
          ) {
            const newHref = `${url.pathname}${url.search}${url.hash}`
            node.setAttribute('href', newHref)
            console.log("replace href", JSON.stringify(href), JSON.stringify(newHref))
          }
        }
      }
      Array.from(node.childNodes).forEach(walk)      
    }
  }
  return rfcDocument.forEach(walk)
}