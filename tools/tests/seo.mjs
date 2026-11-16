import { writeFileSync } from "node:fs";
const [wsUrl, B, out] = process.argv.slice(2);
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 300)); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
ws.onopen = async () => {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const r = {};
  await send("Page.navigate", { url: B + "/exams/ccna-2-v7-modules-1-4-switching-concepts-vlans-and-intervlan-routing-exam-answers/" }); await sleep(3500);
  r.url = await ev("location.href"); r.h1 = await ev("document.querySelector('h1')?.textContent"); r.cards = await ev("document.querySelectorAll('.ans-card').length");
  const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${out}/seo-answers.png`, Buffer.from(s.result.data, "base64"));
  await send("Page.navigate", { url: B + "/" }); await sleep(3000);
  r.home = await ev("document.querySelector('#view')?.innerText.slice(0,120)");
  console.log(JSON.stringify({ r, errors }, null, 1)); process.exit(0);
};
