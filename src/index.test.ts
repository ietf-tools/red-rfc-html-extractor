// @vitest-environment node
import { test, expect } from "vitest";
import { processRfcBucketHtml } from "./index";

const RFC_WITH_PREFORMATTED_HTML = 1234
const RFC_WITH_HTML = 9000

test("processRfcBucketHtml()", async () => {
  expect(await processRfcBucketHtml(RFC_WITH_PREFORMATTED_HTML)).toMatchSnapshot();
  expect(await processRfcBucketHtml(RFC_WITH_HTML)).toMatchSnapshot();
});
