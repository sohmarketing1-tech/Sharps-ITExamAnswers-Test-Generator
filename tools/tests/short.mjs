import { readFileSync } from "node:fs";
globalThis.window = {}; new Function(readFileSync("/Users/jonathansharp/CascadeProjects/quiz-scraper/static/beta/ptlab.js", "utf8"))();
const X = window.AnswritPtLab._internal;
const lab = X.makeRouteLab(1), F = lab.facts;
const a = { lab, st: X.freshState(lab), sess: {} }; Object.keys(lab.devices).forEach((k) => { a.sess[k] = X.Session(); });
const type = (id, t) => { X.submit(a, id, ""); const b = a.sess[id].out.length; t.split("\n").forEach((l) => X.submit(a, id, l)); return a.sess[id].out.slice(b).join("\n"); };
console.log(type("R1", `en
conf t
ipv6 unicast-routing
int s0/0/0
ip add 209.165.200.226 255.255.255.252
ipv6 add 2001:db8:feed:1::2/64
no shut
int s0/0/1
ip add 209.165.200.230 255.255.255.252
ipv6 add 2001:db8:feed:2::2/64
no shut
int s0/1/0
ip add 10.10.50.1 255.255.255.252
ipv6 add 2001:db8:beef:10::1/64
ipv6 add fe80::1 link-local
clock rate 128000
no shut
ip route 0.0.0.0 0.0.0.0 s0/0/0
ip route 0.0.0.0 0.0.0.0 s0/0/1 10
ipv6 route ::/0 s0/0/0
ipv6 route ::/0 s0/0/1 10
ip route 172.16.30.0 255.255.255.192 10.10.50.2
ipv6 route 2001:db8:cafe:5::/64 2001:db8:beef:10::2
end
wr
sh ip ro`));
console.log(lab.checks().filter((c) => c.dev === "R1").map((c) => `${c.test(a.st, lab) ? "OK " : "NO "}${c.label}`).join("\n"));
