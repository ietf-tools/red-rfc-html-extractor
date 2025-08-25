/**
 * W3C DOMParser factory that works on server and browser
 */
export const getDOMParser = async (): Promise<DOMParser> => {
  // browser environment
  if (typeof window !== 'undefined') {
    return new DOMParser()
  }

  // Node environment... hopefully Nuxt can treeshake JSDOM from clientside
  const jsdomModule = await import('jsdom')
  const { JSDOM } = jsdomModule
  const jsdom = new JSDOM()
  return new jsdom.window.DOMParser()
}

export const getNodeType = (maybeNode: unknown): number | undefined => {
  // this comparison must avoid using conventional `val instanceof HTMLElement`
  // approaches because HTMLElement doesn't exist in Node (it exists only as a TS
  // type in Node, not as a runtime `instanceof` check of a class).
  if (
    maybeNode &&
    typeof maybeNode === 'object' &&
    'nodeType' in maybeNode &&
    typeof maybeNode.nodeType === 'number'
  ) {
    return maybeNode.nodeType
  }
}

const W3CDOM_NODETYPE_ELEMENT = 1
const W3CDOM_NODETYPE_TEXT = 3
const W3CDOM_NODETYPE_COMMENT = 8

/**
 * Technically just checks whether it's an Element not an HTMLElement
 * but this is sufficient for our needs
 */
export const isHtmlElement = (
  maybeHtmlElement: unknown
): maybeHtmlElement is HTMLElement =>
  getNodeType(maybeHtmlElement) === W3CDOM_NODETYPE_ELEMENT

export const isTextNode = (maybeText: unknown): maybeText is Text =>
  getNodeType(maybeText) === W3CDOM_NODETYPE_TEXT

export const isCommentNode = (maybeComment: unknown): maybeComment is Comment =>
  getNodeType(maybeComment) === W3CDOM_NODETYPE_COMMENT

export const elementAttributesToObject = (
  attributes: NamedNodeMap
): Record<string, string> =>
  Array.from(attributes).reduce((acc, attribute) => {
    acc[attribute.name] = attribute.value
    return acc
  }, {} as Record<string, string>)

export const getInnerText = (element: HTMLElement): string => {
  return Array.from(element.childNodes)
    .map((node) => {
      if (isHtmlElement(node)) {
        return getInnerText(node)
      } else if (isTextNode(node)) {
        return node.textContent
      }
      return ''
    })
    .join('')
}

export const getParentElementNodeNames = (node: Node): string[] => {
  let pointer = node
  const parents: string[] = []
  while (pointer.parentElement !== null && pointer !== pointer.ownerDocument) {
    parents.push(pointer.nodeName.toLowerCase())
    pointer = pointer.parentElement
  }
  return parents
}
