let portal = null;
// every Link's and Select's list teleports here: one .tw-fui element (the scoped frappe-ui CSS applies)
// at the end of <body>, stacked above Bootstrap modals (1050) so a control in a dialog shows its list
export function portal_target() {
	if (!portal || !portal.isConnected) {
		portal = document.createElement("div");
		portal.className = "tw-fui tw-fui-portal";
		portal.style.cssText = "position: relative; z-index: 1056;";
		// keeps focus in the input while a row is pressed, as Awesomplete's ul did (the pick is on click)
		portal.addEventListener("mousedown", (e) => e.preventDefault());
		document.body.appendChild(portal);
	}
	return portal;
}
