// @vitest-environment node
import { test, expect } from 'vitest'
import { chunkString } from './string'

test(`chunkString`, () => {
  const chunks = chunkString('abcdefghijklmnopqrstuvwxyz', 10)
  expect(chunks).toEqual(['abcdefghij','klmnopqrst','uvwxyz'])
})

test(`chunkString with url`, () => {
  const chunks = chunkString('https://www.example.com/path1/path2', 16)
  expect(chunks).toEqual(['https://','www.example.com','/path1', '/path2'])
})
