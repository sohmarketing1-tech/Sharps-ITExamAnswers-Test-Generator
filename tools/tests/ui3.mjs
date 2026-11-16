// Packet Tracer 2 lab in a browser. Usage: node ui3.mjs <ws> <base> <outDir> <width> <height> <tag>
import { writeFileSync } from "node:fs";
const [wsUrl, B, outDir, W, H, tag] = process.argv.slice(2);
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 300)); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (n, full = true) => { const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full }); writeFileSync(`${outDir}/${tag}-${n}.png`, Buffer.from(r.result.data, "base64")); };
ws.onopen = async () => {
    await send("Page.enable"); await send("Runtime.enable"); await send("Network.clearBrowserCache");
    await send("Emulation.setDeviceMetricsOverride", { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 600 });
    const r = {};
    await send("Page.navigate", { url: B + "#/course/ccna2" }); await sleep(2500);
    await ev(`localStorage.clear()`); await send("Page.reload"); await sleep(2500);
    r.course = await ev(`[...document.querySelectorAll('.row-title')].map(e => e.textContent.trim()).filter(t => /Packet/.test(t)).join(' | ')`);
    await send("Page.navigate", { url: B + "#/packet-tracer/lab/ccna2-routes" }); await sleep(3000);
    r.title = await ev(`document.querySelector('.pt-wtitle')?.textContent`);
    await shot("map", false);
    // open activity doc
    await ev(`document.querySelector('#act-open')?.click()`); await sleep(400);
    await shot("doc", false);
    r.doc = await ev(`document.querySelector('.act-doc')?.innerText.slice(0, 900)`);
    await ev(`document.querySelector('#act-min')?.click()`); await sleep(300);
    // open R1 CLI and type a few commands
    await ev(`document.querySelector('[data-dev="R1"]').dispatchEvent(new MouseEvent('click', {bubbles:true}))`); await sleep(600);
    r.tabs = await ev(`[...document.querySelectorAll('#pt-win button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,12).join(',')`);
    await ev(`[...document.querySelectorAll('#pt-win button')].find(b=>b.textContent.trim()==='CLI')?.click()`); await sleep(400);
    const typeLine = async (t) => { await ev(`(() => { const i = document.querySelector('#pt-win input.cli-in, #pt-win .cli input, #pt-win input[type=text]'); if (!i) return 'noinput'; i.value = ${JSON.stringify(t)}; i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); return 'ok'; })()`); await sleep(120); };
    for (const t of ["", "en", "conf t", "int s0/1/0", "clock rate 128000", "no shut", "end", "show ip int brief"]) await typeLine(t);
    r.cli = await ev(`document.querySelector('#pt-win')?.innerText.slice(-900)`);
    await shot("cli", false);
    r.wide = await ev(`document.documentElement.scrollWidth > innerWidth`);
    console.log(JSON.stringify({ r, errors }, null, 1)); process.exit(0);
};
