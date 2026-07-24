/**
 * Variant step selection (native Shopify variants).
 *
 * On the main product page, customers must actively choose every option before
 * they can add to cart:
 *   - No option is preselected (the Liquid picker renders nothing checked when
 *     there is no explicit ?variant in the URL).
 *   - All option groups are visible and can be picked in any order.
 *   - Add to cart / dynamic checkout / sticky bar stay disabled until every
 *     option has an explicit selection AND the resulting variant is available.
 *
 * Deep links are honored: if the page is loaded with ?variant=… the server
 * pre-checks that variant, we treat those as chosen, and the gate opens.
 *
 * The native variant-picker always re-resolves a *full* variant on every change
 * (the server marks the other options with their first-available value and the
 * picker morphs itself). After each morph we strip the checks off any option the
 * customer has not explicitly picked, so nothing looks chosen that isn't.
 *
 * Vanilla JS, no theme imports — loaded as a plain deferred script.
 */
(function () {
  var PICKER_SELECTOR = 'variant-picker[data-template-product-match="true"]';
  var COMPLETE_CLASS = 'variant-steps--complete';

  function init() {
    document.querySelectorAll(PICKER_SELECTOR).forEach(function (picker) {
      if (picker.__variantSteps) return;
      var form = picker.querySelector('.variant-picker__form');
      if (!form || !form.querySelector('fieldset')) return; // dropdowns / no options → leave native behavior
      picker.__variantSteps = new VariantStepController(picker, form);
    });
  }

  function VariantStepController(picker, form) {
    this.picker = picker;
    this.form = form;
    this.section = picker.closest('.shopify-section') || document.body;
    this.productForm = this.section.querySelector('product-form-component');
    /** option name -> value the customer explicitly chose */
    this.chosen = new Map();
    this.suppress = false;
    this._raf = null;

    this._bootstrapFromDeepLink();

    // Record real user selections before the native picker fetches/morphs.
    this.form.addEventListener('change', this._onChange.bind(this), true);

    // Re-assert our rules after every morph the native picker performs.
    this._observer = new MutationObserver(this._onMutations.bind(this));
    this._observer.observe(this.picker, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['checked', 'data-current-checked', 'class'],
    });

    // Hard-block the add paths (covers keyboard / Enter, not just clicks).
    this._installGuards();

    this.enforce();
  }

  /**
   * A deep link (?variant=…) makes the server pre-check the full variant. Since
   * the main picker renders nothing checked otherwise, any input checked on load
   * is a deliberate deep-link selection — adopt it as chosen.
   */
  VariantStepController.prototype._bootstrapFromDeepLink = function () {
    var self = this;
    this._fieldsets().forEach(function (fs) {
      var checked = fs.querySelector('input:checked');
      var name = self._optionName(fs);
      if (checked && name) self.chosen.set(name, checked.value);
    });
  };

  VariantStepController.prototype._fieldsets = function () {
    return Array.prototype.slice.call(this.form.querySelectorAll('fieldset.variant-option'));
  };

  VariantStepController.prototype._optionName = function (fieldset) {
    var input = fieldset.querySelector('input[data-option-name]');
    return input ? input.getAttribute('data-option-name') : null;
  };

  VariantStepController.prototype._onChange = function (event) {
    if (this.suppress) return;
    var input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    var name = input.getAttribute('data-option-name');
    if (name) this.chosen.set(name, input.value);
    // The native handler runs next (fetch + morph); enforce() re-runs after it.
  };

  VariantStepController.prototype._onMutations = function () {
    if (this.suppress) return;
    var self = this;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(function () {
      self._raf = null;
      self.enforce();
    });
  };

  /**
   * Reconcile the DOM with the customer's real selections and gate the buy
   * controls. Idempotent: a second pass produces no mutations, so the observer
   * it triggers settles immediately.
   */
  VariantStepController.prototype.enforce = function () {
    this.suppress = true;

    var self = this;
    var fieldsets = this._fieldsets();

    // Strip server-resolved checks off any option the customer hasn't chosen.
    fieldsets.forEach(function (fs) {
      var name = self._optionName(fs);
      if (name && self.chosen.has(name)) return;
      fs.querySelectorAll('input').forEach(function (input) {
        // Guard every write: re-writing an attribute with its current value still
        // queues a mutation record, which would re-trigger this observer forever.
        if (input.checked) input.checked = false;
        if (input.hasAttribute('checked')) input.removeAttribute('checked');
        if (input.dataset.currentChecked !== 'false') input.dataset.currentChecked = 'false';
      });
    });

    var allChosen =
      fieldsets.length > 0 &&
      fieldsets.every(function (fs) {
        var name = self._optionName(fs);
        return name && self.chosen.has(name) && fs.querySelector('input:checked');
      });

    // "Complete" (our step gate) means every option has been chosen. Availability
    // (sold out / unavailable) is left to the native theme, which shows the proper
    // "Sold out" text and disabled state. We only add availability into the button's
    // disabled flag so we never re-enable a sold-out variant we just ungated.
    var available = allChosen && this._selectedVariantAvailable();

    this._setGate(allChosen, available);
    this.suppress = false;
  };

  /** Availability of the currently resolved variant, per the picker's own JSON. */
  VariantStepController.prototype._selectedVariantAvailable = function () {
    var scripts = this.form.querySelectorAll('script[type="application/json"]');
    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      if (script.hasAttribute('data-all-variants')) continue;
      try {
        var data = JSON.parse(script.textContent || 'null');
        if (data && typeof data === 'object') return data.available === true;
      } catch (e) {
        /* ignore */
      }
    }
    return false;
  };

  /**
   * @param {boolean} allChosen - every option group has an explicit selection
   * @param {boolean} available - the resolved variant is purchasable
   */
  VariantStepController.prototype._setGate = function (allChosen, available) {
    // The CSS gate (dim + not-allowed cursor + hidden dynamic checkout) is tied to
    // this class, so it tracks "all options chosen" only. Sold-out styling/text is
    // left to the native theme once the gate is lifted.
    this.section.classList.toggle(COMPLETE_CLASS, allChosen);

    // Belt-and-suspenders alongside the CSS gate: reflect state on the buttons
    // themselves for assistive tech and the keyboard path. Stay disabled while
    // incomplete OR when the chosen variant isn't available.
    var buttons = this.section.querySelectorAll(
      'product-form-component button[name="add"], .sticky-add-to-cart__button'
    );
    buttons.forEach(function (button) {
      button.disabled = !(allChosen && available);
    });
  };

  VariantStepController.prototype._isIncomplete = function () {
    return !this.section.classList.contains(COMPLETE_CLASS);
  };

  /**
   * Prevent the add action from firing while incomplete, regardless of how it is
   * triggered (mouse, Enter-to-submit, keyboard activation). The CSS gate blocks
   * the mouse; these capture-phase guards close the keyboard/submit gaps and win
   * over the native handlers.
   */
  VariantStepController.prototype._installGuards = function () {
    var self = this;

    if (this.productForm) {
      var addForm = this.productForm.querySelector('form');
      if (addForm) {
        addForm.addEventListener(
          'submit',
          function (event) {
            if (self._isIncomplete()) {
              event.preventDefault();
              event.stopImmediatePropagation();
            }
          },
          true
        );
      }
    }

    this.section.querySelectorAll('.sticky-add-to-cart__button').forEach(function (button) {
      button.addEventListener(
        'click',
        function (event) {
          if (self._isIncomplete()) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        },
        true
      );
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
