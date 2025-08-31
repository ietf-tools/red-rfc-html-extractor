import { z } from 'zod'
import { renderPageAsImage, extractText } from 'unpdf'
import { DEFAULT_WIDTH_PX } from './layout.ts'
import { rfcImagePathBuilder, saveToS3 } from './s3.ts'

process.on('message', async (messageFromParent: unknown) => {
  const message = parseMessageFromParent(messageFromParent)
  if (message === null) return
  // console.log(' - PDF was', message.base64Data.length)
  switch (message.type) {
    case 'SCREENSHOT_PAGE':
      await screenshotAndUpload(
        message.base64Data,
        message.pageNumber,
        message.fileName,
        message.shouldUploadToS3 === true.toString()
      )
      send({ type: 'SCREENSHOT_PAGE_DONE' })
      break
    case 'GET_TEXT':
      const text = await getText(message.base64Data)
      send({ type: 'GET_TEXT_DONE', text })
  }
})

const screenshotAndUpload = async (
  base64Data: string,
  pageNumber: number,
  fileName: string,
  shouldUploadToS3: boolean
): Promise<void> => {
  const blob = parseBase64Data(base64Data)
  // console.log('- CHILD before', blob.byteLength)
  const screenshot = await renderPageAsImage(blob, pageNumber, {
    canvasImport: () => import('@napi-rs/canvas'),
    scale: 1,
    width: DEFAULT_WIDTH_PX
  })
  // console.log(' - CHILD AFTER', screenshot.byteLength)
  if (shouldUploadToS3) {
    const uint8Array = new Uint8Array(screenshot)
    await saveToS3(rfcImagePathBuilder(fileName), uint8Array)
  }
}

const getText = async (base64Data: string) => {
  const blob = parseBase64Data(base64Data)
  // console.log('- CHILD before', blob.byteLength)
  return extractText(blob, { mergePages: false })
}

const ScreenshotPageSchema = z.object({
  type: z.literal('SCREENSHOT_PAGE'),
  fileName: z.string(),
  pageNumber: z.number(),
  base64Data: z.string(),
  shouldUploadToS3: z.string()
})

const TextSchema = z.object({
  type: z.literal('GET_TEXT'),
  base64Data: z.string()
})

const ReceiveMessageSchema = z.union([ScreenshotPageSchema, TextSchema])

const parseMessageFromParent = (message: unknown) => {
  const { data: parsedMessage, error } = ReceiveMessageSchema.safeParse(message)
  if (error) {
    console.error('CHILD expected valid message.', error)
    return null
  }
  if (parsedMessage.base64Data.length === 0) {
    console.error('CHILD expected PDF length but was 0')
    return null
  }
  return parsedMessage
}

type Text = {
  // the typescript to extract individual overload signatures of getText
  // is far more complicated than just hardcoding the type we want
  totalPages: number
  text: string[] 
}

type SendMessages =
  | { type: 'READY' }
  | { type: 'SCREENSHOT_PAGE_DONE' }
  | { type: 'GET_TEXT_DONE'; text: Text }

const send = (msg: SendMessages) => {
  if (process.send) {
    process.send(msg)
  } else {
    console.error('should be fork() child')
  }
}

const parseBase64Data = (base64: string) => {
  // console.log(
  //   ' - CHILD parsing',
  //   base64.substring(0, 100),
  //   base64.substring(0, 100)
  // )
  const buffer = Buffer.from(base64, 'base64')
  const uint8Array = new Uint8Array(buffer.buffer)
  // console.log(' - CHILD buffer', buffer.byteLength)
  return uint8Array
}

send({ type: 'READY' })
