/**
 * Unit tests for Cookbook Index App
 */

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: jest.fn(key => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; })
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock scrollY and innerHeight
Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

// Sample test data
const sampleBooks = [
  {
    id: 'book-1',
    title: 'Test Cookbook 1',
    author: 'Test Author',
    cuisine: 'Chinese',
    color: '#4a90a4'
  },
  {
    id: 'book-2',
    title: 'Test Cookbook 2',
    author: 'Another Author',
    cuisine: 'Italian',
    color: '#e8c547'
  }
];

const sampleRecipes = [
  {
    id: 'recipe-1',
    name: { en: 'Kung Pao Chicken', zh_hanzi: '宫保鸡丁' },
    book_id: 'book-1',
    page: 42,
    theme: ['Meat', 'Poultry'],
    total_time_mins: 45,
    active_time_mins: 25,
    difficulty: 'medium',
    seasonality: ['Spring', 'Summer', 'Autumn', 'Winter'],
    ingredients: {
      protein: ['Chicken'],
      carbohydrate: [],
      other: ['peanuts', 'dried chillies', 'ginger', 'garlic']
    }
  },
  {
    id: 'recipe-2',
    name: { en: 'Pasta Carbonara' },
    book_id: 'book-2',
    page: 78,
    theme: ['Pasta'],
    total_time_mins: 30,
    active_time_mins: 20,
    difficulty: 'easy',
    seasonality: ['Spring', 'Summer', 'Autumn', 'Winter'],
    ingredients: {
      protein: ['Pork'],
      carbohydrate: ['Pasta'],
      other: ['eggs', 'pecorino', 'black pepper']
    }
  },
  {
    id: 'recipe-3',
    name: { en: 'Mapo Tofu', zh_hanzi: '麻婆豆腐', zh_pinyin: 'Má Pó Dòu Fu' },
    book_id: 'book-1',
    page: 56,
    theme: ['Tofu', 'Vegetarian Option'],
    total_time_mins: 25,
    active_time_mins: 20,
    difficulty: 'easy',
    seasonality: ['Spring', 'Autumn', 'Winter'],
    ingredients: {
      protein: ['Tofu', 'Pork'],
      carbohydrate: [],
      other: ['doubanjiang', 'Sichuan peppercorns', 'garlic']
    }
  },
  {
    id: 'recipe-4',
    name: { en: 'Slow Roasted Lamb' },
    book_id: 'book-2',
    page: 120,
    theme: ['Meat', 'Lamb'],
    total_time_mins: 480,
    active_time_mins: 30,
    difficulty: 'hard',
    seasonality: ['Winter'],
    ingredients: {
      protein: ['Lamb'],
      carbohydrate: [],
      other: ['rosemary', 'garlic', 'wine']
    }
  }
];

// Setup HTML structure for tests
const setupDOM = () => {
  document.body.innerHTML = `
    <input type="text" id="search-input">
    <button id="toggle-filters"></button>
    <button id="toggle-favorites"></button>
    <div id="filter-panel" class="hidden">
      <button id="filter-logic-toggle" data-logic="and">
        <span class="logic-option active" data-value="and">ALL</span>
        <span class="logic-option" data-value="or">ANY</span>
      </button>
      <div id="filter-books"></div>
      <div id="filter-cuisines"></div>
      <div id="filter-themes"></div>
      <div id="filter-proteins"></div>
      <div id="filter-carbs"></div>
      <input type="text" id="filter-ingredients">
      <div id="filter-difficulty">
        <label class="filter-checkbox"><input type="checkbox" value="easy"> Easy</label>
        <label class="filter-checkbox"><input type="checkbox" value="medium"> Medium</label>
        <label class="filter-checkbox"><input type="checkbox" value="hard"> Hard</label>
      </div>
      <div id="filter-seasons">
        <label class="filter-checkbox"><input type="checkbox" value="Spring"> Spring</label>
        <label class="filter-checkbox"><input type="checkbox" value="Summer"> Summer</label>
        <label class="filter-checkbox"><input type="checkbox" value="Autumn"> Autumn</label>
        <label class="filter-checkbox"><input type="checkbox" value="Winter"> Winter</label>
      </div>
      <input type="range" id="filter-time" min="0" max="1500" value="1500">
      <span id="filter-time-display">Any</span>
    </div>
    <button id="clear-filters"></button>
    <span id="active-filter-count" class="hidden">0</span>
    <select id="sort-select">
      <option value="name">Name</option>
      <option value="book">Book</option>
      <option value="total_time">Total Time</option>
    </select>
    <button id="sort-direction" data-direction="asc"></button>
    <select id="language-select">
      <option value="en">English</option>
      <option value="zh_hanzi">Chinese (Hanzi)</option>
    </select>
    <span id="results-count">0</span>
    <main id="recipe-list" role="list"></main>
    <div id="empty-state" class="hidden"><h2></h2><p></p></div>
    <template id="recipe-item-template">
      <article class="recipe-item" role="listitem">
        <div class="recipe-item-header">
          <div class="recipe-item-title-row">
            <button class="favorite-btn"></button>
            <h2 class="recipe-name"></h2>
            <span class="recipe-alt-names"></span>
          </div>
          <div class="recipe-meta">
            <span class="recipe-book"></span>
            <span class="recipe-page"></span>
          </div>
          <button class="expand-btn"></button>
        </div>
        <div class="recipe-item-details hidden">
          <span class="recipe-cuisine"></span>
          <span class="recipe-theme"></span>
          <span class="recipe-total-time"></span>
          <span class="recipe-active-time"></span>
          <span class="recipe-difficulty"></span>
          <span class="recipe-season"></span>
          <div class="ingredients-list"></div>
        </div>
      </article>
    </template>
  `;
};

