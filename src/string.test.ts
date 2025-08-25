// @vitest-environment node
import { test, expect } from 'vitest'
import { chunkString } from './string'

test(`chunkString`, () => {
  const chunks = chunkString('abcdefghijklmnopqrstuvwxyz', 10)
  expect(chunks).toEqual(['abcdefghij', 'klmnopqrst', 'uvwxyz'])
})

test(`chunkString with url`, () => {
  const chunks = chunkString('https://www.example.com/path1/path2', 16)
  expect(chunks).toEqual(['https://', 'www', '.example', '.com', '/path1', '/path2'])

  const chunks2 = chunkString(
    'https://www.rfc-editor.org/search/rfc_search_detail.php?title=test&pubstatus%5B%5D=Any&pub_date_type=any',
    16
  )
  expect(chunks2).toEqual([
    'https://',
    'www',
    '.rfc',
    '-editor',
    '.org',
    '/search',
    '/rfc',
    '_search',
    '_detail',
    '.php',
    '?title',
    '=test',
    '&pubstatus',
    '%5B',
    '%5D',
    '=Any',
    '&pub',
    '_date',
    '_type',
    '=any'
  ])
})

test(`chunkString with underscores`, () => {
  const chunks = chunkString('AROUND_THE_WORLD_AROUND_THE_WORLD', 16)
  expect(chunks).toEqual([
    'AROUND',
    '_THE',
    '_WORLD',
    '_AROUND',
    '_THE',
    '_WORLD'
  ])
})

test(`chunkString with camelCase`, () => {
  const chunks = chunkString(
    'aroundTheWorldAroundTheWorldAroundTheWorldAroundTheWorldAroundTheWorldAroundTheWorldAroundTheWorldAroundTheWorld',
    16
  )
  expect(chunks).toEqual([
    'around',
    'The',
    'World',
    'Around',
    'The',
    'World',
    'Around',
    'The',
    'World',
    'Around',
    'The',
    'World',
    'Around',
    'The',
    'World',
    'Around',
    'The',
    'World',
    'Around',
    'The',
    'World',
    'Around',
    'The',
    'World'
  ])

  const chunks2 = chunkString('DecodePacketNumber(largest_pn', 10)
  expect(chunks2).toEqual(['Decode', 'Packet', 'Number', '(largest', '_pn'])
})
