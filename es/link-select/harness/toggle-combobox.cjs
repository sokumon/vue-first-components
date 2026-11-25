// node toggle-combobox.cjs 0|1 : flips System Settings.enable_combobox_link_field on v5.localhost through the
// document API (so on_update writes the default the desk reads). Used only for the harness sensitivity check.
const { request } = require("playwright");
(async () => {
	const api = await request.newContext({ baseURL: "http://v5.localhost:8000" });
	await api.post("/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
	const r = await api.put("/api/resource/System Settings/System Settings", { data: { enable_combobox_link_field: +process.argv[2] } });
	console.log(r.status(), (await r.json()).data?.enable_combobox_link_field);
	await api.dispose();
})();
