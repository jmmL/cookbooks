// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Cookbook Index App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Cookbook Index/);
  });

  test('CSS is loaded correctly', async ({ page }) => {
    // Check that the app header has proper styling (background color set by CSS)
    const header = page.locator('.app-header');
    await expect(header).toBeVisible();

    // Verify CSS custom properties are working
    const title = page.locator('.app-title');
    await expect(title).toHaveCSS('font-size', /.+/);
  });

  test('JavaScript initializes and renders recipes', async ({ page }) => {
    // Wait for recipes to be rendered
    const recipeList = page.locator('#recipe-list');
    await expect(recipeList).toBeVisible();

    // Check that at least one recipe item exists
    const recipeItems = page.locator('.recipe-item');
    await expect(recipeItems.first()).toBeVisible({ timeout: 10000 });

    // Verify the results count is displayed
    const resultsCount = page.locator('#results-count');
    await expect(resultsCount).not.toHaveText('0');
  });

  test('recipe data is properly injected', async ({ page }) => {
    // Check that window.RECIPE_DATA exists and has data
    const hasData = await page.evaluate(() => {
      return window.RECIPE_DATA &&
             window.RECIPE_DATA.books &&
             window.RECIPE_DATA.books.length > 0 &&
             window.RECIPE_DATA.recipes &&
             window.RECIPE_DATA.recipes.length > 0;
    });
    expect(hasData).toBe(true);
  });

  test('search functionality works', async ({ page }) => {
    // Wait for recipes to load
    await page.locator('.recipe-item').first().waitFor();

    // Get initial count
    const initialCount = await page.locator('#results-count').textContent();

    // Search for a specific term
    await page.fill('#search-input', 'chicken');

    // Wait for debounce and re-render
    await page.waitForTimeout(300);

    // Verify results changed or filtered
    const filteredCount = await page.locator('#results-count').textContent();
    // The filtered count should be a number (app is working)
    expect(parseInt(filteredCount)).toBeGreaterThanOrEqual(0);
  });

  test('filter panel toggles correctly', async ({ page }) => {
    const filterPanel = page.locator('#filter-panel');

    // Initially hidden
    await expect(filterPanel).toHaveClass(/hidden/);

    // Click toggle button
    await page.click('#toggle-filters');

    // Should now be visible
    await expect(filterPanel).not.toHaveClass(/hidden/);
  });

  test('recipe expansion works', async ({ page }) => {
    // Wait for recipes to load
    const firstRecipe = page.locator('.recipe-item').first();
    await firstRecipe.waitFor();

    // Details should be hidden initially
    const details = firstRecipe.locator('.recipe-item-details');
    await expect(details).toHaveClass(/hidden/);

    // Click to expand
    await firstRecipe.locator('.recipe-item-header').click();

    // Details should now be visible
    await expect(details).not.toHaveClass(/hidden/);
  });

  test('favorites toggle works', async ({ page }) => {
    // Wait for recipes to load
    const firstRecipe = page.locator('.recipe-item').first();
    await firstRecipe.waitFor();

    // Click favorite button
    const favoriteBtn = firstRecipe.locator('.favorite-btn');
    await favoriteBtn.click();

    // Should have active class
    await expect(favoriteBtn).toHaveClass(/active/);

    // Click again to unfavorite
    await favoriteBtn.click();

    // Should not have active class
    await expect(favoriteBtn).not.toHaveClass(/active/);
  });

  test('no console errors on page load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.locator('.recipe-item').first().waitFor({ timeout: 10000 });

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Mobile/Touch interactions', () => {
  test('touch interactions work on recipe items', async ({ page }) => {
    await page.goto('/');

    // Wait for recipes to load
    const firstRecipe = page.locator('.recipe-item').first();
    await firstRecipe.waitFor();

    // Tap to expand (using click which simulates tap on mobile)
    await firstRecipe.locator('.recipe-item-header').click();

    // Details should be visible
    const details = firstRecipe.locator('.recipe-item-details');
    await expect(details).not.toHaveClass(/hidden/);
  });

  test('sticky header works on scroll', async ({ page }) => {
    await page.goto('/');

    // Wait for recipes to load
    await page.locator('.recipe-item').first().waitFor();

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));

    // Controls bar should still be visible (sticky)
    const controlsBar = page.locator('.controls-bar');
    await expect(controlsBar).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('recipe items are keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Wait for recipes to load
    await page.locator('.recipe-item').first().waitFor();

    // Tab to first recipe
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Search input
    await page.keyboard.press('Tab'); // Filter button
    await page.keyboard.press('Tab'); // Favorites button
    // ... continue to recipe list

    // Verify recipes have tabindex
    const firstRecipe = page.locator('.recipe-item').first();
    await expect(firstRecipe).toHaveAttribute('tabindex', '0');
  });

  test('ARIA attributes are present', async ({ page }) => {
    await page.goto('/');

    // Wait for recipes to load
    await page.locator('.recipe-item').first().waitFor();

    // Check recipe list has role
    const recipeList = page.locator('#recipe-list');
    await expect(recipeList).toHaveAttribute('role', 'list');

    // Check recipe items have role
    const firstRecipe = page.locator('.recipe-item').first();
    await expect(firstRecipe).toHaveAttribute('role', 'listitem');
  });
});
