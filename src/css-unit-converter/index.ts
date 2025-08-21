const conversions = {
  // length
  px: {
    px: 1,
    cm: 96.0 / 2.54,
    mm: 96.0 / 25.4,
    in: 96,
    pt: 96.0 / 72.0,
    pc: 16,
    ex: 6
  },
  cm: {
    px: 2.54 / 96.0,
    cm: 1,
    mm: 0.1,
    in: 2.54,
    pt: 2.54 / 72.0,
    pc: 2.54 / 6.0
  },
  mm: {
    px: 25.4 / 96.0,
    cm: 10,
    mm: 1,
    in: 25.4,
    pt: 25.4 / 72.0,
    pc: 25.4 / 6.0
  },
  in: {
    px: 1.0 / 96.0,
    cm: 1.0 / 2.54,
    mm: 1.0 / 25.4,
    in: 1,
    pt: 1.0 / 72.0,
    pc: 1.0 / 6.0
  },
  pt: {
    px: 0.75,
    cm: 72.0 / 2.54,
    mm: 72.0 / 25.4,
    in: 72,
    pt: 1,
    pc: 12
  },
  pc: {
    px: 6.0 / 96.0,
    cm: 6.0 / 2.54,
    mm: 6.0 / 25.4,
    in: 6,
    pt: 6.0 / 72.0,
    pc: 1
  },
  ex: {
    px: 6, // https://stackoverflow.com/questions/918612/what-is-the-value-of-the-css-ex-unit#comment9316381_918623
  },
  // angle
  deg: {
    deg: 1,
    grad: 0.9,
    rad: 180 / Math.PI,
    turn: 360
  },
  grad: {
    deg: 400 / 360,
    grad: 1,
    rad: 200 / Math.PI,
    turn: 400
  },
  rad: {
    deg: Math.PI / 180,
    grad: Math.PI / 200,
    rad: 1,
    turn: Math.PI * 2
  },
  turn: {
    deg: 1 / 360,
    grad: 1 / 400,
    rad: 0.5 / Math.PI,
    turn: 1
  },
  // time
  s: {
    s: 1,
    ms: 1 / 1000
  },
  ms: {
    s: 1000,
    ms: 1
  },
  // frequency
  Hz: {
    Hz: 1,
    kHz: 1000
  },
  kHz: {
    Hz: 1 / 1000,
    kHz: 1
  },
  // resolution
  dpi: {
    dpi: 1,
    dpcm: 1.0 / 2.54,
    dppx: 1 / 96
  },
  dpcm: {
    dpi: 2.54,
    dpcm: 1,
    dppx: 2.54 / 96.0
  },
  dppx: {
    dpi: 96,
    dpcm: 96.0 / 2.54,
    dppx: 1
  }
} as const

export type CSSLengthUnit = keyof typeof conversions

const CSS_LENGTH_REGEX = /^([0-9\.]+)([a-z]+)$/i

export const parseCSSLength = (
  lengthAttr: string
): [number, CSSLengthUnit] | null => {
  if (
    // if there are no units default to 'px'
    !lengthAttr.match(/[a-z]/i)) {
    return [parseFloat(lengthAttr), 'px']
  }
  const parts = lengthAttr.match(CSS_LENGTH_REGEX)
  if (parts === null) return null
  const length = parseFloat(parts[1])
  if(Number.isNaN(length)) {
     return null
  }
  const unit = parts[2].trim() as CSSLengthUnit
  if(unit.length === 0) {
    return null
  }
  return [length, unit]
}

export const convertCSSUnit = (
  value: number,
  sourceUnit: CSSLengthUnit,
  targetUnit: CSSLengthUnit
) => {
  if (!conversions.hasOwnProperty(targetUnit))
    throw new Error('Cannot convert to ' + targetUnit)

  if (!conversions[targetUnit].hasOwnProperty(sourceUnit))
    throw new Error('Cannot convert from ' + sourceUnit + ' to ' + targetUnit)

  const target = conversions[targetUnit]
  if (!(sourceUnit in target)) {
    throw Error(
      `Unrecognised target ${JSON.stringify(
        targetUnit
      )} sourceUnit ${JSON.stringify(sourceUnit)} `
    )
  }
  // @ts-ignore
  const targetSource = target[sourceUnit] as number

  var converted = targetSource * value

  return converted
}
