// What mobile_nav.bundle.js would become: the es-* bundle (ESM, `vue` left bare) instead of
// lib/frappe-mobile-nav.js, then the unchanged tab-bar logic (tag names renamed only).
import { ES } from "../../dist/esm/es-ui.js";
window.ES = ES;
import "./mobile_nav.es.js";
