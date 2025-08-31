import { z } from 'zod'
import { renderPageAsImage } from 'unpdf'
import { DEFAULT_WIDTH_PX } from './layout.ts'
import { rfcImagePathBuilder, saveToS3 } from './s3.ts'

const convertAndUpload = async (
  base64Data: string,
  pageNumber: number,
  fileName: string
): Promise<void> => {
  const blob = parseBase64Data(base64Data)
  console.log('- CHILD before', blob.byteLength)
  const screenshot = await renderPageAsImage(blob, pageNumber, {
    canvasImport: () => import('@napi-rs/canvas'),
    scale: 1,
    width: DEFAULT_WIDTH_PX
  })
  console.log(" - CHILD AFTER", screenshot.byteLength)
  const uint8Array = new Uint8Array(screenshot)
  await saveToS3(rfcImagePathBuilder(fileName), uint8Array)
}

process.on('message', async (messageFromParent: unknown) => {
  const message = parseMessageFromParent(messageFromParent)
  if (message === null) return
  console.log(' - PDF was', message.base64Data.length)
  await convertAndUpload(
    message.base64Data,
    message.pageNumber,
    message.fileName
  )
  send({ type: 'COMPLETE' })
})

const MessageSchema = z.object({
  type: z.literal('PDF_DATA'),
  fileName: z.string(),
  pageNumber: z.number(),
  base64Data: z.string()
})

const parseMessageFromParent = (message: unknown) => {
  const { data: parsedMessage, error } = MessageSchema.safeParse(message)
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

const send = (msg: { type: 'READY' } | { type: 'COMPLETE' }) => {
  if (process.send) {
    process.send(msg)
  } else {
    console.error('should be fork() child')
  }
}

const parseBase64Data = (base64: string) => {
  console.log(' - CHILD parsing', base64.substring(0, 100), base64.substring(0, 100))
  const buffer = Buffer.from(base64, 'base64')
  const uint8Array = new Uint8Array(buffer.buffer)
  console.log(' - CHILD buffer', buffer.byteLength)
  return uint8Array
}

send({ type: 'READY' })
