		// variant A: link.js prepended `.link-field` (input + .link-btn) into input_area with jQuery; here
		// frappe.ui.form.LinkInput draws it (frappe-ui's Combobox) and hands back the same elements
		make_input() {
			var me = this;
			this.link_view = new frappe.ui.form.LinkInput({ parent: this.input_area, control: this });
			const parts = this.link_view.$parts;
			this.$input_area = $(this.input_area);
			// legacy markup's classes (form-control would draw Bootstrap's box inside frappe-ui's trigger)
			this.$input = $(parts.input).addClass("input-with-feedback");
			this.$link = $(parts.link_btn);
			this.$link_clear = $(parts.btn_clear);
			this.$link_open = $(parts.btn_open);
			this.set_input_attributes();

			this.$link_clear.on("click", function () {
				me.$link.toggle(false);
				me.$input.val("").focus();
			});

			this.$input.on("focus", function () {
				if (!me.$input.val()) {
					me.$input.val("");
					// trigger dropdown immediately
					me.on_input();
				}

				me.show_link_and_clear_buttons();
			});
			this.$input.on("blur", function () {
				// if this disappears immediately, the user's click
				// does not register, hence timeout
				setTimeout(function () {
					me.$link.toggle(false);
					me.hide_link_and_clear_buttons();
				}, 250);
			});

			this.$input_area.on("mouseenter", () => {
				this.show_link_and_clear_buttons();
			});

			this.$input_area.on("mouseleave", () => {
				if (!this.$input.is(":focus")) {
					this.hide_link_and_clear_buttons();
				}
			});

			this.$input.attr("data-target", this.df.options);
			this.input = this.$input.get(0);
			this.has_input = true;
			this.translate_values = true;
			this.setup_buttons();
			this.setup_awesomeplete();
			this.bind_change_event();
		},
		// variant A: link.js's body, with `new Awesomplete(input, opts)` replaced by the shim over the
		// Combobox. The `item` option (it built each row's DOM) is gone: the Combobox draws the rows, and
		// LinkInput.vue's fui_options keeps item()'s rules (bold label, description when it differs, html)
		setup_awesomeplete() {
			let me = this;

			this.$input.cache = {};

			this.awesomplete = new FuiAwesomplete(this.link_view, {
				tabSelect: true,
				minChars: 0,
				maxItems: 99,
				autoFirst: true,
				list: [],
				replace: function (item) {
					// Override Awesomeplete replace function as it is used to set the input value
					// https://github.com/LeaVerou/awesomplete/issues/17104#issuecomment-359185403
					this.input.value = me.get_translated(item.label || item.value);
				},
				data: function (item) {
					return {
						label: me.get_translated(item.label || item.value),
						value: item.value,
					};
				},
				filter: function () {
					return true;
				},
				sort: function () {
					return 0;
				},
			});

			this.custom_awesomplete_filter && this.custom_awesomplete_filter(this.awesomplete);

			this._debounced_input_handler = frappe.utils.debounce(this.on_input.bind(this), 500);
			this.$input.on("input", this._debounced_input_handler);

			this.$input.on("blur", function () {
				if (document.activeElement === me.input) {
					if (me.autocomplete_open && me.$input.val()) {
						me.$input.one("focus", () => me.on_input());
					}
					return;
				}

				if (me.selected) {
					me.selected = false;
					return;
				}
				let value = me.get_input_value();
				let label = me.get_label_value();

				if (value !== (me.value || "")) {
					me.parse_validate_and_set_in_model(value, null, label);
				}
			});

			this.$input.on("awesomplete-open", () => {
				this.autocomplete_open = true;

				if (!me.get_label_value()) {
					// hide link arrow to doctype if none is set
					me.$link.toggle(false);
				}

				const dropdown = this.awesomplete.ul;
				const dropdownRect = dropdown.getBoundingClientRect();
				const viewportWidth = window.innerWidth;

				if (dropdownRect.right > viewportWidth) {
					dropdown.classList.add("awesomplete-align-right");
				} else {
					dropdown.classList.remove("awesomplete-align-right");
				}
			});

			this.$input.on("awesomplete-close", (e) => {
				this.autocomplete_open = false;

				if (!me.get_label_value()) {
					// hide link arrow to doctype if none is set
					me.$link.toggle(false);
				}
			});

			this.$input.on("awesomplete-select", function (e) {
				var o = e.originalEvent;
				var item = me.awesomplete.get_item(o.text.value);

				me.autocomplete_open = false;

				// prevent selection on tab/enter if input doesn't match
				const TABKEY = 9;
				const ENTERKEY = 13;
				const event = o.originalEvent;
				if (event && [TABKEY, ENTERKEY].includes(event.keyCode)) {
					const input = me.get_label_value().toLowerCase();
					if (!input && event.keyCode === TABKEY) {
						e.preventDefault();
						me.awesomplete.close();
						return false;
					} else if (input && !me.input_matches_item(input, item)) {
						e.preventDefault();

						// prevent browser default tab behavior (focus change)
						if (event.preventDefault) {
							event.preventDefault();
						}
						return false;
					}
				}

				if (item.value === "filter_description__link_option") {
					e.preventDefault();
					return false;
				}

				if (item.action) {
					item.value = "";
					item.label = "";
					item.action.apply(me);
				}

				// if remember_last_selected is checked in the doctype against the field,
				// then add this value
				// to defaults so you do not need to set it again
				// unless it is changed.
				if (me.df.remember_last_selected_value) {
					frappe.boot.user.last_selected_values[me.df.options] = item.value;
				}

				me.parse_validate_and_set_in_model(item.value, null, item.label);
			});

			this.$input.on("awesomplete-selectcomplete", function (e) {
				let o = e.originalEvent;
				if (cstr(o.text.value).indexOf("__link_option") !== -1) {
					me.$input.val("");
				}
			});
		},