// Load the app
beforeEach(() => {
  jest.resetModules();
  localStorageMock.clear();
  setupDOM();

  // Set up window.RECIPE_DATA before loading the app
  window.RECIPE_DATA = {
    books: sampleBooks,
    recipes: sampleRecipes
  };
});

// Load the app module for each test
const loadApp = () => {
  require('../assets/js/app.js');
  return window.CookbookApp._test;
};

describe('Schema Validation', () => {
  test('validateSchema returns empty array for valid recipe', () => {
    const app = loadApp();
    const errors = app.validateSchema(sampleRecipes[0], app.RecipeSchema, 'test');
    expect(errors).toEqual([]);
  });

  test('validateSchema returns errors for missing required fields', () => {
    const app = loadApp();
    const invalidRecipe = { id: 'test' };
    const errors = app.validateSchema(invalidRecipe, app.RecipeSchema, 'test');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('name'))).toBe(true);
  });

  test('validateSchema returns errors for invalid types', () => {
    const app = loadApp();
    const invalidRecipe = {
      ...sampleRecipes[0],
      page: 'not a number'
    };
    const errors = app.validateSchema(invalidRecipe, app.RecipeSchema, 'test');
    expect(errors.some(e => e.includes('page'))).toBe(true);
  });

  test('validateSchema validates book schema correctly', () => {
    const app = loadApp();
    const errors = app.validateSchema(sampleBooks[0], app.BookSchema, 'test');
    expect(errors).toEqual([]);
  });
});

