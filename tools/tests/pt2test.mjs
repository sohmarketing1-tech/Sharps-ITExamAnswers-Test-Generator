// Solve Packet Tracer 2 in the simulator for many versions; check score, pings, the floating route, and PT1 still 48/48.
import { readFileSync } from "node:fs";
const src = readFileSync("/Users/jonathansharp/CascadeProjects/quiz-scraper/static/beta/ptlab.js", "utf8");
globalThis.window = {}; globalThis.document = {};
new Function(src)();
const X = window.AnswritPtLab._internal;
const fails = []; let n = 0;
const ok = (c, m) => { n++; if (!c) fails.push(m); };

function app(lab) {
    const a = { lab, st: X.freshState(lab), sess: {} };
    Object.keys(lab.devices).forEach((k) => { a.sess[k] = X.Session(); });
    return a;
}
function type(a, id, text) {
    const out = [];
    X.submit(a, id, ""); // connect
    for (const line of text.split("\n")) {
        const before = a.sess[id].out.length;
        X.submit(a, id, line.trim());
        out.push(...a.sess[id].out.slice(before));
    }
    return out;
}
const score = (a) => { const r = a.lab.checks().map((c) => ({ l: c.label, ok: !!c.test(a.st, a.lab) })); return { pct: Math.round(r.filter((x) => x.ok).length / r.length * 100), bad: r.filter((x) => !x.ok).map((x) => x.l), total: r.length }; };

