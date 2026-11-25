// Idempotent test data on erp.localhost: 3 customers, 3 stock items. Run once: node seed.cjs
const { request } = require("playwright");
(async () => {
	const base = "http://erp.localhost:8001";
	const api = await request.newContext({ baseURL: base });
	const r = await api.post("/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
	if (!r.ok()) throw new Error("login " + r.status());
	const ensure = async (doctype, name, doc) => {
		const g = await api.get(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
		if (g.ok()) return console.log("exists", doctype, name);
		const p = await api.post(`/api/resource/${encodeURIComponent(doctype)}`, { data: doc });
		console.log(p.ok() ? "created" : "FAILED " + p.status() + " " + (await p.text()).slice(0, 300), doctype, name);
	};
	for (const n of ["Alpha", "Beta", "Gamma"])
		await ensure("Customer", "TW Cust " + n, { customer_name: "TW Cust " + n, customer_group: "Commercial", territory: "India", customer_type: "Company" });
	for (const i of [1, 2, 3])
		await ensure("Item", "TW-ITEM-00" + i, { item_code: "TW-ITEM-00" + i, item_name: "Three Ways Widget " + i, item_group: "Products", stock_uom: "Nos", is_stock_item: 1 });
	await api.dispose();
})().catch((e) => { console.error(e); process.exit(1); });