describe('Hex Color Validation', () => {
  test('isValidHexColor returns true for valid hex colors', () => {
    const app = loadApp();
    expect(app.isValidHexColor('#4a90a4')).toBe(true);
    expect(app.isValidHexColor('#FFFFFF')).toBe(true);
    expect(app.isValidHexColor('#000000')).toBe(true);
    expect(app.isValidHexColor('#AbCdEf')).toBe(true);
  });

  test('isValidHexColor returns false for invalid hex colors', () => {
    const app = loadApp();
    expect(app.isValidHexColor('4a90a4')).toBe(false);        // missing #
    expect(app.isValidHexColor('#4a90a')).toBe(false);        // too short
    expect(app.isValidHexColor('#4a90a4a')).toBe(false);      // too long
    expect(app.isValidHexColor('#GGGGGG')).toBe(false);       // invalid chars
    expect(app.isValidHexColor('rgb(0,0,0)')).toBe(false);    // rgb format
    expect(app.isValidHexColor('')).toBe(false);              // empty
    expect(app.isValidHexColor(null)).toBe(false);            // null
  });

  test('hexToRgba returns correct rgba for valid hex', () => {
    const app = loadApp();
    expect(app.hexToRgba('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
    expect(app.hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(app.hexToRgba('#4a90a4', 0.08)).toBe('rgba(74, 144, 164, 0.08)');
  });

  test('hexToRgba handles invalid hex gracefully', () => {
    const app = loadApp();
    expect(app.hexToRgba('invalid', 0.5)).toBe('rgba(0, 0, 0, 0)');
  });

  test('hexToRgba clamps alpha to valid range', () => {
    const app = loadApp();
    expect(app.hexToRgba('#000000', 2)).toBe('rgba(0, 0, 0, 1)');
    expect(app.hexToRgba('#000000', -1)).toBe('rgba(0, 0, 0, 0)');
  });
});

describe('Time Formatting', () => {
  test('formatTime formats minutes correctly', () => {
    const app = loadApp();
    expect(app.formatTime(15)).toBe('15 min');
    expect(app.formatTime(45)).toBe('45 min');
    expect(app.formatTime(59)).toBe('59 min');
  });

  test('formatTime formats hours correctly', () => {
    const app = loadApp();
    expect(app.formatTime(60)).toBe('1h');
    expect(app.formatTime(120)).toBe('2h');
    expect(app.formatTime(180)).toBe('3h');
  });

  test('formatTime formats hours and minutes correctly', () => {
    const app = loadApp();
    expect(app.formatTime(90)).toBe('1h 30m');
    expect(app.formatTime(135)).toBe('2h 15m');
    expect(app.formatTime(1500)).toBe('25h');
  });
});

describe('Search Functionality', () => {
  test('matchesSearch finds English names', () => {
    const app = loadApp();
    expect(app.matchesSearch(sampleRecipes[0], 'kung')).toBe(true);
    expect(app.matchesSearch(sampleRecipes[0], 'chicken')).toBe(true);
    expect(app.matchesSearch(sampleRecipes[0], 'kung pao')).toBe(true);
  });

  test('matchesSearch finds Chinese characters', () => {
    const app = loadApp();
    expect(app.matchesSearch(sampleRecipes[0], '宫保')).toBe(true);
    expect(app.matchesSearch(sampleRecipes[2], '麻婆')).toBe(true);
  });

  test('matchesSearch finds pinyin', () => {
    const app = loadApp();
    expect(app.matchesSearch(sampleRecipes[2], 'má pó')).toBe(true);
  });

  test('matchesSearch is case insensitive', () => {
    const app = loadApp();
    expect(app.matchesSearch(sampleRecipes[0], 'KUNG')).toBe(true);
    expect(app.matchesSearch(sampleRecipes[0], 'KuNg PaO')).toBe(true);
  });

  test('matchesSearch returns false for non-matching terms', () => {
    const app = loadApp();
    expect(app.matchesSearch(sampleRecipes[0], 'pizza')).toBe(false);
    expect(app.matchesSearch(sampleRecipes[0], '寿司')).toBe(false);
  });
});

describe('Filter Logic', () => {
  test('filters by search term', () => {
    const app = loadApp();
    app.setState({
      recipes: sampleRecipes,
      books: sampleBooks.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}),
      filters: { ...app.getState().filters, search: 'kung' }
    });

    const filtered = app.filterRecipes();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('recipe-1');
  });

  test('filters by difficulty', () => {
    const app = loadApp();
    app.setState({
      recipes: sampleRecipes,
      books: sampleBooks.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}),
      filters: { ...app.getState().filters, difficulties: ['easy'] }
    });

    const filtered = app.filterRecipes();
    expect(filtered.length).toBe(2);
    expect(filtered.every(r => r.difficulty === 'easy')).toBe(true);
  });

  test('filters by book', () => {
    const app = loadApp();
    app.setState({
      recipes: sampleRecipes,
      books: sampleBooks.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}),
      filters: { ...app.getState().filters, books: ['book-1'] }
    });

    const filtered = app.filterRecipes();
    expect(filtered.length).toBe(2);
    expect(filtered.every(r => r.book_id === 'book-1')).toBe(true);
  });

  test('filters by protein', () => {
    const app = loadApp();
    app.setState({
      recipes: sampleRecipes,
      books: sampleBooks.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}),
      filters: { ...app.getState().filters, proteins: ['Chicken'] }
    });

    const filtered = app.filterRecipes();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('recipe-1');
  });

  test('filters by max time', () => {
    const app = loadApp();
    app.setState({
      recipes: sampleRecipes,
      books: sampleBooks.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}),
      filters: { ...app.getState().filters, maxTime: 60 }
    });

    const filtered = app.filterRecipes();
    expect(filtered.length).toBe(3);
    expect(filtered.every(r => r.total_time_mins <= 60)).toBe(true);
  });

  test('filters by season', () => {
    const app = loadApp();
    app.setState({
      recipes: sampleRecipes,
      books: sampleBooks.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}),
      filters: { ...app.getState().filters, seasons: ['Winter'] }
    });

    const filtered = app.filterRecipes();
    expect(filtered.every(r => r.seasonality.includes('Winter'))).toBe(true);
  });

  test('AND filter logic requires all conditions', () => {
    const app = loadApp();
    app.setState({
      recipes: sampleRecipes,
      books: sampleBooks.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}),
      filterLogic: 'and',
      filters: {
        ...app.getState().filters,
        books: ['book-1'],
        difficulties: ['easy']
      }
    });

    const filtered = app.filterRecipes();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('recipe-3');
  });

  test('OR filter logic matches any condition', () => {
    const app = loadApp();
    app.setState({
      recipes: sampleRecipes,
      books: sampleBooks.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}),
      filterLogic: 'or',
      filters: {
        ...app.getState().filters,
        books: ['book-1'],
        difficulties: ['easy']
      }
    });

    const filtered = app.filterRecipes();
    expect(filtered.length).toBe(3); // 2 from book-1 + pasta carbonara (easy, book-2)
  });

  test('filters by favorites only', () => {
    const app = loadApp();
    app.setState({
      recipes: sampleRecipes,
      books: sampleBooks.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}),
      showFavoritesOnly: true,
      favorites: new Set(['recipe-1', 'recipe-3'])
    });

    const filtered = app.filterRecipes();
    expect(filtered.length).toBe(2);
    expect(filtered.map(r => r.id).sort()).toEqual(['recipe-1', 'recipe-3']);
  });

  test('filters by ingredient text', () => {
    const app = loadApp();
    app.setState({
      recipes: sampleRecipes,
      books: sampleBooks.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}),
      filters: { ...app.getState().filters, ingredients: 'garlic' }
    });

    const filtered = app.filterRecipes();
    expect(filtered.length).toBe(3);
    expect(filtered.every(r => r.ingredients.other.some(i => i.includes('garlic')))).toBe(true);
  });
});

