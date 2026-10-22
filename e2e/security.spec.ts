import { test, expect } from 'playwright/test';

test('built app blocks inline scripts and connections outside its CSP', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
  const result = await page.evaluate(async () => {
    const violations: string[] = [];
    document.addEventListener('securitypolicyviolation', event => violations.push(event.effectiveDirective));
    const script = document.createElement('script');
    script.textContent = "document.documentElement.dataset.injected = 'yes'";
    document.head.appendChild(script);
    let connectionBlocked = false;
    try { await fetch('https://csp-blocked.invalid/probe'); } catch { connectionBlocked = true; }
    await new Promise(resolve => setTimeout(resolve, 50));
    return { injected: document.documentElement.dataset.injected, connectionBlocked, violations };
  });
  expect(result.injected).toBeUndefined();
  expect(result.connectionBlocked).toBe(true);
  expect(result.violations.some(rule => rule.startsWith('script-src'))).toBe(true);
  expect(result.violations).toContain('connect-src');
});