function solveRoutes(ver) {
    const lab = X.makeRouteLab(ver), a = app(lab), F = lab.facts, P = lab.P;
    ok(score(a).pct === 0, `v${ver} not 0% at start: ${score(a).pct}`);
    // pings fail before anything
    ok(!X.ping(lab, a.st, "PC0", F.srvIp, 4).ok, `v${ver} ping works at start`);
    for (const [title, code] of lab.answer.help) {
        const id = title.startsWith(F.R1) ? "R1" : "R2";
        const out = type(a, id, code);
        const errs = out.filter((l) => !/Default route without gateway/.test(l) && /^%(?!LINK|LINEPROTO|SYS)|Invalid|Incomplete|Ambiguous|Bad mask|overlaps|Unknown/.test(l));
        ok(!errs.length, `v${ver} ${id} errors: ${errs.join(" | ")}`);
    }
    // hosts from the plan
    const lanMask = F.lanMask;
    ["PC0", "PC1", "PC2"].forEach((id, k) => Object.assign(a.st.devs[id].cfg, { ip: lab.answer.plan.find((r) => r[0].startsWith(id))[1], mask: lanMask, gw: F.lanGw, dns: F.srvIp }));
    ["L0", "L1", "L2"].forEach((id, k) => {
        const row = lab.answer.plan.find((r) => r[0].startsWith(`Laptop${k}`));
        const addr = row[3].split("/")[0];
        Object.assign(a.st.devs[id].cfg, { v6: X.v6(addr), v6len: 64, v6gw: X.v6("fe80::1"), v6dns: X.v6(F.srv6 ? X.v6short ? F.srv6 : F.srv6 : "") });
        a.st.devs[id].cfg.v6dns = F.srv6;
    });
    const s = score(a);
    ok(s.pct === 100, `v${ver} score ${s.pct}% missing: ${s.bad.join("; ")}`);
    // pings
    for (const id of ["PC0", "PC1", "PC2"]) ok(X.ping(lab, a.st, id, F.srvIp, 4).ok, `v${ver} ${id} can't ping server`);
    for (const id of ["L0", "L1", "L2"]) ok(X.ping(lab, a.st, id, a.st.devs.SV.cfg.v6, 6).ok, `v${ver} ${id} can't ping server v6`);
    ok(X.ping(lab, a.st, "PC0", a.st.devs.L0.cfg.v6, 6).ok === false, `v${ver} PC0 has no v6 yet pinged`);
    // router outputs
    const o1 = type(a, "R1", "show ip route\nshow ipv6 route\nshow run\nshow ip int brief").join("\n");
    ok(/S\*\s+0\.0\.0\.0\/0 \[1\/0\] is directly connected, Serial/.test(o1), `v${ver} show ip route lacks default: ${o1.slice(0, 600)}`);
    ok(!/\[10\/0\]/.test(o1.split("show ipv6 route")[0] || o1), `v${ver} floating shown while main is up`);
    ok(/clock rate 128000/.test(o1) && / 10$/m.test(o1), `v${ver} show run lacks clock/floating`);
    // floating: shut the main cable on R1 -> still works over the backup
    type(a, "R1", `conf t\ninterface ${F.main}\nshutdown\nend`);
    ok(X.ping(lab, a.st, "PC1", F.srvIp, 4).ok, `v${ver} backup v4 doesn't work`);
    ok(X.ping(lab, a.st, "L1", a.st.devs.SV.cfg.v6, 6).ok, `v${ver} backup v6 doesn't work`);
    const o2 = type(a, "R1", "show ip route").join("\n");
    ok(/\[10\/0\]/.test(o2), `v${ver} floating not installed after main down`);
    type(a, "R1", `conf t\ninterface ${F.main}\nno shutdown\nend`);
    // no clock rate -> link to R2 down -> pings fail
    type(a, "R1", `conf t\ninterface ${lab.P.midPort}\nno clock rate\nend`);
    ok(!X.ping(lab, a.st, "PC0", F.srvIp, 4).ok, `v${ver} ping works without clock rate`);
    type(a, "R1", `conf t\ninterface ${lab.P.midPort}\nclock rate 128000\nend`);
    ok(X.ping(lab, a.st, "PC0", F.srvIp, 4).ok, `v${ver} ping back after clock`);
    // R2 without ipv6 unicast-routing -> v6 fails
    type(a, "R2", "conf t\nno ipv6 unicast-routing\nend");
    ok(!X.ping(lab, a.st, "L0", a.st.devs.SV.cfg.v6, 6).ok, `v${ver} v6 works without unicast-routing`);
    // router ping
    type(a, "R2", "conf t\nipv6 unicast-routing\nend");
    const rp = type(a, "R2", `ping ${F.r1Mid}`).join("\n");
    ok(/Success rate is [1-9]/.test(rp), `v${ver} R2 can't ping R1: ${rp}`);
    const rs = type(a, "R2", `ping ${F.srvIp}`).join("\n");
    ok(/Success rate is 0/.test(rs), `v${ver} R2 reached server though ISP has no route back`);
    const pr = type(a, "R1", `ping ${F.srvIp}`).join("\n");
    ok(/Success rate is [1-9]/.test(pr), `v${ver} R1 can't ping server: ${pr}`);
    // ip route in two-word form + no form
    const t2 = type(a, "R2", `conf t\nip route 10.99.0.0 255.255.0.0 serial ${lab.P.r2Ser.replace("Serial", "")}\nno ip route 10.99.0.0 255.255.0.0 serial ${lab.P.r2Ser.replace("Serial", "")}\nend`);
    ok(!t2.some((l) => /Invalid|No matching/.test(l)), `v${ver} two-word route: ${t2.join("|")}`);
    // clock rate on DCE only
    const t3 = type(a, "R2", `conf t\ninterface ${lab.P.r2Ser}\nclock rate 128000\nend`).join("\n");
    ok(/only to DCE/.test(t3), `v${ver} clock rate accepted on DTE`);
    return lab;
}
const seen = new Set();
for (let v = 1; v <= 60; v++) {
    const lab = solveRoutes(v);
    seen.add(lab.checks().length);
    // class values must never appear
    const txt = JSON.stringify([lab.P, lab.notes, lab.reqs]);
    ok(!/COKE|PEPSI|220\.80\.90|150\.50\.50|192\.168\.10\.|2000:13ab|1990:1234|2010:abcd|acad:db8:c|18\.0\.0\./i.test(txt), `v${v} uses a class value`);
}
for (const v of [7777, 1234, 9999]) solveRoutes(v);
// PT1 regression: answer commands still score 48/48
{
    const lab = X.makeVlanLab(1), a = app(lab);
    for (const [, code] of lab.answer.help) {
        const title = lab.answer.help.find((h) => h[1] === code)[0];
        const id = Object.keys(lab.devices).find((k) => title.startsWith(lab.devices[k].label));
        type(a, id, code);
    }
    for (const row of lab.answer.plan) {
        const m = /^(PC0|PC1|Laptop0|Laptop1)/.exec(row[0]);
        if (!m) continue;
        const id = { PC0: "PC0", PC1: "PC1", Laptop0: "L0", Laptop1: "L1" }[m[1]];
        const gw = /gateway (\S+),/.exec(row[3])[1], dns = /DNS (\S+)/.exec(row[3])[1];
        Object.assign(a.st.devs[id].cfg, { ip: row[1], mask: row[2], gw, dns });
    }
    const sv = lab.answer.plan[lab.answer.plan.length - 1];
    Object.assign(a.st.devs.SV.cfg, { ip: sv[1], mask: sv[2], gw: /gateway (\S+);/.exec(sv[3])[1], v6: X.v6(/IPv6 (\S+)\//.exec(sv[3])[1]), v6len: 64 });
    const s = score(a);
    ok(s.pct === 100, `PT1 now ${s.pct}% missing ${s.bad.join("; ")}`);
    ok(X.ping(lab, a.st, "PC0", a.st.devs.PC1.cfg.ip, 4).ok, "PT1 PC0->PC1 ping broke");
}
console.log(`${n} checks, ${fails.length} failed; item counts ${[...seen]}`);
fails.slice(0, 20).forEach((f) => console.log(" -", f.slice(0, 700)));
