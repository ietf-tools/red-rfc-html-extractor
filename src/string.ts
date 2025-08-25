const COLONSLASHSLASH = '://'

export const chunkString = (str: string, size: number) => {
  const chunks = []
  let out = str
  const protocolIndex = out.indexOf(COLONSLASHSLASH)
  if (protocolIndex !== -1) {
    chunks.push(out.substring(0, protocolIndex + COLONSLASHSLASH.length))
    out = out.substring(protocolIndex + COLONSLASHSLASH.length)
  }
  const indexes = getAllIndexes(out, /[@\\\/:]/g)
  chunks.push(
    ...indexes.map((strIndex, arrIndex) => {
      if (arrIndex === 0) {
        return out.substring(0, strIndex)
      }
      return out.substring(indexes[arrIndex - 1] , strIndex)
    })
  )
  if (indexes.length > 0) {
    const lastIndex = indexes[indexes.length - 1]
    chunks.push(out.substring(lastIndex))
  } else {
    chunks.push(out)
  }
  return chunks.flatMap((chunk) => {
    if (chunk.length > size) {
      return chunkStringAtLengths(chunk, size)
    }
    return chunk
  })
}

export const chunkStringAtLengths = (str: string, size: number) => {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)
  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size)
  }
  return chunks
}

const getAllIndexes = (str: string, pattern: RegExp): number[] => {
  const indices = []
  let match
  while ((match = pattern.exec(str)) !== null) {
    indices.push(match.index)
  }
  return indices
}
