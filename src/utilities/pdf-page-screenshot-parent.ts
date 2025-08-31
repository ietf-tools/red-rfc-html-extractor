import { z } from 'zod'
import { fork } from 'node:child_process'
import { join } from 'node:path'
import { gc } from './gc.ts'
import { sleep } from './sleep.ts'

const forkPath = join(
  import.meta.dirname,
  'utilities',
  'pdf-page-screenshot-child.ts'
)

export const takeScreenshotOfPage = async (
  pdfData: string,
  pageNumber: number,
  fileName: string
): Promise<string> => {
  return new Promise((resolve) => {
    const child = fork(forkPath)
    child.on('message', async (_message) => {
      const message = parseMessageFromChild(_message)
      if (!message) {
        return
      }
      switch (message.type) {
        case 'READY':
          child.send({
            type: 'PDF_DATA',
            base64Data: pdfData,
            pageNumber,
            fileName
          })
          break
        case 'COMPLETE':
          console.log(' - PARENT PAGE SCREENSHOT COMPLETE')
          await sleep(50)
          // Remove all event listeners
          child.removeAllListeners()
          // Disconnect IPC channel
          child.disconnect()
          // Call unref if process is detached
          if (process.platform !== 'win32') {
            child.unref()
          }
          child.kill('SIGTERM')

          // Wait for exit
          await new Promise((resolve) => {
            child.once('exit', resolve)
          })
          await gc()
          resolve(fileName)
          break
      }
    })
  })
}

const MessagesSchema = z.union([
  z.object({
    type: z.literal('READY')
  }),
  z.object({
    type: z.literal('COMPLETE')
  })
])

const parseMessageFromChild = (message: unknown) => {
  const { data: parsedMessage, error } = MessagesSchema.safeParse(message)
  if (error) {
    console.error('PARENT expected valid message.', error)
    return null
  }
  return parsedMessage
}


