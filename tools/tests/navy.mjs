const [wsUrl, B] = process.argv.slice(2);
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 300)); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
ws.onopen = async () => {
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.clearBrowserCache");
  const out = {};
  for (const h of ["#/", "#/study", "#/drills", "#/course/ite", "#/course/ccna2", "#/packet-tracer", "#/packet-tracer/lab/final-practice-2020", "#/chat"]) {
    await send("Page.navigate", { url: B + h }); await sleep(1800);
    out[h] = await ev(`(() => { const t = document.body.innerText; const m = t.match(/navy|naval|a school|c school|shipmate|comms|sailor/i); return (m ? "FOUND: " + m[0] : "clean") + " | " + t.slice(0, 80).replace(/\\n/g, " "); })()`);
  }
  console.log(JSON.stringify({ out, errors }, null, 1)); process.exit(0);
};
