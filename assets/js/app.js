/**
 * Cookbook Index App
 * A recipe browsing application with filtering, search, and favorites
 *
 * @version 2.0.0
 */

(function() {
  'use strict';

  // ===========================================
  // CONFIGURATION
  // ===========================================
  const CONFIG = {
    // Performance
    VIRTUAL_SCROLL_ITEM_HEIGHT: 56,      // Height of collapsed recipe item in pixels
    VIRTUAL_SCROLL_BUFFER: 5,            // Extra items to render above/below viewport
    RENDER_BATCH_SIZE: 50,               // Number of items to render per batch
    DEBOUNCE_DELAY_MS: 200,              // Debounce delay for search/filter inputs

    // Time filter
    TIME_FILTER_MAX_MINS: 1500,          // Maximum time filter value (25 hours for marinades)
    TIME_FILTER_STEP_MINS: 15,           // Time filter step size
    TIME_FILTER_DEFAULT_MINS: 1500,      // Default "Any" value

    // Validation
    ENABLE_SCHEMA_VALIDATION: false,     // Set to true to enable strict schema validation
    VALIDATION_MODE: 'warn',             // 'warn' logs issues, 'strict' throws errors

    // Storage
    STORAGE_KEY_FAVORITES: 'cookbook-favorites',
    STORAGE_KEY_PREFERENCES: 'cookbook-preferences',

    // Hex color validation regex
    HEX_COLOR_REGEX: /^#[0-9A-Fa-f]{6}$/
  };

  // ===========================================
  // SCHEMA VALIDATION
  // ===========================================
  const RecipeSchema = {
    required: ['id', 'name', 'book_id', 'page', 'theme', 'total_time_mins', 'active_time_mins', 'difficulty', 'seasonality'],
    properties: {
      id: { type: 'string', minLength: 1 },
      name: { type: 'object', required: ['en'] },
      book_id: { type: 'string', minLength: 1 },
      page: { type: 'number', min: 1 },
      theme: { type: 'array', minLength: 1 },
      total_time_mins: { type: 'number', min: 1 },
      active_time_mins: { type: 'number', min: 1 },
      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
      seasonality: { type: 'array', items: { enum: ['Spring', 'Summer', 'Autumn', 'Winter'] } },
      ingredients: { type: 'object' }
    }
  };

  const BookSchema = {
    required: ['id', 'title', 'author', 'cuisine'],
    properties: {
      id: { type: 'string', minLength: 1 },
      title: { type: 'string', minLength: 1 },
      author: { type: 'string', minLength: 1 },
      cuisine: { type: 'string', minLength: 1 },
      color: { type: 'string', pattern: CONFIG.HEX_COLOR_REGEX }
    }
  };

  /**
   * Validates an object against a schema
   * @param {Object} obj - Object to validate
   * @param {Object} schema - Schema definition
   * @param {string} context - Context for error messages
   * @returns {Array} Array of validation errors
   */
  function validateSchema(obj, schema, context = '') {
    const errors = [];

    if (!obj || typeof obj !== 'object') {
      errors.push(`${context}: Expected object, got ${typeof obj}`);
      return errors;
    }

    // Check required fields
    for (const field of schema.required || []) {
      if (obj[field] === undefined || obj[field] === null) {
        errors.push(`${context}: Missing required field '${field}'`);
      }
    }

    // Validate properties
    for (const [key, rules] of Object.entries(schema.properties || {})) {
      const value = obj[key];
      if (value === undefined) continue;

      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`${context}.${key}: Expected string, got ${typeof value}`);
      }
      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push(`${context}.${key}: Expected number, got ${typeof value}`);
      }
      if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push(`${context}.${key}: Expected array, got ${typeof value}`);
      }
      if (rules.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
        errors.push(`${context}.${key}: Expected object, got ${typeof value}`);
      }
      if (rules.minLength !== undefined && (value.length || 0) < rules.minLength) {
        errors.push(`${context}.${key}: Length must be at least ${rules.minLength}`);
      }
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${context}.${key}: Value must be at least ${rules.min}`);
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${context}.${key}: Value must be one of [${rules.enum.join(', ')}]`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${context}.${key}: Value does not match required pattern`);
      }
    }

    return errors;
  }

  // ===========================================
  // STATE
  // ===========================================
  const state = {
    recipes: [],
    books: {},
    filteredRecipes: [],
    favorites: new Set(),
    filters: {
      search: '',
      books: [],
      cuisines: [],
      themes: [],
      proteins: [],
      carbs: [],
      ingredients: '',
      difficulties: [],
      seasons: [],
      maxTime: null
    },
    filterLogic: 'and',
    showFavoritesOnly: false,
    sortBy: 'name',
    sortDirection: 'asc',
    displayLanguage: 'en',
    expandedRecipes: new Set(),

    // Virtual scrolling state
    virtualScroll: {
      startIndex: 0,
      endIndex: 0,
      scrollTop: 0,
      containerHeight: 0
    },

    // Validation errors
    validationErrors: []
  };

  // DOM Elements cache
  const elements = {};

  // ===========================================
  // INITIALIZATION
  // ===========================================
  function init() {
    try {
      // Load and validate data from Jekyll
      loadData();

      // Load favorites from localStorage
      loadFavorites();

      // Load user preferences
      loadPreferences();

      // Cache DOM elements
      cacheElements();

      // Build filter options
      buildFilterOptions();

      // Setup event listeners
      setupEventListeners();

      // Setup keyboard navigation
      setupKeyboardNavigation();

      // Initial render
      applyFiltersAndRender();

      // Report any validation errors
      if (state.validationErrors.length > 0) {
        console.warn('Data validation warnings:', state.validationErrors);
      }
    } catch (error) {
      console.error('Failed to initialize Cookbook Index:', error);
      showErrorState('Failed to load recipes. Please refresh the page.');
    }
  }

  function loadData() {
    if (!window.RECIPE_DATA) {
      throw new Error('Recipe data not found');
    }

    const rawBooks = window.RECIPE_DATA.books || [];
    const rawRecipes = window.RECIPE_DATA.recipes || [];

    // Validate and load books
    state.books = {};
    rawBooks.forEach((book, index) => {
      if (CONFIG.ENABLE_SCHEMA_VALIDATION) {
        const errors = validateSchema(book, BookSchema, `books[${index}]`);
        if (errors.length > 0) {
          state.validationErrors.push(...errors);
          if (CONFIG.VALIDATION_MODE === 'strict') {
            throw new Error(`Invalid book data: ${errors.join(', ')}`);
          }
        }
      }

      // Sanitize book color
      if (book.color && !isValidHexColor(book.color)) {
        console.warn(`Invalid color for book "${book.id}": ${book.color}. Using default.`);
        book.color = null;
      }

      state.books[book.id] = book;
    });

    // Validate and load recipes
    state.recipes = [];
    rawRecipes.forEach((recipe, index) => {
      if (CONFIG.ENABLE_SCHEMA_VALIDATION) {
        const errors = validateSchema(recipe, RecipeSchema, `recipes[${index}]`);
        if (errors.length > 0) {
          state.validationErrors.push(...errors);
          if (CONFIG.VALIDATION_MODE === 'strict') {
            throw new Error(`Invalid recipe data: ${errors.join(', ')}`);
          }
        }
      }

      // Warn if book doesn't exist
      if (!state.books[recipe.book_id]) {
        console.warn(`Recipe "${recipe.id}" references unknown book "${recipe.book_id}"`);
      }

      state.recipes.push(recipe);
    });
  }

  function cacheElements() {
    elements.searchInput = document.getElementById('search-input');
    elements.toggleFilters = document.getElementById('toggle-filters');
    elements.toggleFavorites = document.getElementById('toggle-favorites');
    elements.filterPanel = document.getElementById('filter-panel');
    elements.filterLogicToggle = document.getElementById('filter-logic-toggle');
    elements.activeFilterCount = document.getElementById('active-filter-count');
    elements.clearFilters = document.getElementById('clear-filters');
    elements.sortSelect = document.getElementById('sort-select');
    elements.sortDirection = document.getElementById('sort-direction');
    elements.languageSelect = document.getElementById('language-select');
    elements.resultsCount = document.getElementById('results-count');
    elements.recipeList = document.getElementById('recipe-list');
    elements.emptyState = document.getElementById('empty-state');
    elements.recipeTemplate = document.getElementById('recipe-item-template');

    // Filter inputs
    elements.filterBooks = document.getElementById('filter-books');
    elements.filterCuisines = document.getElementById('filter-cuisines');
    elements.filterThemes = document.getElementById('filter-themes');
    elements.filterProteins = document.getElementById('filter-proteins');
    elements.filterCarbs = document.getElementById('filter-carbs');
    elements.filterIngredients = document.getElementById('filter-ingredients');
    elements.filterDifficulty = document.getElementById('filter-difficulty');
    elements.filterSeasons = document.getElementById('filter-seasons');
    elements.filterTime = document.getElementById('filter-time');
    elements.filterTimeDisplay = document.getElementById('filter-time-display');
  }

  function buildFilterOptions() {
    const uniqueValues = {
      cuisines: new Set(),
      themes: new Set(),
      proteins: new Set(),
      carbs: new Set()
    };

    // Extract unique values from recipes
    state.recipes.forEach(recipe => {
      const book = state.books[recipe.book_id];
      if (book) uniqueValues.cuisines.add(book.cuisine);

      (recipe.theme || []).forEach(t => uniqueValues.themes.add(t));

      if (recipe.ingredients) {
        (recipe.ingredients.protein || []).forEach(p => uniqueValues.proteins.add(p));
        (recipe.ingredients.carbohydrate || []).forEach(c => uniqueValues.carbs.add(c));
      }
    });

    // Build book filters
    Object.values(state.books).forEach(book => {
      elements.filterBooks.appendChild(createFilterCheckbox(book.title, book.id));
    });

    // Build cuisine filters
    [...uniqueValues.cuisines].sort().forEach(cuisine => {
      elements.filterCuisines.appendChild(createFilterCheckbox(cuisine, cuisine));
    });

    // Build theme filters
    [...uniqueValues.themes].sort().forEach(theme => {
      elements.filterThemes.appendChild(createFilterCheckbox(theme, theme));
    });

    // Build protein filters
    [...uniqueValues.proteins].sort().forEach(protein => {
      elements.filterProteins.appendChild(createFilterCheckbox(protein, protein));
    });

    // Build carb filters
    [...uniqueValues.carbs].sort().forEach(carb => {
      elements.filterCarbs.appendChild(createFilterCheckbox(carb, carb));
    });
  }

  function createFilterCheckbox(label, value) {
    const labelEl = document.createElement('label');
    labelEl.className = 'filter-checkbox';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = value;

    const text = document.createTextNode(' ' + label);

    labelEl.appendChild(input);
    labelEl.appendChild(text);

    return labelEl;
  }

  // ===========================================
  // EVENT LISTENERS
  // ===========================================
  function setupEventListeners() {
    // Search
    elements.searchInput.addEventListener('input', debounce(handleSearch, CONFIG.DEBOUNCE_DELAY_MS));

    // Toggle filters panel
    elements.toggleFilters.addEventListener('click', toggleFilterPanel);

    // Toggle favorites only
    elements.toggleFavorites.addEventListener('click', toggleFavoritesOnly);

    // Filter logic toggle
    elements.filterLogicToggle.addEventListener('click', handleFilterLogicToggle);

    // Clear filters
    elements.clearFilters.addEventListener('click', clearAllFilters);

    // Sort controls
    elements.sortSelect.addEventListener('change', handleSortChange);
    elements.sortDirection.addEventListener('click', handleSortDirectionToggle);

    // Language select
    elements.languageSelect.addEventListener('change', handleLanguageChange);

    // Filter inputs - checkboxes
    elements.filterPanel.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', handleFilterChange);
      // Fallback for browsers without :has() support
      input.addEventListener('change', handleCheckboxStyleFallback);
    });

    // Filter inputs - text
    elements.filterIngredients.addEventListener('input', debounce(handleFilterChange, CONFIG.DEBOUNCE_DELAY_MS));

    // Time slider
    elements.filterTime.addEventListener('input', handleTimeFilterChange);

    // Recipe list - event delegation for expand/favorite
    elements.recipeList.addEventListener('click', handleRecipeListClick);

    // Virtual scroll - listen for scroll events
    window.addEventListener('scroll', debounce(handleScroll, 16), { passive: true });
    window.addEventListener('resize', debounce(handleResize, 100), { passive: true });
  }

  function setupKeyboardNavigation() {
    // Keyboard navigation for recipe list
    elements.recipeList.addEventListener('keydown', handleRecipeListKeydown);
  }

  // ===========================================
  // EVENT HANDLERS
  // ===========================================
  function handleSearch(e) {
    state.filters.search = e.target.value.trim().toLowerCase();
    applyFiltersAndRender();
  }

  /**
   * Fallback for browsers without :has() CSS support
   * Toggles .checked class on parent label when checkbox changes
   */
  function handleCheckboxStyleFallback(e) {
    const checkbox = e.target;
    const label = checkbox.closest('.filter-checkbox');
    if (label) {
      label.classList.toggle('checked', checkbox.checked);
    }
  }

  function toggleFilterPanel() {
    const isHidden = elements.filterPanel.classList.toggle('hidden');
    elements.toggleFilters.classList.toggle('active', !isHidden);
    elements.toggleFilters.setAttribute('aria-expanded', !isHidden);
  }

  function toggleFavoritesOnly() {
    state.showFavoritesOnly = !state.showFavoritesOnly;
    elements.toggleFavorites.classList.toggle('active', state.showFavoritesOnly);
    elements.toggleFavorites.setAttribute('aria-pressed', state.showFavoritesOnly);
    applyFiltersAndRender();
  }

  function handleFilterLogicToggle() {
    const options = elements.filterLogicToggle.querySelectorAll('.logic-option');
    const currentLogic = elements.filterLogicToggle.dataset.logic;
    const newLogic = currentLogic === 'and' ? 'or' : 'and';

    elements.filterLogicToggle.dataset.logic = newLogic;
    options.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.value === newLogic);
    });

    state.filterLogic = newLogic;
    applyFiltersAndRender();
  }

  function handleFilterChange() {
    // Gather all filter values
    state.filters.books = getCheckedValues(elements.filterBooks);
    state.filters.cuisines = getCheckedValues(elements.filterCuisines);
    state.filters.themes = getCheckedValues(elements.filterThemes);
    state.filters.proteins = getCheckedValues(elements.filterProteins);
    state.filters.carbs = getCheckedValues(elements.filterCarbs);
    state.filters.ingredients = elements.filterIngredients.value.trim().toLowerCase();
    state.filters.difficulties = getCheckedValues(elements.filterDifficulty);
    state.filters.seasons = getCheckedValues(elements.filterSeasons);

    updateFilterCount();
    applyFiltersAndRender();
  }

  function handleTimeFilterChange() {
    const value = parseInt(elements.filterTime.value, 10);
    if (value >= CONFIG.TIME_FILTER_DEFAULT_MINS) {
      state.filters.maxTime = null;
      elements.filterTimeDisplay.textContent = 'Any';
    } else {
      state.filters.maxTime = value;
      elements.filterTimeDisplay.textContent = formatTime(value);
    }
    updateFilterCount();
    applyFiltersAndRender();
  }

  function handleSortChange() {
    state.sortBy = elements.sortSelect.value;
    applyFiltersAndRender();
  }

  function handleSortDirectionToggle() {
    const current = elements.sortDirection.dataset.direction;
    const newDirection = current === 'asc' ? 'desc' : 'asc';
    elements.sortDirection.dataset.direction = newDirection;
    elements.sortDirection.setAttribute('aria-label', `Sort ${newDirection === 'asc' ? 'ascending' : 'descending'}`);
    state.sortDirection = newDirection;
    applyFiltersAndRender();
  }

  function handleLanguageChange() {
    state.displayLanguage = elements.languageSelect.value;
    savePreferences();
    renderRecipes();
  }

  function handleRecipeListClick(e) {
    const recipeItem = e.target.closest('.recipe-item');
    if (!recipeItem) return;

    const recipeId = recipeItem.dataset.id;

    // Check if favorite button was clicked
    const favoriteBtn = e.target.closest('.favorite-btn');
    if (favoriteBtn) {
      e.stopPropagation();
      toggleFavorite(recipeId, favoriteBtn, recipeItem);
      return;
    }

    // Check if expand area was clicked (header or expand button)
    const header = e.target.closest('.recipe-item-header');
    if (header) {
      toggleRecipeExpand(recipeId, recipeItem);
    }
  }

  function handleRecipeListKeydown(e) {
    const recipeItem = e.target.closest('.recipe-item');
    if (!recipeItem) return;

    const recipeId = recipeItem.dataset.id;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        toggleRecipeExpand(recipeId, recipeItem);
        break;
      case 'ArrowDown':
        e.preventDefault();
        focusNextRecipe(recipeItem);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusPreviousRecipe(recipeItem);
        break;
      case 'f':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const favoriteBtn = recipeItem.querySelector('.favorite-btn');
          toggleFavorite(recipeId, favoriteBtn, recipeItem);
        }
        break;
    }
  }

  function focusNextRecipe(current) {
    const next = current.nextElementSibling;
    if (next && next.classList.contains('recipe-item')) {
      next.focus();
    }
  }

  function focusPreviousRecipe(current) {
    const prev = current.previousElementSibling;
    if (prev && prev.classList.contains('recipe-item')) {
      prev.focus();
    }
  }

  function handleScroll() {
    updateVirtualScroll();
  }

  function handleResize() {
    state.virtualScroll.containerHeight = window.innerHeight;
    updateVirtualScroll();
  }

  function toggleFavorite(recipeId, btn, _recipeItem) {
    const isNowFavorite = !state.favorites.has(recipeId);

    if (isNowFavorite) {
      state.favorites.add(recipeId);
      btn.classList.add('active');
      btn.setAttribute('aria-label', 'Remove from favorites');
    } else {
      state.favorites.delete(recipeId);
      btn.classList.remove('active');
      btn.setAttribute('aria-label', 'Add to favorites');
    }

    // Announce change to screen readers
    announceToScreenReader(`Recipe ${isNowFavorite ? 'added to' : 'removed from'} favorites`);

    saveFavorites();

    // Re-render if showing favorites only and we unfavorited
    if (state.showFavoritesOnly && !isNowFavorite) {
      applyFiltersAndRender();
    }
  }

  function toggleRecipeExpand(recipeId, element) {
    const details = element.querySelector('.recipe-item-details');
    const expandBtn = element.querySelector('.expand-btn');
    const isExpanded = element.classList.contains('expanded');

    if (isExpanded) {
      element.classList.remove('expanded');
      details.classList.add('hidden');
      expandBtn.setAttribute('aria-expanded', 'false');
      state.expandedRecipes.delete(recipeId);
    } else {
      element.classList.add('expanded');
      details.classList.remove('hidden');
      expandBtn.setAttribute('aria-expanded', 'true');
      state.expandedRecipes.add(recipeId);
    }
  }

  function clearAllFilters() {
    // Clear search
    elements.searchInput.value = '';
    state.filters.search = '';

    // Clear checkboxes
    elements.filterPanel.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = false;
    });

    // Clear text input
    elements.filterIngredients.value = '';

    // Reset time slider
    elements.filterTime.value = CONFIG.TIME_FILTER_DEFAULT_MINS;
    elements.filterTimeDisplay.textContent = 'Any';

    // Reset state
    state.filters = {
      search: '',
      books: [],
      cuisines: [],
      themes: [],
      proteins: [],
      carbs: [],
      ingredients: '',
      difficulties: [],
      seasons: [],
      maxTime: null
    };

    updateFilterCount();
    applyFiltersAndRender();

    announceToScreenReader('All filters cleared');
  }

  // ===========================================
  // FILTER LOGIC
  // ===========================================
  function applyFiltersAndRender() {
    state.filteredRecipes = filterRecipes();
    state.filteredRecipes = sortRecipes(state.filteredRecipes);

    // Reset virtual scroll
    state.virtualScroll.startIndex = 0;
    state.virtualScroll.containerHeight = window.innerHeight;

    renderRecipes();
  }

  function filterRecipes() {
    return state.recipes.filter(recipe => {
      // Favorites filter
      if (state.showFavoritesOnly && !state.favorites.has(recipe.id)) {
        return false;
      }

      const checks = [];

      // Search filter (always AND)
      if (state.filters.search) {
        const searchMatch = matchesSearch(recipe, state.filters.search);
        if (!searchMatch) return false;
      }

      // Book filter
      if (state.filters.books.length > 0) {
        checks.push(state.filters.books.includes(recipe.book_id));
      }

      // Cuisine filter
      if (state.filters.cuisines.length > 0) {
        const book = state.books[recipe.book_id];
        checks.push(book && state.filters.cuisines.includes(book.cuisine));
      }

      // Theme filter
      if (state.filters.themes.length > 0) {
        const hasTheme = state.filters.themes.some(t => (recipe.theme || []).includes(t));
        checks.push(hasTheme);
      }

      // Protein filter
      if (state.filters.proteins.length > 0) {
        const proteins = recipe.ingredients?.protein || [];
        const hasProtein = state.filters.proteins.some(p => proteins.includes(p));
        checks.push(hasProtein);
      }

      // Carb filter
      if (state.filters.carbs.length > 0) {
        const carbs = recipe.ingredients?.carbohydrate || [];
        const hasCarb = state.filters.carbs.some(c => carbs.includes(c));
        checks.push(hasCarb);
      }

      // Ingredients text filter
      if (state.filters.ingredients) {
        const searchTerms = state.filters.ingredients.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const otherIngredients = (recipe.ingredients?.other || []).join(' ').toLowerCase();
        const hasIngredients = searchTerms.every(term => otherIngredients.includes(term));
        checks.push(hasIngredients);
      }

      // Difficulty filter
      if (state.filters.difficulties.length > 0) {
        checks.push(state.filters.difficulties.includes(recipe.difficulty));
      }

      // Season filter
      if (state.filters.seasons.length > 0) {
        const hasSeason = state.filters.seasons.some(s => (recipe.seasonality || []).includes(s));
        checks.push(hasSeason);
      }

      // Time filter
      if (state.filters.maxTime !== null) {
        checks.push(recipe.total_time_mins <= state.filters.maxTime);
      }

      // Apply AND/OR logic
      if (checks.length === 0) return true;

      if (state.filterLogic === 'and') {
        return checks.every(Boolean);
      } else {
        return checks.some(Boolean);
      }
    });
  }

  function matchesSearch(recipe, searchTerm) {
    // Search in all language variants of the name
    const normalizedSearch = searchTerm.toLowerCase();
    const names = Object.values(recipe.name || {});
    for (const name of names) {
      if (name && name.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
    }
    return false;
  }

  function sortRecipes(recipes) {
    const sorted = [...recipes];
    const direction = state.sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let valueA, valueB;

      switch (state.sortBy) {
        case 'name':
          valueA = getRecipeName(a, 'en').toLowerCase();
          valueB = getRecipeName(b, 'en').toLowerCase();
          break;
        case 'book':
          valueA = state.books[a.book_id]?.title || '';
          valueB = state.books[b.book_id]?.title || '';
          break;
        case 'total_time':
          valueA = a.total_time_mins;
          valueB = b.total_time_mins;
          break;
        case 'active_time':
          valueA = a.active_time_mins;
          valueB = b.active_time_mins;
          break;
        case 'difficulty': {
          const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
          valueA = difficultyOrder[a.difficulty] || 0;
          valueB = difficultyOrder[b.difficulty] || 0;
          break;
        }
        case 'page':
          valueA = a.page;
          valueB = b.page;
          break;
        default:
          return 0;
      }

      if (typeof valueA === 'string') {
        return direction * valueA.localeCompare(valueB);
      }
      return direction * (valueA - valueB);
    });

    return sorted;
  }

  // ===========================================
  // VIRTUAL SCROLLING
  // ===========================================
  function updateVirtualScroll() {
    if (state.filteredRecipes.length <= CONFIG.RENDER_BATCH_SIZE) {
      // No need for virtual scrolling with small datasets
      return;
    }

    const scrollTop = window.scrollY;
    const listTop = elements.recipeList.offsetTop;
    const viewportHeight = window.innerHeight;
    const itemHeight = CONFIG.VIRTUAL_SCROLL_ITEM_HEIGHT;

    // Calculate visible range
    const relativeScrollTop = Math.max(0, scrollTop - listTop);
    const startIndex = Math.max(0, Math.floor(relativeScrollTop / itemHeight) - CONFIG.VIRTUAL_SCROLL_BUFFER);
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + (CONFIG.VIRTUAL_SCROLL_BUFFER * 2);
    const endIndex = Math.min(state.filteredRecipes.length, startIndex + visibleCount);

    // Only re-render if the visible range changed significantly
    if (Math.abs(startIndex - state.virtualScroll.startIndex) > CONFIG.VIRTUAL_SCROLL_BUFFER / 2) {
      state.virtualScroll.startIndex = startIndex;
      state.virtualScroll.endIndex = endIndex;
      renderRecipes();
    }
  }

  // ===========================================
  // RENDERING
  // ===========================================
  function renderRecipes() {
    // Update results count
    elements.resultsCount.textContent = state.filteredRecipes.length;

    // Clear list
    elements.recipeList.innerHTML = '';

    // Show/hide empty state
    if (state.filteredRecipes.length === 0) {
      elements.emptyState.classList.remove('hidden');
      elements.recipeList.classList.add('hidden');
      return;
    }

    elements.emptyState.classList.add('hidden');
    elements.recipeList.classList.remove('hidden');

    // Determine rendering range
    let startIndex = 0;
    let endIndex = state.filteredRecipes.length;

    // Use virtual scrolling for large datasets
    if (state.filteredRecipes.length > CONFIG.RENDER_BATCH_SIZE) {
      startIndex = state.virtualScroll.startIndex;
      endIndex = Math.min(
        state.filteredRecipes.length,
        startIndex + CONFIG.RENDER_BATCH_SIZE + (CONFIG.VIRTUAL_SCROLL_BUFFER * 2)
      );

      // Add spacer for items above the viewport
      if (startIndex > 0) {
        const topSpacer = document.createElement('div');
        topSpacer.style.height = `${startIndex * CONFIG.VIRTUAL_SCROLL_ITEM_HEIGHT}px`;
        topSpacer.className = 'virtual-scroll-spacer';
        topSpacer.setAttribute('aria-hidden', 'true');
        elements.recipeList.appendChild(topSpacer);
      }
    }

    // Render visible recipes
    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      const recipe = state.filteredRecipes[i];
      const element = createRecipeElement(recipe, i);
      fragment.appendChild(element);
    }
    elements.recipeList.appendChild(fragment);

    // Add bottom spacer for virtual scrolling
    if (state.filteredRecipes.length > CONFIG.RENDER_BATCH_SIZE && endIndex < state.filteredRecipes.length) {
      const bottomSpacer = document.createElement('div');
      bottomSpacer.style.height = `${(state.filteredRecipes.length - endIndex) * CONFIG.VIRTUAL_SCROLL_ITEM_HEIGHT}px`;
      bottomSpacer.className = 'virtual-scroll-spacer';
      bottomSpacer.setAttribute('aria-hidden', 'true');
      elements.recipeList.appendChild(bottomSpacer);
    }
  }

  function createRecipeElement(recipe, index) {
    const template = elements.recipeTemplate.content.cloneNode(true);
    const element = template.querySelector('.recipe-item');
    const book = state.books[recipe.book_id];

    // Set data attributes
    element.dataset.id = recipe.id;
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-posinset', index + 1);
    element.setAttribute('aria-setsize', state.filteredRecipes.length);

    // Apply book color as background (with validation)
    if (book?.color && isValidHexColor(book.color)) {
      element.style.setProperty('--book-color', hexToRgba(book.color, 0.08));
      element.setAttribute('data-book-color', 'true');
    }

    // Recipe name
    const primaryName = getRecipeName(recipe, state.displayLanguage);
    const altNames = getAltNames(recipe, state.displayLanguage);

    element.querySelector('.recipe-name').textContent = primaryName;
    element.querySelector('.recipe-alt-names').textContent = altNames ? `(${altNames})` : '';

    // Book and page
    element.querySelector('.recipe-book').textContent = book?.title || 'Unknown';
    element.querySelector('.recipe-page').textContent = recipe.page;

    // Favorite state
    const favoriteBtn = element.querySelector('.favorite-btn');
    const isFavorite = state.favorites.has(recipe.id);
    if (isFavorite) {
      favoriteBtn.classList.add('active');
    }
    favoriteBtn.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    favoriteBtn.setAttribute('aria-pressed', isFavorite);

    // Expand button accessibility
    const expandBtn = element.querySelector('.expand-btn');
    const isExpanded = state.expandedRecipes.has(recipe.id);
    expandBtn.setAttribute('aria-expanded', isExpanded);
    expandBtn.setAttribute('aria-controls', `details-${recipe.id}`);

    // Details section
    const details = element.querySelector('.recipe-item-details');
    details.id = `details-${recipe.id}`;

    element.querySelector('.recipe-cuisine').textContent = book?.cuisine || 'Unknown';
    element.querySelector('.recipe-theme').textContent = (recipe.theme || []).join(', ');
    element.querySelector('.recipe-total-time').textContent = formatTime(recipe.total_time_mins);
    element.querySelector('.recipe-active-time').textContent = formatTime(recipe.active_time_mins);

    const difficultyEl = element.querySelector('.recipe-difficulty');
    difficultyEl.textContent = capitalize(recipe.difficulty);
    difficultyEl.classList.add(`difficulty-${recipe.difficulty}`);

    element.querySelector('.recipe-season').textContent = (recipe.seasonality || []).join(', ');

    // Ingredients
    const ingredientsList = element.querySelector('.ingredients-list');
    const allIngredients = [];

    // Add proteins with special styling
    (recipe.ingredients?.protein || []).forEach(p => {
      allIngredients.push({ text: p, type: 'protein' });
    });

    // Add carbs with special styling
    (recipe.ingredients?.carbohydrate || []).forEach(c => {
      allIngredients.push({ text: c, type: 'carb' });
    });

    // Add other ingredients
    (recipe.ingredients?.other || []).forEach(i => {
      allIngredients.push({ text: i, type: 'other' });
    });

    allIngredients.forEach(ing => {
      const tag = document.createElement('span');
      tag.className = `ingredient-tag ${ing.type}`;
      tag.textContent = ing.text;
      ingredientsList.appendChild(tag);
    });

    // Restore expanded state
    if (isExpanded) {
      element.classList.add('expanded');
      details.classList.remove('hidden');
    }

    return element;
  }

  function showErrorState(message) {
    elements.recipeList.innerHTML = '';
    elements.emptyState.classList.remove('hidden');
    elements.emptyState.querySelector('h2').textContent = 'Error';
    elements.emptyState.querySelector('p').textContent = message;
  }

  // ===========================================
  // HELPER FUNCTIONS
  // ===========================================
  function getRecipeName(recipe, lang) {
    if (recipe.name && recipe.name[lang]) {
      return recipe.name[lang];
    }
    // Fallback to English
    return recipe.name?.en || Object.values(recipe.name || {})[0] || 'Unknown';
  }

  function getAltNames(recipe, primaryLang) {
    if (!recipe.name) return '';

    const altLangs = Object.keys(recipe.name).filter(lang => lang !== primaryLang && lang !== 'en');
    if (primaryLang !== 'en' && recipe.name.en) {
      altLangs.unshift('en');
    }

    // Show first available alternative name
    for (const lang of altLangs) {
      if (recipe.name[lang]) {
        return recipe.name[lang];
      }
    }
    return '';
  }

  function getCheckedValues(container) {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  function updateFilterCount() {
    let count = 0;
    count += state.filters.books.length;
    count += state.filters.cuisines.length;
    count += state.filters.themes.length;
    count += state.filters.proteins.length;
    count += state.filters.carbs.length;
    count += state.filters.ingredients ? 1 : 0;
    count += state.filters.difficulties.length;
    count += state.filters.seasons.length;
    count += state.filters.maxTime !== null ? 1 : 0;

    if (count > 0) {
      elements.activeFilterCount.textContent = count;
      elements.activeFilterCount.classList.remove('hidden');
    } else {
      elements.activeFilterCount.classList.add('hidden');
    }
  }

  function formatTime(mins) {
    if (mins < 60) {
      return `${mins} min`;
    }
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (remainingMins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMins}m`;
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function isValidHexColor(color) {
    return CONFIG.HEX_COLOR_REGEX.test(color);
  }

  function hexToRgba(hex, alpha) {
    // Validate hex format first
    if (!isValidHexColor(hex)) {
      console.warn(`Invalid hex color: ${hex}`);
      return 'rgba(0, 0, 0, 0)';
    }

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Ensure alpha is within valid range
    const safeAlpha = Math.max(0, Math.min(1, alpha));

    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  // ===========================================
  // LOCAL STORAGE
  // ===========================================
  function loadFavorites() {
    try {
      const stored = localStorage.getItem(CONFIG.STORAGE_KEY_FAVORITES);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate that parsed is an array of strings
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          state.favorites = new Set(parsed);
        } else {
          console.warn('Invalid favorites data in localStorage, resetting');
          state.favorites = new Set();
          saveFavorites();
        }
      }
    } catch (e) {
      console.warn('Could not load favorites from localStorage:', e);
      state.favorites = new Set();
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_FAVORITES, JSON.stringify([...state.favorites]));
    } catch (e) {
      console.warn('Could not save favorites to localStorage:', e);
      // Notify user if storage is full
      if (e.name === 'QuotaExceededError') {
        announceToScreenReader('Unable to save favorite: storage is full');
      }
    }
  }

  function loadPreferences() {
    try {
      const stored = localStorage.getItem(CONFIG.STORAGE_KEY_PREFERENCES);
      if (stored) {
        const prefs = JSON.parse(stored);
        if (prefs.displayLanguage && typeof prefs.displayLanguage === 'string') {
          state.displayLanguage = prefs.displayLanguage;
          if (elements.languageSelect) {
            elements.languageSelect.value = prefs.displayLanguage;
          }
        }
      }
    } catch (e) {
      console.warn('Could not load preferences from localStorage:', e);
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_PREFERENCES, JSON.stringify({
        displayLanguage: state.displayLanguage
      }));
    } catch (e) {
      console.warn('Could not save preferences to localStorage:', e);
    }
  }

  // ===========================================
  // EXPORTS FOR TESTING
  // ===========================================
  // Export functions for testing when in test environment
  if (typeof window !== 'undefined') {
    window.CookbookApp = {
      // Test utilities
      _test: {
        filterRecipes: () => filterRecipes(),
        sortRecipes: (recipes) => sortRecipes(recipes),
        matchesSearch: matchesSearch,
        validateSchema: validateSchema,
        isValidHexColor: isValidHexColor,
        hexToRgba: hexToRgba,
        formatTime: formatTime,
        getState: () => state,
        setState: (newState) => Object.assign(state, newState),
        getConfig: () => CONFIG,
        RecipeSchema: RecipeSchema,
        BookSchema: BookSchema
      }
    };
  }

  // ===========================================
  // INITIALIZATION
  // ===========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
