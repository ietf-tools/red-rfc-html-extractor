import sharp from 'sharp'

type SharpImage = ReturnType<typeof sharp>

/**
 * Detects whether an image is greyscale.
 *
 * Useful to know whether it's safe to compress an image down to 1 channel from 3 channels
 */
export const isSharpImageGreyscale = async (sharpImage: SharpImage): Promise<boolean> => {
  const greyscaleThreshold = 1

  try {
    // Get image metadata first
    const metadata = await sharpImage.metadata()

    // If image has only one channel, it's definitely grayscale
    if (metadata.channels === 1) {
      return true
    }

    // For images with multiple channels, we need to check if all channels are identical
    const { data, info } = await sharpImage
      .raw()
      .toBuffer({ resolveWithObject: true })

    const width = info.width
    const height = info.height

    // Compare RGB values across all pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * metadata.channels
        const r = data[offset]
        const g = data[offset + 1]
        const b = data[offset + 2]

        // If RGB values differ by more than a tiny threshold (accounting for potential compression artifacts)
        if (
          Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r)) >
          greyscaleThreshold
        ) {
          return false
        }
      }
    }

    return true
  } catch (error: unknown) {
    throw new Error(
      `Failed to check if image is grayscale: ${
        error && typeof error === 'object' && 'message' in error
          ? error.message
          : error
      }`
    )
  }
}

export const compressImageToPng = async (
  sharpImage: SharpImage,
  forceGreyscale: boolean
): Promise<Buffer> => {
  if (forceGreyscale) {
    return sharpImage.grayscale().png({ compressionLevel: 9 }).toBuffer()
  }
  return sharpImage.png({ compressionLevel: 9 }).toBuffer()
}
