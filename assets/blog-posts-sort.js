/**
 * <blog-posts-sort> — client-side sorting for the blog posts grid.
 *
 * Shopify blogs can't be sorted server-side (Liquid can't read arbitrary
 * query params, and {% paginate %} only works on native objects, not sorted
 * arrays), so sorting is done in the browser by reordering the rendered
 * `.blog-post-item` cards inside the matching section's grid.
 *
 * The chosen sort is reflected in the URL (`?sort_by=`) so it survives the
 * category-tab soft reload and is re-applied on load. Reordering preserves each
 * grid position's presentation slot (size, horizontal/featured modifiers) so
 * the smart-mix and featured-grid layouts keep their shape — only the article
 * that fills each slot changes.
 *
 * Note: this sorts the articles currently in the DOM. With pagination on it
 * sorts the current page; turn pagination off to sort the whole blog.
 */
class BlogPostsSort extends HTMLElement {
  connectedCallback() {
    this.select = this.querySelector('select');
    if (!this.select) return;

    // Restore the sort from the URL if present (persists across tab reloads).
    const requested = new URLSearchParams(window.location.search).get('sort_by');
    if (requested && this.#isValidOption(requested)) {
      this.select.value = requested;
    }

    this.select.addEventListener('change', this.#handleChange);

    // Re-apply a non-default sort that was carried in via the URL.
    if (this.select.value !== this.#defaultSort) this.#apply();
  }

  disconnectedCallback() {
    this.select?.removeEventListener('change', this.#handleChange);
  }

  get #defaultSort() {
    return this.select?.dataset.defaultSort || this.select?.options[0]?.value || 'most-recent';
  }

  /**
   * @param {string} value
   * @returns {boolean}
   */
  #isValidOption(value) {
    return Array.from(this.select?.options ?? []).some((option) => option.value === value);
  }

  #handleChange = () => {
    const url = new URL(window.location.href);
    if (this.select.value === this.#defaultSort) {
      url.searchParams.delete('sort_by');
    } else {
      url.searchParams.set('sort_by', this.select.value);
    }
    window.history.replaceState({}, '', url);
    this.#apply();
  };

  /** @returns {HTMLElement | null} */
  get #grid() {
    const sectionId = this.getAttribute('section-id');
    if (!sectionId) return null;
    return document.querySelector(
      `blog-posts-list[section-id="${sectionId}"] .blog-posts-container`
    );
  }

  #apply() {
    const grid = this.#grid;
    if (!grid) return;

    const items = /** @type {HTMLElement[]} */ (
      Array.from(grid.querySelectorAll(':scope > .blog-post-item'))
    );
    if (items.length < 2) return;

    // Capture each grid position's presentation so the layout keeps its shape
    // (hero/featured slots stay put; only their content changes).
    const slots = items.map((element) => ({
      blogIndex: element.getAttribute('data-blog-index'),
      horizontal: element.classList.contains('blog-post-item--horizontal'),
      featured: element.classList.contains('blog-post-item--featured'),
      style: element.getAttribute('style'),
    }));

    const value = this.select.value;
    const sorted = items.slice().sort((a, b) => compareItems(a, b, value));

    const fragment = document.createDocumentFragment();
    sorted.forEach((element, index) => {
      const slot = slots[index];
      if (slot.blogIndex != null) element.setAttribute('data-blog-index', slot.blogIndex);
      element.classList.toggle('blog-post-item--horizontal', slot.horizontal);
      element.classList.toggle('blog-post-item--featured', slot.featured);
      if (slot.style != null) {
        element.setAttribute('style', slot.style);
      } else {
        element.removeAttribute('style');
      }
      fragment.appendChild(element);
    });
    grid.appendChild(fragment);
  }
}

/**
 * @param {HTMLElement} element
 * @returns {number}
 */
function dateOf(element) {
  return Number(element.getAttribute('data-article-date')) || 0;
}

/**
 * @param {HTMLElement} element
 * @returns {string}
 */
function titleOf(element) {
  return (element.getAttribute('data-article-title') || '').toLowerCase();
}

/**
 * @param {HTMLElement} a
 * @param {HTMLElement} b
 * @param {string} value
 * @returns {number}
 */
function compareItems(a, b, value) {
  switch (value) {
    case 'oldest':
      return dateOf(a) - dateOf(b);
    case 'title-ascending':
      return titleOf(a).localeCompare(titleOf(b));
    case 'title-descending':
      return titleOf(b).localeCompare(titleOf(a));
    case 'most-recent':
    default:
      return dateOf(b) - dateOf(a);
  }
}

if (!customElements.get('blog-posts-sort')) {
  customElements.define('blog-posts-sort', BlogPostsSort);
}
