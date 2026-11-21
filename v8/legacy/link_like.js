// The part of frappe's link.js that matters here, unported: make_input() doesn't call super and builds
// its own input with jQuery inside the template's input area. (Awesomplete and the queries are left out.)
frappe.ui.form.ControlLink = class ControlLink extends frappe.ui.form.ControlData {
	static trigger_change_on_input_event = false;
	make_input() {
		var me = this;
		$(`<div class="link-field ui-front" style="position: relative;">
			<input type="text" class="input-with-feedback form-control">
			<span class="link-btn">
				<a class="btn-clear" style="display: inline-flex;" title="${__("Clear Link")}">
					${frappe.utils.icon("x", "xs")}
				</a>
				<a class="btn-open" style="display: inline-flex;" title="${__("Open Link")}">
					${frappe.utils.icon("arrow-right", "xs")}
				</a>
			</span>
		</div>`).prependTo(this.input_area);
		this.$input_area = $(this.input_area);
		this.$input = this.$input_area.find("input");
		this.$link = this.$input_area.find(".link-btn");
		this.$link_clear = this.$input_area.find(".btn-clear");
		this.set_input_attributes();
		this.$link_clear.on("click", function () {
			me.$link.toggle(false);
			me.$input.val("").focus();
		});
		this.$input.attr("data-target", this.df.options);
		this.input = this.$input.get(0);
		this.has_input = true;
		this.translate_values = true;
		this.bind_change_event();
	}
};
