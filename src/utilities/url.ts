export const PUBLIC_SITE = 'https://www.rfc-editor.org'

export const apiRfcBucketDocumentURLBuilder = (fileName: string) => {
  // Intentionally not a relative url, the PUBLIC_SITE prefix is because this URL is served
  // from a bucket on prod; it's not something that a localhost Nuxt can serve.
  // The CORS headers of the prod URL should allow access from localhost:3000 as well as staging,
  // etc. sites.
  return `${PUBLIC_SITE}/api/v1/rfc-html/${fileName}` as const
}