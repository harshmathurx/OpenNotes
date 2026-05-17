import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  
  // Test 1: Code blocks
  const page1 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage({ viewport: { width: 1280, height: 800 } });
  await p1.goto('http://localhost:3002');
  await p1.waitForTimeout(1500);
  await p1.click('text=Create first file');
  await p1.waitForTimeout(800);
  await p1.click('.cm-content');
  await p1.keyboard.type('# Hello World\n\nSome text here.\n\n```javascript\nvar harsh = "harshmathur"\nconsole.log(harsh)\n```\n\nMore text after.\n\n> This is a blockquote\n\n---\n\n*Italic* and **bold** text.\n\n');
  await p1.waitForTimeout(800);
  await p1.screenshot({ path: 'screenshots/test-code-blocks.png', fullPage: false });
  await ctx1.close();
  
  // Test 2: Command palette search
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage({ viewport: { width: 1280, height: 800 } });
  await p2.goto('http://localhost:3002');
  await p2.waitForTimeout(1500);
  await p2.click('text=Create first file');
  await p2.waitForTimeout(800);
  await p2.keyboard.down('Control');
  await p2.keyboard.press('k');
  await p2.keyboard.up('Control');
  await p2.waitForTimeout(800);
  await p2.screenshot({ path: 'screenshots/test-cmdk-open.png', fullPage: false });
  
  // Type in search
  await p2.keyboard.type('untitle');
  await p2.waitForTimeout(800);
  await p2.screenshot({ path: 'screenshots/test-cmdk-search.png', fullPage: false });
  
  // Type something that doesn't match
  await p2.keyboard.press('Control+a');
  await p2.keyboard.type('xyz123');
  await p2.waitForTimeout(800);
  await p2.screenshot({ path: 'screenshots/test-cmdk-no-match.png', fullPage: false });
  await ctx2.close();
  
  await browser.close();
  console.log('Done!');
})();
