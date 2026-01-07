/**
 * Cookbook Index App
 * A recipe browsing application with filtering, search, and favorites
 */

(function() {
  'use strict';

  // State
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
    expandedRecipes: new Set()
  };

  // DOM Elements
  const elements = {};

  // Initialize
  function init() {
    // Load data from Jekyll
    if (window.RECIPE_DATA) {
      state.recipes = window.RECIPE_DATA.recipes || [];
      state.books = {};
      (window.RECIPE_DATA.books || []).forEach(book => {
        state.books[book.id] = book;
      });
    }

    // Load favorites from localStorage
    loadFavorites();

    // Cache DOM elements
    cacheElements();

    // Build filter options
    buildFilterOptions();

    // Setup event listeners
    setupEventListeners();

    // Initial render
    applyFiltersAndRender();
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

      recipe.theme.forEach(t => uniqueValues.themes.add(t));

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
    labelEl.innerHTML = `<input type="checkbox" value="${escapeHtml(value)}"> ${escapeHtml(label)}`;
    return labelEl;
  }

  function setupEventListeners() {
    // Search
    elements.searchInput.addEventListener('input', debounce(handleSearch, 200));

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
    });

    // Filter inputs - text
    elements.filterIngredients.addEventListener('input', debounce(handleFilterChange, 200));

    // Time slider
    elements.filterTime.addEventListener('input', handleTimeFilterChange);

    // Recipe list - event delegation for expand/favorite
    elements.recipeList.addEventListener('click', handleRecipeListClick);
  }

  // Event Handlers
  function handleSearch(e) {
    state.filters.search = e.target.value.trim().toLowerCase();
    applyFiltersAndRender();
  }

  function toggleFilterPanel() {
    const isHidden = elements.filterPanel.classList.toggle('hidden');
    elements.toggleFilters.classList.toggle('active', !isHidden);
  }

  function toggleFavoritesOnly() {
    state.showFavoritesOnly = !state.showFavoritesOnly;
    elements.toggleFavorites.classList.toggle('active', state.showFavoritesOnly);
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
    const value = parseInt(elements.filterTime.value);
    if (value >= 300) {
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
    state.sortDirection = newDirection;
    applyFiltersAndRender();
  }

  function handleLanguageChange() {
    state.displayLanguage = elements.languageSelect.value;
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
      toggleFavorite(recipeId, favoriteBtn);
      return;
    }

    // Check if expand area was clicked (header or expand button)
    const header = e.target.closest('.recipe-item-header');
    if (header) {
      toggleRecipeExpand(recipeId, recipeItem);
    }
  }

  function toggleFavorite(recipeId, btn) {
    if (state.favorites.has(recipeId)) {
      state.favorites.delete(recipeId);
      btn.classList.remove('active');
    } else {
      state.favorites.add(recipeId);
      btn.classList.add('active');
    }
    saveFavorites();

    // Re-render if showing favorites only and we unfavorited
    if (state.showFavoritesOnly) {
      applyFiltersAndRender();
    }
  }

  function toggleRecipeExpand(recipeId, element) {
    const details = element.querySelector('.recipe-item-details');
    const isExpanded = element.classList.contains('expanded');

    if (isExpanded) {
      element.classList.remove('expanded');
      details.classList.add('hidden');
      state.expandedRecipes.delete(recipeId);
    } else {
      element.classList.add('expanded');
      details.classList.remove('hidden');
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
    elements.filterTime.value = 300;
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
  }

  // Filter Logic
  function applyFiltersAndRender() {
    state.filteredRecipes = filterRecipes();
    state.filteredRecipes = sortRecipes(state.filteredRecipes);
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
        const hasTheme = state.filters.themes.some(t => recipe.theme.includes(t));
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
        const searchTerms = state.filters.ingredients.split(',').map(s => s.trim().toLowerCase());
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
        const hasSeason = state.filters.seasons.some(s => recipe.seasonality.includes(s));
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
    const names = Object.values(recipe.name || {});
    for (const name of names) {
      if (name && name.toLowerCase().includes(searchTerm)) {
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
        case 'difficulty':
          const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
          valueA = difficultyOrder[a.difficulty] || 0;
          valueB = difficultyOrder[b.difficulty] || 0;
          break;
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

  // Rendering
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

    // Render recipes
    const fragment = document.createDocumentFragment();

    state.filteredRecipes.forEach(recipe => {
      const element = createRecipeElement(recipe);
      fragment.appendChild(element);
    });

    elements.recipeList.appendChild(fragment);
  }

  function createRecipeElement(recipe) {
    const template = elements.recipeTemplate.content.cloneNode(true);
    const element = template.querySelector('.recipe-item');
    const book = state.books[recipe.book_id];

    // Set data attributes
    element.dataset.id = recipe.id;

    // Apply book color as background
    if (book?.color) {
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
    if (state.favorites.has(recipe.id)) {
      favoriteBtn.classList.add('active');
    }

    // Details
    element.querySelector('.recipe-cuisine').textContent = book?.cuisine || 'Unknown';
    element.querySelector('.recipe-theme').textContent = recipe.theme.join(', ');
    element.querySelector('.recipe-total-time').textContent = formatTime(recipe.total_time_mins);
    element.querySelector('.recipe-active-time').textContent = formatTime(recipe.active_time_mins);

    const difficultyEl = element.querySelector('.recipe-difficulty');
    difficultyEl.textContent = capitalize(recipe.difficulty);
    difficultyEl.classList.add(`difficulty-${recipe.difficulty}`);

    element.querySelector('.recipe-season').textContent = recipe.seasonality.join(', ');

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
    if (state.expandedRecipes.has(recipe.id)) {
      element.classList.add('expanded');
      element.querySelector('.recipe-item-details').classList.remove('hidden');
    }

    return element;
  }

  // Helper Functions
  function getRecipeName(recipe, lang) {
    if (recipe.name[lang]) {
      return recipe.name[lang];
    }
    // Fallback to English
    return recipe.name.en || Object.values(recipe.name)[0] || 'Unknown';
  }

  function getAltNames(recipe, primaryLang) {
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
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // LocalStorage for Favorites
  function loadFavorites() {
    try {
      const stored = localStorage.getItem('cookbook-favorites');
      if (stored) {
        const parsed = JSON.parse(stored);
        state.favorites = new Set(parsed);
      }
    } catch (e) {
      console.warn('Could not load favorites from localStorage:', e);
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem('cookbook-favorites', JSON.stringify([...state.favorites]));
    } catch (e) {
      console.warn('Could not save favorites to localStorage:', e);
    }
  }

  // Start the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