describe('Sort Functionality', () => {
  test('sorts by name ascending', () => {
    const app = loadApp();
    app.setState({
      sortBy: 'name',
      sortDirection: 'asc'
    });

    const sorted = app.sortRecipes(sampleRecipes);
    expect(sorted[0].name.en).toBe('Kung Pao Chicken');
    expect(sorted[sorted.length - 1].name.en).toBe('Slow Roasted Lamb');
  });

  test('sorts by name descending', () => {
    const app = loadApp();
    app.setState({
      sortBy: 'name',
      sortDirection: 'desc'
    });

    const sorted = app.sortRecipes(sampleRecipes);
    expect(sorted[0].name.en).toBe('Slow Roasted Lamb');
  });

  test('sorts by total time', () => {
    const app = loadApp();
    app.setState({
      sortBy: 'total_time',
      sortDirection: 'asc'
    });

    const sorted = app.sortRecipes(sampleRecipes);
    expect(sorted[0].total_time_mins).toBe(25);
    expect(sorted[sorted.length - 1].total_time_mins).toBe(480);
  });

  test('sorts by difficulty', () => {
    const app = loadApp();
    app.setState({
      sortBy: 'difficulty',
      sortDirection: 'asc'
    });

    const sorted = app.sortRecipes(sampleRecipes);
    expect(sorted[0].difficulty).toBe('easy');
    expect(sorted[sorted.length - 1].difficulty).toBe('hard');
  });

  test('sorts by page number', () => {
    const app = loadApp();
    app.setState({
      sortBy: 'page',
      sortDirection: 'asc'
    });

    const sorted = app.sortRecipes(sampleRecipes);
    expect(sorted[0].page).toBe(42);
    expect(sorted[sorted.length - 1].page).toBe(120);
  });
});

describe('LocalStorage Handling', () => {
  test('saves and loads favorites correctly', () => {
    const app = loadApp();
    const favorites = ['recipe-1', 'recipe-2'];

    localStorageMock.setItem(app.getConfig().STORAGE_KEY_FAVORITES, JSON.stringify(favorites));

    const stored = localStorageMock.getItem(app.getConfig().STORAGE_KEY_FAVORITES);
    expect(JSON.parse(stored)).toEqual(favorites);
  });

  test('handles corrupted localStorage gracefully', () => {
    localStorageMock.setItem('cookbook-favorites', 'not valid json{{{');

    // Should not throw
    expect(() => loadApp()).not.toThrow();
  });

  test('handles invalid favorites data type gracefully', () => {
    localStorageMock.setItem('cookbook-favorites', JSON.stringify({ invalid: 'object' }));

    // Should not throw
    expect(() => loadApp()).not.toThrow();
  });
});

describe('Configuration', () => {
  test('config values are accessible', () => {
    const app = loadApp();
    const config = app.getConfig();

    expect(config.VIRTUAL_SCROLL_ITEM_HEIGHT).toBeDefined();
    expect(config.RENDER_BATCH_SIZE).toBeDefined();
    expect(config.TIME_FILTER_MAX_MINS).toBe(1500);
    expect(config.ENABLE_SCHEMA_VALIDATION).toBe(false);
  });

  test('schema validation is configurable', () => {
    const app = loadApp();
    expect(app.getConfig().ENABLE_SCHEMA_VALIDATION).toBe(false);
    expect(app.getConfig().VALIDATION_MODE).toBe('warn');
  });
});
