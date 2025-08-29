import { processRfc } from './index.ts'

const main = async (rfcNumber: number): Promise<void> => {
  console.log(`Processing RFC ${rfcNumber}...`)
  try {
    await processRfc(rfcNumber)
  } catch (err) {
    console.warn(
      `Failed to process RFC ${rfcNumber}: ${(err as Error).message}`
    )
  }
}

if (!process.argv[2]) {
  throw Error(
    `Script requires RFC Number arg but argv was ${JSON.stringify(
      process.argv
    )}`
  )
}

main(parseInt(process.argv[2], 10))
