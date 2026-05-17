import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const ss = async (name) => {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false })
  console.log(name)
}

page.on("dialog", async (dialog) => {
  if (dialog.type() === "prompt") await dialog.accept()
  else await dialog.dismiss()
})

await page.goto("http://localhost:3000")
await page.waitForTimeout(1000)

// Create file and type content with wikilink
await page.click('button:has-text("Create first file")')
await page.waitForTimeout(1500)
await page.click(".cm-content")
await page.keyboard.type(
  "# Hello World\n\nLink to [[Untitled 1.md]] here.\n\n- Item one\n- Item two"
)
await page.waitForTimeout(1000)
await ss("01-wikilink")

// Click the wikilink
await page.click(".cm-wikilink")
await page.waitForTimeout(1500)
await ss("02-navigated")

// Command palette
await page.keyboard.press("Control+k")
await page.waitForTimeout(800)
await ss("03-cmdk")

await browser.close()
console.log("Done")
