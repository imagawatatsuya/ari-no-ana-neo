import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
});

const page = await context.newPage();

// 1. Top/List page
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshot-mobile-top.png', fullPage: true });
console.log('Captured: mobile top page');

// 2. Article page - click first article link
const articleLink = await page.locator('a[href*="#read/"]').first();
if (await articleLink.count() > 0) {
  await articleLink.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshot-mobile-article.png', fullPage: true });
  console.log('Captured: mobile article page');
} else {
  console.log('No article link found, skipping article screenshot');
}

// 3. Post form page
await page.goto('http://localhost:5173/#post', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshot-mobile-post.png', fullPage: true });
console.log('Captured: mobile post form page');

await browser.close();
console.log('Done! All mobile screenshots captured.');
