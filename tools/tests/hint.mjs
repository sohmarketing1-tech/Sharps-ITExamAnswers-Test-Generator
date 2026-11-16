import { writeFileSync } from "node:fs";
const [wsUrl, B, out] = process.argv.slice(2);
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 300)); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (n) => { const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${out}/${n}.png`, Buffer.from(s.result.data, "base64")); };
ws.onopen = async () => {
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.clearBrowserCache");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const r = {};
  await send("Page.navigate", { url: B + "/questions/a-technician-is-about-to-begin-preventive-maintenance-on-a-company-pc-in-which-situation-3/" }); await sleep(3000);
  r.qpage = await ev("document.querySelector('#view h1')?.textContent + ' | ' + location.href");
  await shot("h-question");
  await ev("document.querySelector('[data-tab=study]').click()"); await sleep(1500);
  r.tabWorks = await ev("document.querySelector('#view').innerText.slice(0,60)");
  await send("Page.navigate", { url: B + "/exams/ccna-2-v7-modules-5-6-redundant-networks-exam-answers/" }); await sleep(3500);
  r.answers = await ev("document.querySelectorAll('.ans-hint').length + ' hints; ' + (document.querySelector('.ans-hint')?.textContent||'')");
  await shot("h-answers");
  // practice: answer one question, then see why
  await ev("location.hash = '#/practice/ccna-2-v7-modules-5-6-redundant-networks-exam-answers.json?n=10'"); await sleep(2500);
  await ev("document.querySelector('.option')?.click()"); await sleep(300);
  await ev("[...document.querySelectorAll('button')].find(b => /check/i.test(b.textContent))?.click()"); await sleep(600);
  r.quizWhy = await ev("document.querySelector('.hint-why')?.textContent || 'none'");
  await shot("h-quiz");
  console.log(JSON.stringify({ r, errors }, null, 1)); process.exit(0);
};
