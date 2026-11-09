/* AnswrIT Packet Tracer labs: a phone-friendly simulation of a Packet Tracer activity.
 * window.AnswritPtLab = { list, mount(root, id, { alive }) -> cleanup }
 * Each lab (LABS below) gives the devices, cables, instructions, worksheet and the
 * assessment checks. The engine gives every router/switch a simplified Cisco IOS CLI
 * that keeps its configuration, PCs/servers an IP Configuration screen and a Command
 * Prompt, ping that follows the real addressing/routing, and Packet Tracer-style scoring.
 */
"use strict";
(function () {

// ─── Small helpers ──────────────────────────────────────────────────────────
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const $ = (sel, root) => root.querySelector(sel);
const $$ = (sel, root) => Array.from(root.querySelectorAll(sel));
const clone = (o) => JSON.parse(JSON.stringify(o));

// IPv4
function ip2n(s) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s ?? "").trim());
    if (!m) return null;
    const p = m.slice(1).map(Number);
    if (p.some((x) => x > 255)) return null;
    return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
function n2ip(n) { return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."); }
function normIp(s) { const n = ip2n(s); return n === null ? "" : n2ip(n); }
function maskBits(mask) {
    const n = ip2n(mask);
    if (n === null) return null;
    let bits = 0, zero = false;
    for (let i = 31; i >= 0; i--) {
        if ((n >>> i) & 1) { if (zero) return null; bits++; } else zero = true;
    }
    return bits;
}
function sameNet(a, b, mask) {
    const A = ip2n(a), B = ip2n(b), M = ip2n(mask);
    if (A === null || B === null || M === null) return false;
    return ((A & M) >>> 0) === ((B & M) >>> 0);
}
function netOf(ip, mask) { return n2ip((ip2n(ip) & ip2n(mask)) >>> 0); }
function usable(ip, mask) {
    const A = ip2n(ip), M = ip2n(mask);
    if (A === null || M === null || maskBits(mask) === null || maskBits(mask) > 30) return false;
    const net = (A & M) >>> 0, bc = (net | (~M >>> 0)) >>> 0;
    return A !== net && A !== bc;
}
function classfulMask(ip) {
    const n = ip2n(ip);
    if (n === null) return "";
    const first = n >>> 24;
    return first < 128 ? "255.0.0.0" : first < 192 ? "255.255.0.0" : first < 224 ? "255.255.255.0" : "";
}

// IPv6
function v6(s) {
    s = String(s ?? "").trim().toLowerCase();
    if (!s || !/^[0-9a-f:]+$/.test(s)) return null;
    const parts = s.split("::");
    if (parts.length > 2) return null;
    const head = parts[0] ? parts[0].split(":") : [];
    const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
    const fill = 8 - head.length - tail.length;
    if (parts.length === 1 ? head.length !== 8 : fill < 1) return null;
    const g = [...head, ...Array(parts.length === 2 ? fill : 0).fill("0"), ...tail];
    if (g.some((x) => !/^[0-9a-f]{1,4}$/.test(x))) return null;
    return g.map((x) => x.padStart(4, "0")).join(":");
}
function v6pfx(s) {
    const m = /^([0-9a-f:]+)\/(\d{1,3})$/i.exec(String(s ?? "").trim());
    if (!m) return null;
    const addr = v6(m[1]), len = Number(m[2]);
    return addr && len <= 128 ? { addr, len } : null;
}
function v6short(a) {
    const g = a.split(":").map((x) => x.replace(/^0+(?=.)/, ""));
    let best = -1, bl = 0;
    for (let i = 0; i < 8;) {
        if (g[i] === "0") {
            let j = i;
            while (j < 8 && g[j] === "0") j++;
            if (j - i > bl && j - i > 1) { best = i; bl = j - i; }
            i = j;
        } else i++;
    }
    const out = best < 0 ? g.join(":") : `${g.slice(0, best).join(":")}::${g.slice(best + bl).join(":")}`;
    return out.toUpperCase();
}
function samePfx(a, b, len) {
    const bits = (x) => x.split(":").map((h) => parseInt(h, 16).toString(2).padStart(16, "0")).join("");
    return bits(a).slice(0, len) === bits(b).slice(0, len);
}
const isLL = (a) => a.startsWith("fe8");

// Password display, like IOS
const XLAT = "dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87";
function type7(pw) {
    let out = "08";
    for (let i = 0; i < pw.length; i++) out += (pw.charCodeAt(i) ^ XLAT.charCodeAt((8 + i) % XLAT.length)).toString(16).toUpperCase().padStart(2, "0");
    return out;
}
function md5ish(pw) {
    const abc = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let h = 5381, out = "";
    for (let i = 0; i < 26; i++) {
        for (const ch of pw + i) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
        out += abc[h % 64];
    }
    return `$1$${out.slice(0, 4)}$${out.slice(4)}`;
}

// ─── The labs ───────────────────────────────────────────────────────────────
const SN3 = { net: "172.16.0.192", mask: "255.255.255.192" };
const SN5 = { net: "172.16.1.16", mask: "255.255.255.240" };
const PW_MIN = "% Password too short - must be at least %n characters. Password configuration failed";

function hostCheck(id, name, sn, gw, v6addr) {
    return [
        { dev: id, label: `${name}: IPv4 address in the right subnet`, test: (st) => {
            const c = st.devs[id].cfg;
            if (!usable(c.ip, sn.mask) || netOf(c.ip, sn.mask) !== sn.net) return false;
            return !Object.entries(st.devs).some(([other, d]) => other !== id && allIps(d).includes(normIp(c.ip)));
        } },
        { dev: id, label: `${name}: subnet mask`, test: (st) => st.devs[id].cfg.mask === sn.mask },
        { dev: id, label: `${name}: default gateway`, test: (st) => st.devs[id].cfg.gw === gw },
        { dev: id, label: `${name}: IPv6 address`, test: (st) => { const c = st.devs[id].cfg; return c.v6 === v6(v6addr) && c.v6len === 64; } },
        { dev: id, label: `${name}: IPv6 gateway (router link-local)`, test: (st) => st.devs[id].cfg.v6gw === v6("fe80::1") },
    ];
}
function allIps(d) {
    if (d.cfg.ifaces) return Object.values(d.cfg.ifaces).map((f) => f.ip).filter(Boolean);
    return d.cfg.ip ? [normIp(d.cfg.ip)] : [];
}

function routerChecks(cfgOf) {
    const R = (st) => cfgOf(st);
    const ifc = (st, n) => (R(st) && R(st).ifaces[n]) || {};
    const list = [
        ["Hostname is IT_Router", (c) => c.hostname === "IT_Router"],
        ["DNS lookup disabled", (c) => c.lookup === false],
        ["Enable secret is ccna1", (c) => c.enableSecret === "ccna1"],
        ["Console password is cisco", (c) => c.lines.con.pw === "cisco"],
        ["Console asks for the password (login)", (c) => c.lines.con.login === "login"],
        ["VTY password is cisco", (c) => c.lines.vty.pw === "cisco"],
        ["Passwords encrypted (service password-encryption)", (c) => c.spe === true],
        ["Banner: AUTHORIZED ACCESS ONLY!", (c) => (c.banner || "").includes("AUTHORIZED ACCESS ONLY!")],
        ["Minimum password length 10", (c) => c.minLen === 10],
        ["Login blocked 5 min after 3 failures in 60 s", (c) => !!c.block && c.block.for === 300 && c.block.attempts === 3 && c.block.within === 60],
        ["Console times out after 5 minutes", (c) => c.lines.con.timeout === "5 0"],
        ["VTY times out after 5 minutes", (c) => c.lines.vty.timeout === "5 0"],
        ["Domain name ITTN.navy", (c) => (c.domain || "").toLowerCase() === "ittn.navy"],
        ["User Administrator, privilege 15, secret CCNAIntroNet11!!", (c) => { const u = c.users.Administrator; return !!u && u.priv === 15 && u.type === "secret" && u.pw === "CCNAIntroNet11!!"; }],
        ["VTY accepts SSH only", (c) => c.lines.vty.transport === "ssh"],
        ["VTY uses the local user database (login local)", (c) => c.lines.vty.login === "local"],
        ["RSA key, 1024 bits", (c) => c.rsa === 1024],
        ["G0/0: IPv4 172.16.0.254 /26", (c) => c.ifaces["GigabitEthernet0/0"].ip === "172.16.0.254" && c.ifaces["GigabitEthernet0/0"].mask === "255.255.255.192"],
        ["G0/0: IPv6 2001:DB8:ACAD:1::1/64", (c) => c.ifaces["GigabitEthernet0/0"].v6.some((x) => x.addr === v6("2001:db8:acad:1::1") && x.len === 64)],
        ["G0/0: link-local FE80::1", (c) => c.ifaces["GigabitEthernet0/0"].ll === v6("fe80::1")],
        ["G0/0: description", (c) => !!c.ifaces["GigabitEthernet0/0"].desc],
        ["G0/0: turned on (no shutdown)", (c) => !c.ifaces["GigabitEthernet0/0"].shut],
        ["G0/1: IPv4 172.16.1.30 /28", (c) => c.ifaces["GigabitEthernet0/1"].ip === "172.16.1.30" && c.ifaces["GigabitEthernet0/1"].mask === "255.255.255.240"],
        ["G0/1: IPv6 2001:DB8:ACAD:2::1/64", (c) => c.ifaces["GigabitEthernet0/1"].v6.some((x) => x.addr === v6("2001:db8:acad:2::1") && x.len === 64)],
        ["G0/1: link-local FE80::1", (c) => c.ifaces["GigabitEthernet0/1"].ll === v6("fe80::1")],
        ["G0/1: description", (c) => !!c.ifaces["GigabitEthernet0/1"].desc],
        ["G0/1: turned on (no shutdown)", (c) => !c.ifaces["GigabitEthernet0/1"].shut],
        ["IPv6 routing on (ipv6 unicast-routing)", (c) => c.v6routing === true],
    ];
    void ifc;
    return list.map(([label, fn]) => ({ label, fn, test: (st) => { const c = R(st); return !!c && fn(c); } }));
}

function switchChecks(id, name, ip, mask, gw) {
    const c = (st) => st.devs[id].cfg;
    return [
        { dev: id, label: `${name}: hostname ${name}`, test: (st) => c(st).hostname === name },
        { dev: id, label: `${name}: VLAN 1 IPv4 ${ip}`, test: (st) => c(st).ifaces.Vlan1.ip === ip && c(st).ifaces.Vlan1.mask === mask },
        { dev: id, label: `${name}: VLAN 1 description`, test: (st) => !!c(st).ifaces.Vlan1.desc },
        { dev: id, label: `${name}: VLAN 1 turned on (no shutdown)`, test: (st) => !c(st).ifaces.Vlan1.shut },
        { dev: id, label: `${name}: default gateway ${gw}`, test: (st) => c(st).gw === gw },
        { dev: id, label: `${name}: console password and login`, test: (st) => !!c(st).lines.con.pw && c(st).lines.con.login === "login" },
        { dev: id, label: `${name}: VTY password and login`, test: (st) => !!c(st).lines.vty.pw && !!c(st).lines.vty.login },
    ];
}

const RC = routerChecks((st) => st.devs.R.cfg);
const RC_SAVED = routerChecks((st) => st.devs.R.startup ? JSON.parse(st.devs.R.startup) : null);

const LABS = {
    "final-practice-2020": {
        title: "PT Final Practice",
        sub: "Router, two switches, IPv4/IPv6, SSH and TFTP backup",
        course: "CCNA 1",
        devices: {
            H0: { kind: "pc", label: "Host 0", model: "PC-PT", x: 46, y: 46 },
            H1: { kind: "pc", label: "Host 1", model: "PC-PT", x: 128, y: 46 },
            ITA: { kind: "switch", label: "ITA", model: "2960-24TT", x: 86, y: 128 },
            R: { kind: "router", label: "Router0", model: "2911", x: 180, y: 178 },
            ITC: { kind: "switch", label: "ITC", model: "2960-24TT", x: 274, y: 128 },
            H2: { kind: "pc", label: "Host 2", model: "PC-PT", x: 234, y: 46 },
            SV: { kind: "server", label: "Server0", model: "Server-PT", x: 316, y: 46 },
        },
        links: [
            ["R", "GigabitEthernet0/0", "ITA", "GigabitEthernet0/1"],
            ["R", "GigabitEthernet0/1", "ITC", "GigabitEthernet0/1"],
            ["H0", "FastEthernet0", "ITA", "FastEthernet0/1"],
            ["H1", "FastEthernet0", "ITA", "FastEthernet0/2"],
            ["H2", "FastEthernet0", "ITC", "FastEthernet0/1"],
            ["SV", "FastEthernet0", "ITC", "FastEthernet0/2"],
        ],
        worksheet: {
            rows: [
                { sn: 0, label: "", net: "172.16.0.0", range: "172.16.0.1 - 172.16.0.62", bc: "172.16.0.63", mask: "255.255.255.192", given: "net" },
                { sn: 1, label: "", net: "172.16.0.64", range: "172.16.0.65 - 172.16.0.126", bc: "172.16.0.127", mask: "255.255.255.192" },
                { sn: 2, label: "", net: "172.16.0.128", range: "172.16.0.129 - 172.16.0.190", bc: "172.16.0.191", mask: "255.255.255.192" },
                { sn: 3, label: "IT A SCHOOL", net: "172.16.0.192", range: "172.16.0.193 - 172.16.0.254", bc: "172.16.0.255", mask: "255.255.255.192" },
                { sn: 4, label: "", net: "172.16.1.0", range: "172.16.1.1 - 172.16.1.14", bc: "172.16.1.15", mask: "255.255.255.240", split: true },
                { sn: 5, label: "IT C SCHOOL", net: "172.16.1.16", range: "172.16.1.17 - 172.16.1.30", bc: "172.16.1.31", mask: "255.255.255.240" },
                { sn: 6, label: "", net: "172.16.1.32", range: "172.16.1.33 - 172.16.1.46", bc: "172.16.1.47", mask: "255.255.255.240" },
            ],
            design: [
                ["Router G0/0 (LAN 1: IT A School)", "172.16.0.254", "255.255.255.192", "", "2001:DB8:ACAD:1::1/64"],
                ["Router G0/1 (LAN 2: IT C School)", "172.16.1.30", "255.255.255.240", "", "2001:DB8:ACAD:2::1/64"],
                ["Switch ITA, VLAN 1", "172.16.0.253", "255.255.255.192", "172.16.0.254", ""],
                ["Switch ITC, VLAN 1", "172.16.1.29", "255.255.255.240", "172.16.1.30", ""],
                ["Host 0", "172.16.0.193", "255.255.255.192", "172.16.0.254", "2001:DB8:ACAD:1::FE/64"],
                ["Host 1", "172.16.0.194", "255.255.255.192", "172.16.0.254", "2001:DB8:ACAD:1::FF/64"],
                ["Host 2", "172.16.1.17", "255.255.255.240", "172.16.1.30", "2001:DB8:ACAD:2::FE/64"],
                ["Server", "172.16.1.18", "255.255.255.240", "172.16.1.30", "2001:DB8:ACAD:2::FF/64"],
            ],
            designNote: "The hosts use the first usable addresses of their subnet (Host 1 and the Server take the next one). IPv6 default gateway on every host: FE80::1.",
        },
        instructions: `
            <h3>Step 1: Work out the IPv4 addressing</h3>
            <ul>
                <li>Subnet <strong>172.16.0.0/16</strong> so the first four subnets each have <strong>60</strong> host addresses, wasting as few as possible.</li>
                <li>Starting with the fifth subnet, subnet again so the next four subnets each have <strong>12</strong> host addresses.</li>
                <li>Fill in the table on the <em>Addressing</em> tab. SN 3 is <strong>IT A School</strong>, SN 5 is <strong>IT C School</strong>.</li>
            </ul>
            <h3>Step 2: Plan the addresses</h3>
            <ul>
                <li>The first three subnets aren't used in this lab.</li>
                <li><strong>LAN 1, IT A School (SN 3)</strong> is on the router's <strong>G0/0</strong>. G0/0 gets the <strong>last usable</strong> address.</li>
                <li><strong>LAN 2, IT C School (SN 5)</strong> is on the router's <strong>G0/1</strong>. G0/1 gets the <strong>last usable</strong> address.</li>
                <li>Each switch's VLAN 1 gets the <strong>next to last</strong> usable address. Hosts get the <strong>first usable</strong> addresses.</li>
                <li>IPv6: G0/0 <code>2001:DB8:ACAD:1::1/64</code>, G0/1 <code>2001:DB8:ACAD:2::1/64</code>, Host 0 <code>…:1::FE/64</code>, Host 1 <code>…:1::FF/64</code>, Host 2 <code>…:2::FE/64</code>, Server <code>…:2::FF/64</code>.</li>
            </ul>
            <h3>Step 3: Configure the router</h3>
            <p><strong>1. Basic settings</strong></p>
            <ol type="a">
                <li>Name the router <strong>IT_Router</strong>.</li>
                <li>Turn off DNS lookup.</li>
                <li>Privileged EXEC encrypted password: <strong>ccna1</strong>.</li>
                <li>Console and VTY password: <strong>cisco</strong>.</li>
                <li>Encrypt all passwords so they can't be read in plain text.</li>
                <li>Banner: <strong>AUTHORIZED ACCESS ONLY!</strong></li>
                <li>Set up and turn on the interfaces from the addressing table, with a description on each.</li>
                <li>Save the configuration to NVRAM.</li>
            </ol>
            <p><strong>2. Security</strong></p>
            <ul>
                <li>Passwords must be at least <strong>10</strong> characters.</li>
                <li>Block logins for 5 minutes after 3 failed attempts within 60 seconds.</li>
                <li>Console and VTY lines log out after 5 idle minutes.</li>
                <li>SSH: domain name <strong>ITTN.navy</strong>; local user <strong>Administrator</strong> with password <strong>CCNAIntroNet11!!</strong> and administrator (level 15) access.</li>
                <li>VTY lines: SSH only (no Telnet), using the local user database.</li>
                <li>Generate an RSA key with a <strong>1024</strong>-bit modulus.</li>
            </ul>
            <p class="lab-tip">Watch the order: once the minimum length is 10, IOS refuses the short passwords (<code>cisco</code>, <code>ccna1</code>). Set those first.</p>
            <p><strong>3. Interfaces</strong></p>
            <ul>
                <li>IPv4 and IPv6 addresses from the table, a description, and turn each one on.</li>
                <li>Set the link-local address of both interfaces to <strong>FE80::1</strong>.</li>
                <li>Turn on IPv6 routing.</li>
            </ul>
            <h3>Step 4: Switches (ITA and ITC)</h3>
            <ul>
                <li>Name them <strong>ITA</strong> and <strong>ITC</strong>.</li>
                <li>Give VLAN 1 its address and a description, and turn it on.</li>
                <li>Set the default gateway, and set up console and VTY access.</li>
            </ul>
            <h3>Step 5: Hosts</h3>
            <ul>
                <li>Give every PC and the server its IPv4 and IPv6 addresses (Desktop → IP Configuration).</li>
                <li>The IPv6 gateway is the router's link-local address, <strong>FE80::1</strong>.</li>
                <li>Check that all hosts can ping each other over IPv4.</li>
            </ul>
            <h3>Step 6: Back up the router to TFTP</h3>
            <ul><li>Copy the router's running configuration to the TFTP server (Server0) using the default file name.</li></ul>
            <p class="lab-tip">When you're done and all hosts can ping each other, open <em>Results</em>.</p>`,
        help: [
            ["Router basics", `enable
configure terminal
hostname IT_Router
no ip domain-lookup
enable secret ccna1
line console 0
 password cisco
 login
 exec-timeout 5 0
 exit
line vty 0 4
 password cisco
 exec-timeout 5 0
 exit
service password-encryption
banner motd #AUTHORIZED ACCESS ONLY!#`],
            ["Router security and SSH", `security passwords min-length 10
login block-for 300 attempts 3 within 60
ip domain-name ITTN.navy
username Administrator privilege 15 secret CCNAIntroNet11!!
crypto key generate rsa
 (answer 1024)
line vty 0 4
 transport input ssh
 login local
 exit`],
            ["Router interfaces", `interface g0/0
 description LAN 1 IT A School
 ip address 172.16.0.254 255.255.255.192
 ipv6 address 2001:db8:acad:1::1/64
 ipv6 address fe80::1 link-local
 no shutdown
interface g0/1
 description LAN 2 IT C School
 ip address 172.16.1.30 255.255.255.240
 ipv6 address 2001:db8:acad:2::1/64
 ipv6 address fe80::1 link-local
 no shutdown
 exit
ipv6 unicast-routing
end
copy running-config startup-config`],
            ["Switch ITA (ITC is the same with its own values)", `enable
configure terminal
hostname ITA
interface vlan 1
 description ITA management
 ip address 172.16.0.253 255.255.255.192
 no shutdown
 exit
ip default-gateway 172.16.0.254
line console 0
 password cisco
 login
line vty 0 15
 password cisco
 login
end`],
            ["TFTP backup (on the router)", `copy running-config tftp
 Address or name of remote host? 172.16.1.18
 Destination filename? (press Enter for the default)`],
        ],
        // Steps shown on the Tasks screen. Checks point at a step by index.
        steps: [
            { title: "Subnet the network", dev: null, sheet: true, brief: "Split 172.16.0.0/16: four subnets with 60 hosts, then four with 12. SN 3 is IT A School, SN 5 is IT C School. Router interfaces get the last usable address, switches the next to last, hosts the first." },
            { title: "Router basics", dev: "R", help: 0, brief: "Name it IT_Router, turn off DNS lookup, enable secret ccna1, console and VTY password cisco, encrypt passwords, banner AUTHORIZED ACCESS ONLY!" },
            { title: "Router security & SSH", dev: "R", help: 1, brief: "Passwords at least 10 characters, block logins 5 min after 3 failures in 60 s, 5-minute idle timeout, domain ITTN.navy, user Administrator (level 15, secret CCNAIntroNet11!!), SSH only with local login, 1024-bit RSA key.", tip: "Set the short passwords (cisco, ccna1) before the 10-character minimum, or IOS will refuse them." },
            { title: "Router interfaces", dev: "R", help: 2, brief: "IPv4 and IPv6 on G0/0 and G0/1 with a description each, link-local FE80::1, turn them on, and turn on IPv6 routing." },
            { title: "Switches ITA & ITC", dev: "ITA", help: 3, brief: "Name them, give VLAN 1 its address and a description and turn it on, set the default gateway, and set console and VTY passwords." },
            { title: "Hosts", dev: "H0", brief: "Give every PC and the server its IPv4 and IPv6 addresses. IPv6 gateway is FE80::1. Make sure everyone can ping everyone." },
            { title: "Save & back up", dev: "R", help: 4, brief: "Save the router's configuration to NVRAM, then copy it to the TFTP server (Server0) with the default file name." },
        ],
        checks: () => [
            ...RC.map((c, i) => ({ ...c, dev: "R", step: i < 8 ? 1 : i < 17 ? 2 : 3, label: `Router: ${c.label}` })),
            { dev: "R", step: 6, label: "Router: configuration saved to NVRAM (startup-config)", test: (st) => !!st.devs.R.startup && RC_SAVED.every((c) => c.test(st)) },
            { dev: "R", step: 6, label: "Router: config backed up to the TFTP server (IT_Router-confg)", test: (st) => (st.devs.SV.cfg.files || []).some((f) => f.name === "IT_Router-confg") },
            ...switchChecks("ITA", "ITA", "172.16.0.253", "255.255.255.192", "172.16.0.254").map((c) => ({ ...c, step: 4 })),
            ...switchChecks("ITC", "ITC", "172.16.1.29", "255.255.255.240", "172.16.1.30").map((c) => ({ ...c, step: 4 })),
            ...hostCheck("H0", "Host 0", SN3, "172.16.0.254", "2001:db8:acad:1::fe").map((c) => ({ ...c, step: 5 })),
            ...hostCheck("H1", "Host 1", SN3, "172.16.0.254", "2001:db8:acad:1::ff").map((c) => ({ ...c, step: 5 })),
            ...hostCheck("H2", "Host 2", SN5, "172.16.1.30", "2001:db8:acad:2::fe").map((c) => ({ ...c, step: 5 })),
            ...hostCheck("SV", "Server", SN5, "172.16.1.30", "2001:db8:acad:2::ff").map((c) => ({ ...c, step: 5 })),
            { dev: "H0", step: 5, label: "All hosts can ping each other over IPv4", test: (st, lab) => {
                const hosts = ["H0", "H1", "H2", "SV"];
                return hosts.every((a) => hosts.every((b) => a === b || ping(lab, st, a, st.devs[b].cfg.ip, 4).ok));
            } },
        ],
    },
};

// ─── CCNA 2 skills lab: VLANs, trunks, router-on-a-stick, SSH ───────────────
// Version 1 is the class's practice file (packet-tracer-ccna2-1.pka, verified 48/48 in Packet
// Tracer, see ptlabs/ccna2-1-answer-key.md). Every other version keeps the same steps and the same
// 48 graded items but changes names, VLANs, networks, ports and passwords, like the real exam.
// House rules (not written in the lab): the router takes the LAST usable address of each network,
// "1st/2nd/3rd" labels mean the first/second/third usable address, the server's IPv6 address is ::1.
function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
const NAME_SETS = [
    ["ZEUS", "HERA", "ATHENA", "APOLLO"], ["DENALI", "SHASTA", "RAINIER", "HOOD"], ["MERCURY", "VENUS", "EARTH", "MARS"],
    ["FALCON", "EAGLE", "HAWK", "OSPREY"], ["TEXAS", "OHIO", "MAINE", "IDAHO"], ["OAK", "PINE", "CEDAR", "MAPLE"],
    ["ORION", "VEGA", "SIRIUS", "RIGEL"], ["TITAN", "ATLAS", "HYPERION", "RHEA"], ["COBALT", "COPPER", "NICKEL", "ZINC"],
];
const VLAN_NAME_SETS = [["SALES", "HR"], ["FACULTY", "STUDENTS"], ["RED", "BLUE"], ["ADMIN", "GUEST"], ["LAB", "OFFICE"], ["NORTH", "SOUTH"], ["TOM", "JERRY"], ["ALPHA", "BRAVO"], ["ENGINEERING", "ACCOUNTING"]];
const NATIVE_NAMES = ["Native/Management", "Native/Management", "Native", "Management", "NATIVE_MGMT"];
const USER_VLANS = [10, 20, 30, 40, 50, 60, 70, 75, 80, 90, 110, 120, 150, 200, 210, 300];
const NATIVE_VLANS = [99, 100, 250, 333, 500, 777, 999];
const DOMAINS = ["cisco.com", "netacad.com", "ccna.net", "ccna2.lab", "netlab.com"];
const SSH_USERS = [["admin", "cisco"], ["admin", "class"], ["netadmin", "cisco123"], ["sshuser", "ccna"]];
const BANNERS = ["Keep Out!", "Authorized Access Only!", "No Trespassing!", "Authorized Users Only!", "Stay Out!"];
const ORD = ["1st", "2nd", "3rd"];

function vlanLabParams(ver) {
    if (ver === 1) {
        return {
            names: ["ARIEL", "SNOW", "BELLE", "WHITE"], server: "DNS SVR",
            A: 50, B: 75, N: 500, nameA: "SCOOBY", nameB: "SCRAPPY", nameN: "Native/Management",
            netA: "192.168.10.0", pA: 27, netB: "192.168.10.32", pB: 27, netN: "192.168.10.64", pN: 29,
            link: "10.40.50.0", v6show: "2021:0200:000F:A::", v6: "2021:200:f:a::", rid: "9", ll: "FE80::1",
            swOrd: [0, 1, 2], hostOrd1: 0, hostOrd3: 1,
            routerTrunk: "GigabitEthernet0/0/0", routerSrv: "GigabitEthernet0/0/1", centerUp: "GigabitEthernet0/1",
            t1: 9, t2: 10, acc1: [1, 2], acc3: [1, 2], pc1First: true, pc3First: true,
            domain: "cisco.com", user: "admin", pw: "cisco", banner: "Keep Out!",
        };
    }
    const r = rng(ver * 7919 + 13);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    const names = pick(NAME_SETS);
    const [A, B] = shuffle(USER_VLANS).slice(0, 2).sort((x, y) => x - y);
    const N = pick(NATIVE_VLANS.filter((v) => v !== A && v !== B));
    const [nameA, nameB] = pick(VLAN_NAME_SETS);
    const pA = pick([26, 27, 27, 28]), pN = pick([28, 29, 29]);
    const blk = 2 ** (32 - pA), mblk = 2 ** (32 - pN);
    const starts = []; for (let s = 0; s + 2 * blk + mblk <= 256; s += blk) starts.push(s);
    const start = pick(starts);
    const fam = r();
    const pre = fam < 0.5 ? `192.168.${1 + Math.floor(r() * 254)}` : fam < 0.8 ? `172.${16 + Math.floor(r() * 16)}.${Math.floor(r() * 256)}` : `10.${1 + Math.floor(r() * 254)}.${Math.floor(r() * 256)}`;
    const netA = `${pre}.${start}`, netB = `${pre}.${start + blk}`, netN = `${pre}.${start + 2 * blk}`;
    const link = r() < 0.6 ? `10.${1 + Math.floor(r() * 254)}.${Math.floor(r() * 256)}.${4 * Math.floor(r() * 63)}` : `172.${16 + Math.floor(r() * 16)}.${Math.floor(r() * 256)}.${4 * Math.floor(r() * 63)}`;
    const hex = (n) => Math.floor(r() * 16 ** n).toString(16).toUpperCase().padStart(n, "0");
    const g = [pick(["2001", "2021", "2002", "2010", "2019", "2026"]), `0${hex(3)}`, `00${hex(2)}`, pick("123456789ABCDEF".split(""))];
    const v6show = `${g.join(":")}::`;
    const rid = pick(["2", "3", "5", "7", "9", "a", "b", "c", "e", "f"]);
    const ll = pick(["FE80::1", "FE80::1", `FE80::${rid.toUpperCase()}`, "FE80::A"]);
    const tPair = pick([[9, 10], [11, 12], [21, 22], [23, 24], [7, 8]]);
    const accPairs = [[1, 2], [3, 4], [5, 6], [13, 14], [17, 18], [19, 20]].filter((p) => !p.includes(tPair[0]) && !p.includes(tPair[1]));
    const [user, pw] = pick(SSH_USERS);
    const srvFirst = r() < 0.5;
    return {
        names: names, server: pick(["DNS SVR", "DNS SVR", "DNS-SERVER", "SRV1"]),
        A, B, N, nameA, nameB, nameN: pick(NATIVE_NAMES),
        netA, pA, netB, pB: pA, netN, pN,
        link, v6show, v6: v6show.toLowerCase(), rid, ll,
        swOrd: shuffle([0, 1, 2]), hostOrd1: r() < 0.7 ? 0 : 1, hostOrd3: 0,
        routerTrunk: srvFirst ? "GigabitEthernet0/0/1" : "GigabitEthernet0/0/0", routerSrv: srvFirst ? "GigabitEthernet0/0/0" : pick(["GigabitEthernet0/0/1", "GigabitEthernet0/0/2"]),
        centerUp: pick(["GigabitEthernet0/1", "GigabitEthernet0/2"]),
        t1: tPair[0], t2: tPair[1], acc1: pick(accPairs), acc3: pick(accPairs), pc1First: r() < 0.6, pc3First: r() < 0.4,
        domain: pick(DOMAINS), user, pw, banner: pick(BANNERS),
    };
}

function makeVlanLab(ver) {
    const P = vlanLabParams(ver);
    if (ver !== 1) P.hostOrd3 = 1 - P.hostOrd1; // the two hosts in a VLAN get 1st and 2nd
    const [RN, S1, SC, S3] = P.names;
    const n2 = (s) => ip2n(s);
    const add = (ip, k) => n2ip((n2(ip) + k) >>> 0);
    const maskOf = (p) => n2ip(p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0);
    const last = (net, p) => add(net, 2 ** (32 - p) - 2);
    const mA = maskOf(P.pA), mB = maskOf(P.pB), mN = maskOf(P.pN), mL = "255.255.255.252";
    const gwA = last(P.netA, P.pA), gwB = last(P.netB, P.pB), gwN = last(P.netN, P.pN);
    const srvIp = add(P.link, 1), rLink = add(P.link, 2);
    const v6pre = P.v6.replace(/::$/, "");
    const rV6 = v6(`${v6pre}::${P.rid}`), srvV6 = v6(`${v6pre}::1`), llV6 = v6(P.ll);
    // switch ordinal k -> management address (k = 0,1,2)
    const swIp = (k) => add(P.netN, k + 1);
    const ordOf = { S1: P.swOrd[0], SC: P.swOrd[1], S3: P.swOrd[2] };
    // Hosts: on S1, PC0 (VLAN A) and Laptop0 (VLAN B) share one ordinal; on S3 the other one.
    const o1 = P.hostOrd1, o3 = P.hostOrd3;
    const hosts = {
        PC0: { vlan: "A", sw: "S1", ord: o1 }, L0: { vlan: "B", sw: "S1", ord: o1 },
        L1: { vlan: "B", sw: "S3", ord: o3 }, PC1: { vlan: "A", sw: "S3", ord: o3 },
    };
    const hostIp = (h) => add(h.vlan === "A" ? P.netA : P.netB, h.ord + 1);
    const fa = (n) => `FastEthernet0/${n}`;
    const [pc0Port, l0Port] = P.pc1First ? P.acc1 : [P.acc1[1], P.acc1[0]];
    const [pc1Port, l1Port] = P.pc3First ? P.acc3 : [P.acc3[1], P.acc3[0]];
    const devices = {
        PC0: { kind: "pc", label: "PC0", model: "PC-PT", x: 142, y: 112 },
        L0: { kind: "pc", art: "laptop", label: "Laptop0", model: "Laptop-PT", x: 104, y: 214 },
        S1: { kind: "switch", label: S1, model: "2960-24TT", x: 292, y: 174 },
        SC: { kind: "switch", label: SC, model: "2960-24TT", x: 434, y: 246 },
        R: { kind: "router", label: RN, model: "4331", modelLabel: "ISR4331", x: 613, y: 246 },
        SV: { kind: "server", label: P.server, model: "Server-PT", x: 608, y: 62 },
        S3: { kind: "switch", label: S3, model: "2960-24TT", x: 292, y: 340 },
        L1: { kind: "pc", art: "laptop", label: "Laptop1", model: "Laptop-PT", x: 84, y: 334 },
        PC1: { kind: "pc", label: "PC1", model: "PC-PT", x: 128, y: 420 },
    };
    const links = [
        ["PC0", "FastEthernet0", "S1", fa(pc0Port)],
        ["L0", "FastEthernet0", "S1", fa(l0Port)],
        ["S1", fa(P.t1), "SC", fa(P.t1), "dash"],
        ["S3", fa(P.t2), "SC", fa(P.t2), "dash"],
        ["L1", "FastEthernet0", "S3", fa(l1Port)],
        ["PC1", "FastEthernet0", "S3", fa(pc1Port)],
        ["SC", P.centerUp, "R", P.routerTrunk],
        ["R", P.routerSrv, "SV", "FastEthernet0"],
    ];
    const swOrdLabel = (k) => ORD[k].toUpperCase();
    const reqs = [
        "Requirements:",
        "- Hostname on router",
        "- encrypted enable/con/vty passwords on router",
        `- motd "${P.banner}" on router`,
        "- Configure VLANs and Inter-VLAN routing to include management and Native VLANs",
        "- Address end devices/router/SVI's and IPv6",
        `- SSH on ${SC} (domain name - ${P.domain}, 1024 bits, username ${P.user}`,
        `  ecrypted password - ${P.pw}. Place on all VTY lines`,
        "- Switches default gateway",
        "- Tell end devices where to locate the DNS server (IPv4)",
    ];
    const vlanBox = [
        `VLAN ${P.A} - ${P.nameA} - ${P.netA}/${P.pA}`,
        `VLAN ${P.B} - ${P.nameB} - ${P.netB}/${P.pB}`,
        `VLAN ${P.N} - ${P.nameN} - ${P.netN}/${P.pN}`,
    ];
    const notes = [
        { x: 120, y: 116, t: `VLAN ${P.A}`, a: "end" }, { x: 145, y: 82, t: ORD[o1] },
        { x: 80, y: 208, t: `VLAN ${P.B}`, a: "end" }, { x: 66, y: 246, t: ORD[o1] },
        { x: 308, y: 148, t: swOrdLabel(ordOf.S1) }, { x: 452, y: 218, t: swOrdLabel(ordOf.SC) }, { x: 296, y: 309, t: swOrdLabel(ordOf.S3) },
        { x: 58, y: 326, t: `VLAN ${P.B}`, a: "end" }, { x: 44, y: 362, t: ORD[o3] },
        { x: 104, y: 426, t: `VLAN ${P.A}`, a: "end" }, { x: 90, y: 456, t: ORD[o3] },
        { x: 612, y: 16, t: "1st" },
        { x: 672, y: 34, box: [`${P.link}/30`, "", `${P.v6show}/64`] },
        { x: 650, y: 196, box: [`::${P.rid}`, P.ll] },
        { x: 254, y: 452, box: vlanBox },
        { x: 572, y: 318, box: reqs },
    ];

    // ── The 48 graded items (same tree as Packet Tracer's Assessment Items)
    const C = (st, id) => st.devs[id].cfg;
    const I = (st, id, n) => C(st, id).ifaces[n] || {};
    const ipIs = (f, ip, mask) => f.ip === ip && f.mask === mask;
    const items = [];
    const it = (dev, path, test) => items.push({ dev, label: `${devices[dev].label}: ${path}`, item: path, test });
    const sub = (v) => `${P.routerTrunk}.${v}`;
    // Router
    it("R", "Banner MOTD", (st) => (C(st, "R").banner || "").trim() === P.banner);
    it("R", "Console Line › Password", (st) => C(st, "R").lines.con.pw === "cisco");
    it("R", "Host Name", (st) => C(st, "R").hostname === RN);
    [P.A, P.N, P.B].map(String).sort().map(Number).forEach((v) => {
        const native = v === P.N, gw = v === P.A ? gwA : v === P.B ? gwB : gwN, m = v === P.A ? mA : v === P.B ? mB : mN;
        it("R", `Ports › ${sub(v)} › 802.1Q › ${native ? "Native VLAN" : "VLAN ID"}`, (st) => { const q = I(st, "R", sub(v)).dot1q; return !!q && q.vlan === v && q.native === native; });
        it("R", `Ports › ${sub(v)} › IP Address`, (st) => ipIs(I(st, "R", sub(v)), gw, m));
    });
    it("R", `Ports › ${P.routerSrv} › IP Address`, (st) => ipIs(I(st, "R", P.routerSrv), rLink, mL));
    it("R", `Ports › ${P.routerSrv} › IPv6 Address › IP Address`, (st) => (I(st, "R", P.routerSrv).v6 || []).some((x) => x.addr === rV6));
    it("R", `Ports › ${P.routerSrv} › IPv6 Address › Prefix Length`, (st) => (I(st, "R", P.routerSrv).v6 || []).some((x) => x.addr === rV6 && x.len === 64));
    it("R", `Ports › ${P.routerSrv} › Link Local`, (st) => I(st, "R", P.routerSrv).ll === llV6);
    it("R", "VTY Lines › VTY Line 1 › Password", (st) => C(st, "R").lines.vty.pw === "cisco");
    // Center switch (SSH)
    const vty2 = (st) => C(st, "SC").lines.vty2 || {};
    it("SC", "IP Domain Name", (st) => (C(st, "SC").domain || "").toLowerCase() === P.domain.toLowerCase());
    [fa(P.t2), fa(P.t1), P.centerUp].sort().forEach((p) => it("SC", `Ports › ${p} › Native VLAN`, (st) => I(st, "SC", p).native === P.N));
    it("SC", `Ports › Vlan${P.N} › IP Address`, (st) => I(st, "SC", `Vlan${P.N}`).ip === swIp(ordOf.SC));
    it("SC", "Security › Modulus Bits", (st) => C(st, "SC").rsa === 1024);
    it("SC", `VLANS › VLAN ${P.A} › VLAN Name`, (st) => (C(st, "SC").vlans || {})[P.A] === P.nameA);
    it("SC", "VTY Lines › VTY Line 11 › Login", (st) => vty2(st).login === "local");
    it("SC", "VTY Lines › VTY Line 11 › Transport Input", (st) => vty2(st).transport === "ssh");
    it("SC", "VTY Lines › VTY Line 4 › Login", (st) => C(st, "SC").lines.vty.login === "local");
    it("SC", "VTY Lines › VTY Line 4 › Transport Input", (st) => C(st, "SC").lines.vty.transport === "ssh");
    // Server
    it("SV", "Ports › FastEthernet0 › IP Address", (st) => C(st, "SV").ip === srvIp);
    it("SV", "Ports › FastEthernet0 › IPv6 Address › IP Address", (st) => C(st, "SV").v6 === srvV6);
    it("SV", "Ports › FastEthernet0 › IPv6 Address › Prefix Length", (st) => C(st, "SV").v6 === srvV6 && C(st, "SV").v6len === 64);
    it("SV", "Ports › FastEthernet0 › Subnet Mask", (st) => C(st, "SV").mask === mL);
    // Graded hosts: Laptop1 and PC0
    const hostItems = (id, h) => {
        const gw = h.vlan === "A" ? gwA : gwB, m = h.vlan === "A" ? mA : mB;
        it(id, "Default Gateway", (st) => C(st, id).gw === gw);
        it(id, "DNS Server IP", (st) => C(st, id).dns === srvIp);
        it(id, "Ports › FastEthernet0 › IP Address", (st) => C(st, id).ip === hostIp(h));
        it(id, "Ports › FastEthernet0 › Subnet Mask", (st) => C(st, id).mask === m);
    };
    hostItems("L1", hosts.L1);
    hostItems("PC0", hosts.PC0);
    // Switch 1
    [fa(pc0Port), fa(l0Port)].sort().forEach((p) => it("S1", `Ports › ${p} › Access VLAN`, (st) => I(st, "S1", p).access === (p === fa(pc0Port) ? P.A : P.B)));
    it("S1", `Ports › ${fa(P.t1)} › Native VLAN`, (st) => I(st, "S1", fa(P.t1)).native === P.N);
    it("S1", `Ports › Vlan${P.N} › Subnet Mask`, (st) => I(st, "S1", `Vlan${P.N}`).mask === mN);
    it("S1", `VLANS › VLAN ${P.B} › VLAN Name`, (st) => (C(st, "S1").vlans || {})[P.B] === P.nameB);
    // Switch 3
    [fa(pc1Port), fa(l1Port), fa(P.t2)].sort().forEach((p) => {
        if (p === fa(P.t2)) it("S3", `Ports › ${p} › Native VLAN`, (st) => I(st, "S3", p).native === P.N);
        else it("S3", `Ports › ${p} › Access VLAN`, (st) => I(st, "S3", p).access === (p === fa(pc1Port) ? P.A : P.B));
    });
    it("S3", `Ports › Vlan${P.N} › IP Address`, (st) => I(st, "S3", `Vlan${P.N}`).ip === swIp(ordOf.S3));
    it("S3", `Ports › Vlan${P.N} › Subnet Mask`, (st) => I(st, "S3", `Vlan${P.N}`).mask === mN);
    it("S3", `VLANS › VLAN ${P.N} › VLAN Name`, (st) => (C(st, "S3").vlans || {})[P.N] === P.nameN);
    // Tree order: devices alphabetically by name, like Packet Tracer.
    const order = Object.keys(devices).sort((a, b) => devices[a].label.localeCompare(devices[b].label));
    items.sort((x, y) => order.indexOf(x.dev) - order.indexOf(y.dev));

    // ── Answers (AnswrIT help)
    const swCmds = (id, k, accessPorts, trunks) => [
        "enable", "configure terminal", `hostname ${devices[id].label}`,
        `vlan ${P.A}`, ` name ${P.nameA}`, `vlan ${P.B}`, ` name ${P.nameB}`, `vlan ${P.N}`, ` name ${P.nameN}`, " exit",
        ...accessPorts.flatMap(([p, v]) => [`interface ${p}`, " switchport mode access", ` switchport access vlan ${v}`]),
        ...(trunks.length ? [`interface ${trunks.length > 1 ? `range ${trunks.join(" , ")}` : trunks[0]}`, " switchport mode trunk", ` switchport trunk native vlan ${P.N}`] : []),
        `interface vlan ${P.N}`, ` ip address ${swIp(k)} ${mN}`, " no shutdown", " exit",
        `ip default-gateway ${gwN}`,
    ];
    const answer = {
        plan: [
            [`${RN} ${P.routerTrunk}.${P.A}`, gwA, mA, `VLAN ${P.A}, last usable`],
            [`${RN} ${P.routerTrunk}.${P.B}`, gwB, mB, `VLAN ${P.B}, last usable`],
            [`${RN} ${P.routerTrunk}.${P.N} (native)`, gwN, mN, `VLAN ${P.N}, last usable`],
            [`${RN} ${P.routerSrv}`, rLink, mL, `${v6short(rV6)}/64, link-local ${P.ll}`],
            [`${S1} Vlan${P.N}`, swIp(ordOf.S1), mN, `gateway ${gwN}`],
            [`${SC} Vlan${P.N}`, swIp(ordOf.SC), mN, `gateway ${gwN}`],
            [`${S3} Vlan${P.N}`, swIp(ordOf.S3), mN, `gateway ${gwN}`],
            [`PC0 (VLAN ${P.A})`, hostIp(hosts.PC0), mA, `gateway ${gwA}, DNS ${srvIp}`],
            [`Laptop0 (VLAN ${P.B})`, hostIp(hosts.L0), mB, `gateway ${gwB}, DNS ${srvIp}`],
            [`Laptop1 (VLAN ${P.B})`, hostIp(hosts.L1), mB, `gateway ${gwB}, DNS ${srvIp}`],
            [`PC1 (VLAN ${P.A})`, hostIp(hosts.PC1), mA, `gateway ${gwA}, DNS ${srvIp}`],
            [P.server, srvIp, mL, `gateway ${rLink}; IPv6 ${v6short(srvV6)}/64, gateway ${P.ll}`],
        ],
        help: [
            [`${RN} (router)`, [
                "enable", "configure terminal", `hostname ${RN}`, "enable secret class",
                "line console 0", " password cisco", " login", "line vty 0 4", " password cisco", " login", " exit",
                "service password-encryption", `banner motd #${P.banner}#`,
                `interface ${P.routerTrunk}`, " no shutdown",
                ...[[P.A, gwA, mA, ""], [P.B, gwB, mB, ""], [P.N, gwN, mN, " native"]].flatMap(([v, ip, m, nat]) => [`interface ${P.routerTrunk}.${v}`, ` encapsulation dot1Q ${v}${nat}`, ` ip address ${ip} ${m}`]),
                `interface ${P.routerSrv}`, ` ip address ${rLink} ${mL}`, ` ipv6 address ${v6short(rV6)}/64`, ` ipv6 address ${P.ll} link-local`, " no shutdown", " end",
            ].join("\n")],
            [`${SC} (center switch, SSH)`, [
                ...swCmds("SC", ordOf.SC, [], [fa(P.t1), fa(P.t2), P.centerUp].map(shortIf).map((x) => x.replace("Gig", "g").replace("Fa", "f"))),
                `ip domain-name ${P.domain}`, `username ${P.user} secret ${P.pw}`, "crypto key generate rsa general-keys modulus 1024", "ip ssh version 2",
                "line vty 0 15", " login local", " transport input ssh", " end",
            ].join("\n")],
            [`${S1}`, [...swCmds("S1", ordOf.S1, [[fa(pc0Port), P.A], [fa(l0Port), P.B]], [fa(P.t1)]), "end"].join("\n")],
            [`${S3}`, [...swCmds("S3", ordOf.S3, [[fa(pc1Port), P.A], [fa(l1Port), P.B]], [fa(P.t2)]), "end"].join("\n")],
        ],
    };

    return {
        title: "Skills Practice: VLANs & Inter-VLAN Routing",
        sub: "Router-on-a-stick, trunks, native/management VLAN, SSH and IPv6",
        course: "CCNA 2",
        file: ver === 1 ? "progress_check_1_practice.pka" : `progress_check_1_practice_v${ver}.pka`,
        ver, P, wide: true, countUp: true,
        devices, links, notes, reqs, vlanBox, answer, hosts,
        checks: () => items,
        conn: [["PC0", "PC1"], ["PC0", "L1"], ["L0", "L1"], ["PC1", "SV"], ["L0", "SV"]],
    };
}

const VLAN_LAB = "ccna2-vlan";
const VLAN_VERSIONS = 6;
// "ccna2-vlan" (version 1) or "ccna2-vlan-7"
function getLab(id) {
    if (LABS[id]) return LABS[id];
    const m = new RegExp(`^${VLAN_LAB}(?:-(\\d{1,5}))?$`).exec(id);
    if (!m) return null;
    const ver = Math.max(1, +(m[1] || 1));
    return LABS[`${VLAN_LAB}-${ver}`] || (LABS[`${VLAN_LAB}-${ver}`] = makeVlanLab(ver));
}

// ─── Devices ────────────────────────────────────────────────────────────────
// mode: "" = dynamic auto (the 2960 default), "access", "trunk", "desirable". dot1q: router subinterface tag.
function newIface(shut) { return { ip: "", mask: "", v6: [], ll: "", desc: "", shut, v6on: false, mode: "", access: 1, native: 1, dot1q: null }; }
function newNetDevice(kind, model) {
    const ifaces = {};
    if (kind === "router") {
        const names = model === "4331" ? ["GigabitEthernet0/0/0", "GigabitEthernet0/0/1", "GigabitEthernet0/0/2"] : ["GigabitEthernet0/0", "GigabitEthernet0/1", "GigabitEthernet0/2"];
        names.forEach((n) => { ifaces[n] = newIface(true); });
    } else {
        for (let i = 1; i <= 24; i++) ifaces[`FastEthernet0/${i}`] = newIface(false);
        ifaces["GigabitEthernet0/1"] = newIface(false);
        ifaces["GigabitEthernet0/2"] = newIface(false);
        ifaces.Vlan1 = newIface(true);
    }
    return {
        cfg: {
            hostname: kind === "router" ? "Router" : "Switch",
            enableSecret: "", enablePassword: "", spe: false, banner: "", minLen: 0, block: null,
            lookup: true, domain: "", users: {}, rsa: 0, v6routing: false, gw: "",
            // vty = lines 0-4, vty2 = lines 5-15
            lines: { con: { pw: "", login: "", timeout: "" }, vty: { pw: "", login: "", timeout: "", transport: "" }, vty2: { pw: "", login: "", timeout: "", transport: "" } },
            vlans: kind === "switch" ? { 1: "default" } : undefined,
            ifaces,
        },
        startup: null,
    };
}
function newHost() { return { cfg: { ip: "", mask: "", gw: "", dns: "", v6: "", v6len: 64, v6gw: "", files: [] } }; }
function freshState(lab) {
    const devs = {};
    for (const [id, d] of Object.entries(lab.devices)) devs[id] = d.kind === "router" || d.kind === "switch" ? newNetDevice(d.kind, d.model) : newHost();
    return { devs, sheet: {} };
}
// Fill in fields that older saved labs don't have.
function upgradeState(st) {
    for (const d of Object.values(st.devs)) {
        const c = d.cfg;
        if (!c.lines) continue;
        if (!c.lines.vty2) c.lines.vty2 = { pw: "", login: "", timeout: "", transport: "" };
        for (const f of Object.values(c.ifaces)) {
            if (f.mode === undefined) Object.assign(f, { mode: "", access: 1, native: 1, dot1q: null });
        }
    }
    return st;
}

// ─── Reachability (ping) ────────────────────────────────────────────────────
// The other end of the cable plugged into dev/port.
function peerOf(lab, dev, port) {
    const l = lab.links.find(([a, ap, b, bp]) => (a === dev && ap === port) || (b === dev && bp === port));
    if (!l) return null;
    return l[0] === dev && l[1] === port ? { dev: l[2], port: l[3] } : { dev: l[0], port: l[1] };
}
function hostPort(lab, id) {
    const l = lab.links.find(([a, , b]) => a === id || b === id);
    return l ? (l[0] === id ? l[1] : l[3]) : "FastEthernet0";
}
const vlansOf = (st, sw) => st.devs[sw].cfg.vlans || { 1: "default" };
function swPort(st, sw, port) {
    const f = st.devs[sw].cfg.ifaces[port] || {};
    return { mode: f.mode || "", access: +f.access || 1, native: +f.native || 1, shut: !!f.shut };
}
// Is this switch port trunking? Routers don't negotiate (DTP), so a switch port facing a router
// trunks only when it's set to "switchport mode trunk".
function isTrunk(lab, st, sw, port) {
    const p = swPort(st, sw, port);
    if (p.mode === "trunk") return true;
    if (p.mode === "access") return false;
    const o = peerOf(lab, sw, port);
    if (!o || lab.devices[o.dev].kind !== "switch") return false;
    const q = swPort(st, o.dev, o.port);
    return q.mode === "trunk" || q.mode === "desirable" || (p.mode === "desirable" && q.mode !== "access");
}
// Layer 2: which (switch, VLAN) pairs and point-to-point cables form one broadcast domain.
function l2Map(lab, st) {
    const parent = {};
    const find = (x) => { while (parent[x] && parent[x] !== x) x = parent[x]; return x; };
    const union = (a, b) => { if (!a || !b) return; parent[a] = parent[a] || a; parent[b] = parent[b] || b; const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    const node = (sw, v) => (vlansOf(st, sw)[v] !== undefined ? `${sw}|${v}` : null);
    const kind = (id) => lab.devices[id].kind;
    for (const [a, ap, b, bp] of lab.links) {
        if (kind(a) === "switch" && kind(b) === "switch") {
            const A = swPort(st, a, ap), B = swPort(st, b, bp);
            if (A.shut || B.shut) continue;
            const ta = isTrunk(lab, st, a, ap), tb = isTrunk(lab, st, b, bp);
            if (ta && tb) {
                for (const v of Object.keys(vlansOf(st, a))) {
                    if (+v !== A.native && +v !== B.native && vlansOf(st, b)[v] !== undefined) union(node(a, v), node(b, v));
                }
            }
            union(node(a, ta ? A.native : A.access), node(b, tb ? B.native : B.access));
        } else if (kind(a) !== "switch" && kind(b) !== "switch") {
            union(`P|${a}|${ap}`, `P|${b}|${bp}`);
        }
    }
    const seg = (x) => (x ? find(x) : null);
    return {
        // A host's (or a router port's) untagged frames, entering at dev/port.
        untagged(dev, port) {
            const o = peerOf(lab, dev, port);
            if (!o) return null;
            if (kind(o.dev) !== "switch") return seg(`P|${dev}|${port}`) || `P|${dev}|${port}`;
            const p = swPort(st, o.dev, o.port);
            if (p.shut) return null;
            const t = kind(dev) === "router" ? p.mode === "trunk" : isTrunk(lab, st, o.dev, o.port);
            return seg(node(o.dev, t ? p.native : p.access));
        },
        // A router subinterface's frames tagged with VLAN v.
        tagged(dev, port, v) {
            const o = peerOf(lab, dev, port);
            if (!o || kind(o.dev) !== "switch") return null;
            const p = swPort(st, o.dev, o.port);
            if (p.shut || p.mode !== "trunk") return null;
            return seg(node(o.dev, v));
        },
        svi: (sw, v) => seg(node(sw, v)),
    };
}
function routerIfSeg(L, st, id, name) {
    const [base, sub] = name.split(".");
    if (!sub) return L.untagged(id, base);
    const q = st.devs[id].cfg.ifaces[name].dot1q;
    if (!q) return null;
    return q.native ? L.untagged(id, base) : L.tagged(id, base, q.vlan);
}
function autoLL(id, n) {
    const a = (id.charCodeAt(0) % 256).toString(16).padStart(2, "0");
    const b = ((id.charCodeAt(id.length - 1) * 31 + n) % 65536).toString(16);
    return v6(`fe80::2d0:97ff:fe${a}:${b}`);
}

// Every place a device has an address: { dev, seg, addrs, inNet(a), gw, up, router }
function stacks(lab, st, fam) {
    const out = [];
    const L = l2Map(lab, st);
    for (const [id, def] of Object.entries(lab.devices)) {
        const d = st.devs[id];
        if (def.kind === "router") {
            Object.entries(d.cfg.ifaces).forEach(([name, f0], i) => {
                const seg = routerIfSeg(L, st, id, name);
                if (!seg) return;
                const parentIf = d.cfg.ifaces[name.split(".")[0]];
                const f = { ...f0, shut: f0.shut || parentIf.shut };
                if (fam === 4 && f.ip) out.push({ dev: id, seg, addrs: [f.ip], inNet: (a) => sameNet(a, f.ip, f.mask), up: !f.shut, router: true });
                if (fam === 6 && (f.v6.length || f.ll || f.v6on)) {
                    const ll = f.ll || autoLL(id, i);
                    out.push({ dev: id, seg, addrs: [...f.v6.map((x) => x.addr), ll], inNet: (a) => isLL(a) || f.v6.some((x) => samePfx(a, x.addr, x.len)), up: !f.shut, router: true });
                }
            });
        } else if (def.kind === "switch") {
            for (const [name, f] of Object.entries(d.cfg.ifaces)) {
                if (!name.startsWith("Vlan") || !f.ip || fam !== 4) continue;
                const seg = L.svi(id, +name.slice(4));
                if (seg) out.push({ dev: id, seg, addrs: [f.ip], inNet: (a) => sameNet(a, f.ip, f.mask), gw: d.cfg.gw, up: !f.shut });
            }
        } else {
            const c = d.cfg, seg = L.untagged(id, hostPort(lab, id));
            if (!seg) continue;
            if (fam === 4 && c.ip && c.mask) out.push({ dev: id, seg, addrs: [c.ip], inNet: (a) => sameNet(a, c.ip, c.mask), gw: c.gw, up: true });
            if (fam === 6 && c.v6) out.push({ dev: id, seg, addrs: [c.v6, autoLL(id, 9)], inNet: (a) => isLL(a) || samePfx(a, c.v6, c.v6len), gw: c.v6gw, up: true });
        }
    }
    return out;
}
function routes(st, dev, fam) { return fam === 4 || st.devs[dev].cfg.v6routing; }
// Can a packet from stack `src` reach the device that owns `dst` (address string)?
function deliver(all, st, src, dst, fam) {
    if (!src.up) return false;
    const owner = all.find((x) => x.up && x.addrs.includes(dst));
    if (!owner) return false;
    if (owner.dev === src.dev) return true;
    if (owner.seg === src.seg && src.inNet(dst)) return true;
    if (src.router) {
        return routes(st, src.dev, fam) && all.some((r) => r.dev === src.dev && r.up && r.seg === owner.seg && r.inNet(dst));
    }
    if (!src.gw) return false;
    const g = all.find((r) => r.router && r.up && r.seg === src.seg && r.addrs.includes(src.gw) && src.inNet(src.gw));
    if (!g) return false;
    if (owner.dev === g.dev) return true;
    return routes(st, g.dev, fam) && all.some((r) => r.dev === g.dev && r.up && r.seg === owner.seg && r.inNet(dst));
}
function ping(lab, st, srcDev, target, fam) {
    const dst = fam === 4 ? normIp(target) : v6(target);
    if (!dst) return { ok: false, bad: true };
    const all = stacks(lab, st, fam);
    const mine = all.filter((s) => s.dev === srcDev && s.up);
    if (!mine.length) return { ok: false, noAddr: true };
    const owner = all.find((x) => x.up && x.addrs.includes(dst));
    if (!owner) return { ok: false };
    let src = mine[0];
    if (lab.devices[srcDev].kind === "router") {
        src = mine.find((r) => r.seg === owner.seg && r.inNet(dst)) || mine.find((r) => r.dev === owner.dev) || mine[0];
    }
    const there = deliver(all, st, src, dst, fam);
    const replyFrom = owner.router ? (all.find((r) => r.dev === owner.dev && r.up && r.seg === src.seg) || owner) : owner;
    const back = there && deliver(all, st, replyFrom, src.addrs[0], fam);
    return { ok: there && back, owner, src, routed: owner.dev !== src.dev && owner.seg !== src.seg && !owner.router };
}

// ─── IOS command line ───────────────────────────────────────────────────────
const MODE_SUFFIX = { user: ">", priv: "#", config: "(config)#", if: "(config-if)#", subif: "(config-subif)#", line: "(config-line)#", range: "(config-if-range)#", vlan: "(config-vlan)#" };
const CFG_MODES = ["config", "if", "subif", "line", "range", "vlan"];
// Interface and range modes accept the same commands as interface mode.
const cmdMode = (m) => (m === "range" || m === "subif" ? "if" : m);

function normIf(raw, d, kind) {
    const s = String(raw).replace(/\s+/g, "").toLowerCase();
    const m = /^([a-z-]+)(\d[\d/.]*)$/.exec(s);
    if (!m) return null;
    const types = [["gigabitethernet", "GigabitEthernet"], ["fastethernet", "FastEthernet"], ["vlan", "Vlan"]];
    const t = types.find(([full]) => full.startsWith(m[1]));
    if (!t) return null;
    const name = t[1] + m[2];
    if (d.cfg.ifaces[name]) return name;
    if (t[1] === "Vlan" && kind === "switch" && /^\d+$/.test(m[2]) && +m[2] >= 1 && +m[2] <= 4094) {
        d.cfg.ifaces[name] = newIface(true);
        return name;
    }
    // Router subinterface, e.g. g0/0/0.50
    const sub = /^(.+)\.(\d+)$/.exec(name);
    if (sub && kind === "router" && d.cfg.ifaces[sub[1]] && !sub[1].includes(".") && +sub[2] >= 1 && +sub[2] <= 4294967295) {
        d.cfg.ifaces[name] = newIface(false);
        return name;
    }
    return null;
}
// "f0/9 - 10", "fa0/1-2, g0/1" -> list of interface names (or null if any part is wrong)
function rangeIfs(raw, d, kind) {
    const out = [];
    for (const part of String(raw).split(",")) {
        const s = part.replace(/\s+/g, "").toLowerCase();
        const m = /^([a-z-]+)(\d+\/(?:\d+\/)?)(\d+)(?:-(\d+))?$/.exec(s);
        if (!m || kind !== "switch") return null;
        const a = +m[3], b = m[4] === undefined ? a : +m[4];
        if (b < a) return null;
        for (let n = a; n <= b; n++) {
            const name = normIf(`${m[1]}${m[2]}${n}`, d, kind);
            if (!name) return null;
            out.push(name);
        }
    }
    return out.length ? out : null;
}

const VALID = {
    "<w>": () => true,
    "<n>": (t) => /^\d+$/.test(t),
    "<ip>": (t) => ip2n(t) !== null,
    "<v6p>": (t) => !!v6pfx(t),
    "<v6>": (t) => !!v6(t),
    "<host>": (t) => ip2n(t) !== null || !!v6(t),
};
const HELP_NAME = { "<w>": "WORD", "<n>": "<0-4294967295>", "<ip>": "A.B.C.D", "<v6p>": "X:X:X:X::X/<0-128>", "<v6>": "X:X:X:X::X", "<host>": "WORD  Ping destination address or hostname", "<rest>": "LINE", "<if>": "GigabitEthernet / FastEthernet / Vlan" };

const CMDS = [];
function cmd(modes, pattern, run, only) { CMDS.push({ modes: modes.split(" "), words: pattern.split(" "), run, only }); }

function pwOk(ctx, pw) {
    if (ctx.d.cfg.minLen && pw.length < ctx.d.cfg.minLen) { ctx.print(PW_MIN.replace("%n", ctx.d.cfg.minLen)); return false; }
    return true;
}
function curIf(ctx) { return ctx.d.cfg.ifaces[ctx.s.ifc]; }
// The line(s) being configured: "line vty 0 15" covers both vty groups.
function curLines(ctx) {
    const c = ctx.d.cfg.lines;
    if (!c.vty2) c.vty2 = { pw: "", login: "", timeout: "", transport: "" };
    return [].concat(ctx.s.line).map((k) => c[k]);
}
const isVtyLine = (ctx) => [].concat(ctx.s.line).every((k) => k === "vty" || k === "vty2");
const isSwitchPort = (ctx) => ctx.kind === "switch" && !String(ctx.s.ifc).startsWith("Vlan");

// Exec
cmd("user", "enable", (ctx) => {
    const c = ctx.d.cfg;
    if (!c.enableSecret && !c.enablePassword) { ctx.s.mode = "priv"; return; }
    ctx.ask("Password: ", true, (v, again) => {
        if (v === (c.enableSecret || c.enablePassword)) { ctx.s.mode = "priv"; return; }
        if (again < 2) return "retry";
        ctx.print("% Bad secrets");
    });
});
cmd("priv", "enable", () => {});
cmd("priv", "disable", (ctx) => { ctx.s.mode = "user"; });
cmd("priv", "configure terminal", (ctx) => { ctx.print("Enter configuration commands, one per line.  End with CNTL/Z."); ctx.s.mode = "config"; });
cmd("user priv", "exit", (ctx) => ctx.logout());
cmd("user priv", "logout", (ctx) => ctx.logout());
cmd("user priv", "ping <host>", (ctx, [t]) => ctx.iosPing(t));
cmd("priv", "show running-config", (ctx) => ctx.print(runningConfig(ctx.d, ctx.kind, ctx.d.cfg, true)));
cmd("priv", "show startup-config", (ctx) => {
    if (!ctx.d.startup) return ctx.print("startup-config is not present");
    const text = runningConfig(ctx.d, ctx.kind, JSON.parse(ctx.d.startup), false);
    ctx.print(`Using ${text.length} bytes\n${text}`);
});
cmd("user priv", "show ip interface brief", (ctx) => ctx.print(ipBrief(ctx)));
cmd("user priv", "show vlan brief", (ctx) => ctx.print(vlanBrief(ctx, false)), "switch");
cmd("user priv", "show vlan", (ctx) => ctx.print(vlanBrief(ctx, true)), "switch");
cmd("user priv", "show interfaces trunk", (ctx) => ctx.print(trunkShow(ctx)), "switch");
cmd("user priv", "show ipv6 interface brief", (ctx) => ctx.print(ipv6Brief(ctx)), "router");
cmd("user priv", "show ip route", (ctx) => ctx.print(ipRoute(ctx)), "router");
cmd("user priv", "show version", (ctx) => ctx.print(ctx.kind === "router" && ctx.d.cfg.ifaces["GigabitEthernet0/0/0"]
    ? "Cisco IOS XE Software, Version 03.16.05.S - Extended Support Release\nCisco IOS Software, ISR Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 15.5(3)S5\ncisco ISR4331/K9 (1RU) processor with 1795999K/6147K bytes of memory.\n3 Gigabit Ethernet interfaces\n32768K bytes of non-volatile configuration memory."
    : ctx.kind === "router"
    ? "Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.1(4)M5\ncisco CISCO2911/K9 (revision 1.0) with 491520K/32768K bytes of memory.\n3 Gigabit Ethernet interfaces\n255K bytes of non-volatile configuration memory."
    : "Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4\ncisco WS-C2960-24TT-L (PowerPC405) processor with 65536K bytes of memory.\n24 FastEthernet interfaces\n2 Gigabit Ethernet interfaces"));
cmd("priv", "show clock", (ctx) => ctx.print(`*${new Date().toUTCString().slice(17, 25)}.123 UTC Mon Mar 1 1993`));
cmd("priv", "copy running-config startup-config", (ctx) => {
    ctx.ask("Destination filename [startup-config]? ", false, () => { ctx.saveStartup(); ctx.print("Building configuration...\n[OK]"); });
});
cmd("priv", "write", (ctx) => { ctx.saveStartup(); ctx.print("Building configuration...\n[OK]"); });
cmd("priv", "write memory", (ctx) => { ctx.saveStartup(); ctx.print("Building configuration...\n[OK]"); });
const toTftp = (ctx) => {
    ctx.ask("Address or name of remote host []? ", false, (host) => {
        const def = `${ctx.d.cfg.hostname}-confg`;
        ctx.ask(`Destination filename [${def}]? `, false, (name) => ctx.tftp(host.trim(), name.trim() || def));
    });
};
cmd("priv", "copy running-config tftp", toTftp);
cmd("priv", "copy running-config tftp:", toTftp);
cmd("priv", "erase startup-config", (ctx) => {
    ctx.ask("Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]", false, () => { ctx.d.startup = null; ctx.print("[OK]\nErase of nvram: complete"); });
});

// Global config
cmd("config", "hostname <w>", (ctx, [h]) => { ctx.d.cfg.hostname = h; });
cmd("config", "no ip domain-lookup", (ctx) => { ctx.d.cfg.lookup = false; });
cmd("config", "no ip domain lookup", (ctx) => { ctx.d.cfg.lookup = false; });
cmd("config", "ip domain-lookup", (ctx) => { ctx.d.cfg.lookup = true; });
cmd("config", "ip domain-name <w>", (ctx, [n]) => { ctx.d.cfg.domain = n; });
cmd("config", "ip domain name <w>", (ctx, [n]) => { ctx.d.cfg.domain = n; });
cmd("config", "enable secret <w>", (ctx, [p]) => { if (pwOk(ctx, p)) ctx.d.cfg.enableSecret = p; });
cmd("config", "enable password <w>", (ctx, [p]) => { if (pwOk(ctx, p)) ctx.d.cfg.enablePassword = p; });
cmd("config", "no enable secret", (ctx) => { ctx.d.cfg.enableSecret = ""; });
cmd("config", "service password-encryption", (ctx) => { ctx.d.cfg.spe = true; });
cmd("config", "no service password-encryption", (ctx) => { ctx.d.cfg.spe = false; });
cmd("config", "banner motd <rest>", (ctx, [text]) => ctx.banner(text));
cmd("config", "no banner motd", (ctx) => { ctx.d.cfg.banner = ""; });
cmd("config", "security passwords min-length <n>", (ctx, [n]) => {
    const v = +n;
    if (v < 1 || v > 16) return ctx.invalid();
    ctx.d.cfg.minLen = v;
}, "router");
cmd("config", "login block-for <n> attempts <n> within <n>", (ctx, [f, a, w]) => { ctx.d.cfg.block = { for: +f, attempts: +a, within: +w }; }, "router");
const addUser = (type) => (ctx, args) => {
    const [name, priv, pw] = args.length === 3 ? args : [args[0], "1", args[1]];
    if (!pwOk(ctx, pw)) return;
    ctx.d.cfg.users[name] = { priv: +priv, type, pw };
};
cmd("config", "username <w> privilege <n> secret <w>", addUser("secret"));
cmd("config", "username <w> secret <w>", addUser("secret"));
cmd("config", "username <w> privilege <n> password <w>", addUser("password"));
cmd("config", "username <w> password <w>", addUser("password"));
const rsa = (ctx, bits) => {
    const c = ctx.d.cfg;
    if (c.hostname === "Router" || c.hostname === "Switch") return ctx.print(`% Please define a hostname other than ${c.hostname}.`);
    if (!c.domain) return ctx.print("% Please define a domain-name first.");
    const make = (v) => {
        const n = Number(String(v).trim() || 512);
        if (!(n >= 360 && n <= 4096)) return ctx.print("% A decimal number between 360 and 4096.");
        c.rsa = n;
        ctx.print(`% Generating ${n} bit RSA keys, keys will be non-exportable...[OK]${n >= 768 ? "\n*Mar 1 0:12:7.243: %SSH-5-ENABLED: SSH 1.99 has been enabled" : ""}`);
    };
    ctx.print(`The name for the keys will be: ${c.hostname}.${c.domain}`);
    if (bits) return make(bits);
    ctx.print("Choose the size of the key modulus in the range of 360 to 4096 for your\n  General Purpose Keys. Choosing a key modulus greater than 512 may take\n  a few minutes.\n");
    ctx.ask("How many bits in the modulus [512]: ", false, make);
};
cmd("config", "crypto key generate rsa", (ctx) => rsa(ctx));
cmd("config", "crypto key generate rsa general-keys modulus <n>", (ctx, [n]) => rsa(ctx, n));
cmd("config", "crypto key generate rsa modulus <n>", (ctx, [n]) => rsa(ctx, n));
cmd("config", "ip ssh version <n>", (ctx, [n]) => {
    if (!ctx.d.cfg.rsa) return ctx.print("Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2).");
    if (n !== "1" && n !== "2") return ctx.invalid();
});
cmd("config", "ipv6 unicast-routing", (ctx) => { ctx.d.cfg.v6routing = true; }, "router");
cmd("config", "no ipv6 unicast-routing", (ctx) => { ctx.d.cfg.v6routing = false; }, "router");
cmd("config", "ip default-gateway <ip>", (ctx, [g]) => { ctx.d.cfg.gw = normIp(g); }, "switch");
cmd("config", "interface <if>", (ctx, [n]) => {
    ctx.s.mode = n.includes(".") ? "subif" : "if"; ctx.s.ifc = n; ctx.s.range = null;
    if (n.includes(".") && !ctx.s.pinged[`sub:${n}`]) {
        ctx.s.pinged[`sub:${n}`] = true;
        ctx.print(`%LINK-5-CHANGED: Interface ${n}, changed state to up\n\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${n}, changed state to up`);
    }
});
cmd("config", "interface range <rest>", (ctx, [rest]) => {
    const list = rangeIfs(rest, ctx.d, ctx.kind);
    if (!list) return ctx.invalid();
    ctx.s.mode = "range"; ctx.s.range = list; ctx.s.ifc = list[0];
});
cmd("config", "line console <n>", (ctx, [n]) => { if (n !== "0") return ctx.invalid(); ctx.s.mode = "line"; ctx.s.line = "con"; });
const vtyRange = (ctx, a, b) => {
    if (+a > +b || +b > 15) return ctx.invalid();
    const groups = [];
    if (+a <= 4) groups.push("vty");
    if (+b >= 5) groups.push("vty2");
    ctx.s.mode = "line"; ctx.s.line = groups.length === 1 ? groups[0] : groups;
};
cmd("config", "line vty <n> <n>", (ctx, [a, b]) => vtyRange(ctx, a, b));
cmd("config", "line vty <n>", (ctx, [a]) => vtyRange(ctx, a, a));
cmd("config", "exit", (ctx) => { ctx.s.mode = "priv"; });
cmd("config if line vlan", "end", (ctx) => { ctx.s.mode = "priv"; ctx.s.range = null; ctx.print("%SYS-5-CONFIG_I: Configured from console by console"); });
cmd("config", "do <rest>", (ctx, [rest]) => ctx.run(rest, "priv"));
cmd("if line vlan", "do <rest>", (ctx, [rest]) => ctx.run(rest, "priv"));

// VLANs (switch)
const vlanName = (n) => `VLAN${String(n).padStart(4, "0")}`;
cmd("config", "vlan <n>", (ctx, [n]) => {
    const v = +n;
    if (v < 1 || v > 4094) return ctx.invalid();
    const vl = ctx.d.cfg.vlans || (ctx.d.cfg.vlans = { 1: "default" });
    if (vl[v] === undefined) vl[v] = vlanName(v);
    ctx.s.mode = "vlan"; ctx.s.vlan = v;
}, "switch");
cmd("config", "no vlan <n>", (ctx, [n]) => {
    const v = +n, vl = ctx.d.cfg.vlans || {};
    if (v === 1) return ctx.print("%Default VLAN 1 may not be deleted.");
    delete vl[v];
}, "switch");
cmd("vlan", "name <w>", (ctx, [name]) => {
    if (ctx.s.vlan === 1) return ctx.print("%Default VLAN 1 may not have its name changed.");
    ctx.d.cfg.vlans[ctx.s.vlan] = name.slice(0, 32);
});
cmd("vlan", "no name", (ctx) => { if (ctx.s.vlan !== 1) ctx.d.cfg.vlans[ctx.s.vlan] = vlanName(ctx.s.vlan); });
cmd("vlan", "exit", (ctx) => { ctx.s.mode = "config"; ctx.s.vlan = null; });
cmd("vlan", "vlan <n>", (ctx, [n]) => ctx.run(`vlan ${n}`, "config"));

// Interface
cmd("if", "ip address <ip> <ip>", (ctx, [a, m]) => {
    if (isSwitchPort(ctx)) return ctx.invalid();
    if (ctx.s.ifc.includes(".") && !curIf(ctx).dot1q) {
        return ctx.print("% Configuring IP routing on a LAN subinterface is only allowed if that\nsubinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q,\nor ISL vLAN.");
    }
    const ip = normIp(a), mask = normIp(m);
    if (maskBits(mask) === null) return ctx.print(`Bad mask 0x${ip2n(mask).toString(16).toUpperCase()} for address ${ip}`);
    if (!usable(ip, mask)) return ctx.print(`Bad mask /${maskBits(mask)} for address ${ip}`);
    const clash = Object.entries(ctx.d.cfg.ifaces).find(([n, f]) => n !== ctx.s.ifc && f.ip && (sameNet(ip, f.ip, f.mask) || sameNet(f.ip, ip, mask)));
    if (clash) return ctx.print(`% ${netOf(ip, mask)} overlaps with ${clash[0]}`);
    Object.assign(curIf(ctx), { ip, mask });
});
cmd("if", "no ip address", (ctx) => { Object.assign(curIf(ctx), { ip: "", mask: "" }); });
cmd("if", "ipv6 address <v6p>", (ctx, [p]) => {
    if (ctx.kind !== "router") return ctx.invalid();
    const x = v6pfx(p), f = curIf(ctx);
    if (!f.v6.some((y) => y.addr === x.addr)) f.v6.push(x);
});
cmd("if", "ipv6 address <v6> link-local", (ctx, [a]) => {
    if (ctx.kind !== "router") return ctx.invalid();
    const x = v6(a);
    if (!isLL(x)) return ctx.print("% Invalid link-local address");
    curIf(ctx).ll = x;
});
cmd("if", "no ipv6 address", (ctx) => { Object.assign(curIf(ctx), { v6: [], ll: "" }); });
cmd("if", "ipv6 enable", (ctx) => { curIf(ctx).v6on = true; });
cmd("if", "description <rest>", (ctx, [t]) => { curIf(ctx).desc = t; });
cmd("if", "no description", (ctx) => { curIf(ctx).desc = ""; });
cmd("if", "shutdown", (ctx) => {
    const f = curIf(ctx);
    if (f.shut) return;
    f.shut = true;
    ctx.print(`%LINK-5-CHANGED: Interface ${ctx.s.ifc}, changed state to administratively down${ctx.linked(ctx.s.ifc) ? `\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${ctx.s.ifc}, changed state to down` : ""}`);
});
cmd("if", "no shutdown", (ctx) => {
    const f = curIf(ctx);
    if (!f.shut) return;
    f.shut = false;
    const up = ctx.linked(ctx.s.ifc);
    ctx.print(`%LINK-5-CHANGED: Interface ${ctx.s.ifc}, changed state to ${up ? "up" : "down"}${up ? `\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${ctx.s.ifc}, changed state to up` : ""}`);
});
cmd("if", "duplex <w>", () => {});
cmd("if", "speed <w>", () => {});
cmd("if", "exit", (ctx) => { ctx.s.mode = "config"; ctx.s.ifc = null; ctx.s.range = null; });
cmd("line", "exit", (ctx) => { ctx.s.mode = "config"; ctx.s.line = null; });

// Switch ports
const portCmd = (fn) => (ctx, args) => { if (!isSwitchPort(ctx)) return ctx.invalid(); fn(curIf(ctx), ctx, args); };
const linkFlap = (ctx) => {
    if (!ctx.linked(ctx.s.ifc) || curIf(ctx).shut) return;
    ctx.print(`\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${ctx.s.ifc}, changed state to down\n\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${ctx.s.ifc}, changed state to up`);
};
cmd("if", "switchport mode access", portCmd((f) => { f.mode = "access"; }), "switch");
cmd("if", "switchport mode trunk", portCmd((f, ctx) => { const was = f.mode; f.mode = "trunk"; if (was !== "trunk") linkFlap(ctx); }), "switch");
cmd("if", "switchport mode dynamic auto", portCmd((f) => { f.mode = ""; }), "switch");
cmd("if", "switchport mode dynamic desirable", portCmd((f) => { f.mode = "desirable"; }), "switch");
cmd("if", "switchport access vlan <n>", portCmd((f, ctx, [n]) => {
    const v = +n;
    if (v < 1 || v > 4094) return ctx.invalid();
    const vl = ctx.d.cfg.vlans || (ctx.d.cfg.vlans = { 1: "default" });
    if (vl[v] === undefined) {
        if (!ctx.s.range || ctx.s.ifc === ctx.s.range[0]) ctx.print(`% Access VLAN does not exist. Creating vlan ${v}`);
        vl[v] = vlanName(v);
    }
    f.access = v;
}), "switch");
cmd("if", "no switchport access vlan", portCmd((f) => { f.access = 1; }), "switch");
cmd("if", "switchport trunk native vlan <n>", portCmd((f, ctx, [n]) => { if (+n < 1 || +n > 4094) return ctx.invalid(); f.native = +n; }), "switch");
cmd("if", "no switchport trunk native vlan", portCmd((f) => { f.native = 1; }), "switch");
cmd("if", "switchport trunk allowed vlan <rest>", portCmd(() => {}), "switch");
cmd("if", "switchport trunk encapsulation dot1q", portCmd(() => {}), "switch");
cmd("if", "switchport nonegotiate", portCmd(() => {}), "switch");
cmd("if", "switchport voice vlan <n>", portCmd(() => {}), "switch");
cmd("if", "spanning-tree portfast", portCmd(() => {}), "switch");

// Router subinterfaces (router-on-a-stick)
const encap = (native) => (ctx, [n]) => {
    if (!ctx.s.ifc.includes(".")) return ctx.invalid();
    const v = +n;
    if (v < 1 || v > 4094) return ctx.invalid();
    curIf(ctx).dot1q = { vlan: v, native };
};
cmd("if", "encapsulation dot1q <n>", encap(false), "router");
cmd("if", "encapsulation dot1q <n> native", encap(true), "router");
cmd("if", "no encapsulation dot1q", (ctx) => { curIf(ctx).dot1q = null; }, "router");

// Lines
const eachLine = (fn) => (ctx, args) => curLines(ctx).forEach((l) => fn(l, ctx, args));
cmd("line", "password <w>", (ctx, [p]) => { if (pwOk(ctx, p)) curLines(ctx).forEach((l) => { l.pw = p; }); });
cmd("line", "no password", eachLine((l) => { l.pw = ""; }));
cmd("line", "login", (ctx) => {
    curLines(ctx).forEach((l) => { l.login = "login"; });
    if (curLines(ctx).some((l) => !l.pw)) ctx.print("% Login disabled on line, until 'password' is set");
});
cmd("line", "login local", eachLine((l) => { l.login = "local"; }));
cmd("line", "no login", eachLine((l) => { l.login = ""; }));
cmd("line", "exec-timeout <n>", eachLine((l, ctx, [m]) => { l.timeout = `${+m} 0`; }));
cmd("line", "exec-timeout <n> <n>", eachLine((l, ctx, [m, s]) => { l.timeout = `${+m} ${+s}`; }));
cmd("line", "logging synchronous", () => {});
cmd("line", "transport input <rest>", (ctx, [rest]) => {
    if (!isVtyLine(ctx)) return ctx.invalid();
    const words = rest.toLowerCase().split(/\s+/).filter(Boolean);
    const ok = ["ssh", "telnet", "all", "none"];
    const full = words.map((w) => ok.find((k) => k.startsWith(w)));
    if (!full.length || full.some((w) => !w)) return ctx.invalid();
    curLines(ctx).forEach((l) => { l.transport = [...new Set(full)].sort().join(" "); });
});

// ─── IOS output builders ────────────────────────────────────────────────────
function pwLine(cfg, pw) { return cfg.spe ? `7 ${type7(pw)}` : pw; }
function runningConfig(d, kind, c, current) {
    const L = [];
    if (current) L.push("Building configuration...", "");
    const body = [];
    body.push("!", "version 15.1", "no service timestamps log datetime msec", "no service timestamps debug datetime msec");
    body.push(c.spe ? "service password-encryption" : "no service password-encryption", "!", `hostname ${c.hostname}`, "!");
    if (c.block) body.push(`login block-for ${c.block.for} attempts ${c.block.attempts} within ${c.block.within}`, "!");
    if (c.minLen) body.push(`security passwords min-length ${c.minLen}`);
    if (c.enableSecret) body.push(`enable secret 5 ${md5ish(c.enableSecret)}`);
    if (c.enablePassword) body.push(`enable password ${pwLine(c, c.enablePassword)}`);
    body.push("!");
    if (kind === "router") {
        body.push("!", "!", "!", "ip cef");
        if (c.v6routing) body.push("ipv6 unicast-routing");
        body.push("!", "no ipv6 cef", "!");
    }
    for (const [name, u] of Object.entries(c.users)) {
        body.push(`username ${name}${u.priv !== 1 ? ` privilege ${u.priv}` : ""} ${u.type === "secret" ? `secret 5 ${md5ish(u.pw)}` : `password ${pwLine(c, u.pw)}`}`);
    }
    body.push("!");
    if (!c.lookup) body.push("no ip domain-lookup");
    if (c.domain) body.push(`ip domain-name ${c.domain}`);
    body.push("!");
    if (kind === "switch") body.push("spanning-tree mode pvst", "spanning-tree extend system-id", "!");
    for (const [name, f] of Object.entries(c.ifaces)) {
        body.push(`interface ${name}`);
        if (f.desc) body.push(` description ${f.desc}`);
        if (f.dot1q) body.push(` encapsulation dot1Q ${f.dot1q.vlan}${f.dot1q.native ? " native" : ""}`);
        if (kind === "switch" && !name.startsWith("Vlan")) {
            if (f.access > 1) body.push(` switchport access vlan ${f.access}`);
            if (f.native > 1) body.push(` switchport trunk native vlan ${f.native}`);
            if (f.mode === "access") body.push(" switchport mode access");
            if (f.mode === "trunk") body.push(" switchport mode trunk");
            if (f.mode === "desirable") body.push(" switchport mode dynamic desirable");
        }
        if (f.ip) body.push(` ip address ${f.ip} ${f.mask}`);
        else if ((kind === "router" && !name.includes(".")) || name.startsWith("Vlan")) body.push(" no ip address");
        if (kind === "router" && !name.includes(".")) body.push(" duplex auto", " speed auto");
        if (f.ll) body.push(` ipv6 address ${v6short(f.ll)} link-local`);
        f.v6.forEach((x) => body.push(` ipv6 address ${v6short(x.addr)}/${x.len}`));
        if (f.v6on) body.push(" ipv6 enable");
        if (f.shut) body.push(" shutdown");
        body.push("!");
    }
    if (kind === "router") body.push("ip classless", "!", "ip flow-export version 9", "!");
    if (kind === "switch" && c.gw) body.push(`ip default-gateway ${c.gw}`, "!");
    if (c.banner) body.push(`banner motd ^C${c.banner}^C`, "!");
    const line = (title, l) => {
        body.push(title);
        if (l.timeout) body.push(` exec-timeout ${l.timeout}`);
        if (l.pw) body.push(` password ${pwLine(c, l.pw)}`);
        if (l.login === "login") body.push(" login");
        if (l.login === "local") body.push(" login local");
        if (l.transport) body.push(` transport input ${l.transport}`);
        body.push("!");
    };
    line("line con 0", c.lines.con);
    if (kind === "router") body.push("line aux 0", "!");
    line("line vty 0 4", c.lines.vty);
    const v2 = c.lines.vty2 || c.lines.vty;
    if (kind === "switch" || v2.pw || v2.login || v2.transport) line("line vty 5 15", v2);
    body.push("!", "!", "end");
    const text = body.join("\n");
    if (current) L.push(`Current configuration : ${text.length} bytes`);
    L.push(text);
    return L.join("\n");
}
function ifStatus(ctx, name, f) {
    if (f.shut) return ["administratively down", "down"];
    const parent = ctx.d.cfg.ifaces[name.split(".")[0]];
    if (name.includes(".") && parent.shut) return ["administratively down", "down"];
    if (name.startsWith("Vlan")) return (ctx.d.cfg.vlans || { 1: 1 })[+name.slice(4)] !== undefined ? ["up", "up"] : ["down", "down"];
    return ctx.linked(name) ? ["up", "up"] : ["down", "down"];
}
const shortIf = (n) => n.replace("GigabitEthernet", "Gig").replace("FastEthernet", "Fa");
function vlanBrief(ctx, full) {
    const c = ctx.d.cfg, vl = c.vlans || { 1: "default" };
    const ports = {};
    for (const [name, f] of Object.entries(c.ifaces)) {
        if (name.startsWith("Vlan") || f.mode === "trunk") continue;
        if (f.mode !== "access" && ctx.trunking(name)) continue;
        (ports[f.access || 1] = ports[f.access || 1] || []).push(shortIf(name));
    }
    const rows = ["VLAN Name                             Status    Ports", "---- -------------------------------- --------- -------------------------------"];
    const all = { ...vl, 1002: "fddi-default", 1003: "token-ring-default", 1004: "fddinet-default", 1005: "trnet-default" };
    for (const v of Object.keys(all).map(Number).sort((a, b) => a - b)) {
        const list = ports[v] || [];
        const chunks = [];
        for (let i = 0; i < list.length; i += 4) chunks.push(list.slice(i, i + 4).join(", ") + (i + 4 < list.length ? "," : ""));
        rows.push(`${String(v).padEnd(5)}${all[v].padEnd(33)}${(v >= 1002 ? "act/unsup" : "active").padEnd(10)}${chunks[0] || ""}`);
        chunks.slice(1).forEach((ch) => rows.push(`${" ".repeat(48)}${ch}`));
    }
    if (full) rows.push("", "VLAN Type  SAID       MTU   Parent RingNo BridgeNo Stp  BrdgMode Trans1 Trans2", "---- ----- ---------- ----- ------ ------ -------- ---- -------- ------ ------",
        ...Object.keys(vl).map(Number).sort((a, b) => a - b).map((v) => `${String(v).padEnd(5)}enet  ${String(100000 + v).padEnd(11)}1500  -      -      -        -    -        0      0`));
    return rows.join("\n");
}
function trunkShow(ctx) {
    const c = ctx.d.cfg;
    const list = Object.entries(c.ifaces).filter(([name, f]) => !name.startsWith("Vlan") && !f.shut && ctx.linked(name) && ctx.trunking(name));
    if (!list.length) return "";
    const vl = Object.keys(c.vlans || { 1: 1 }).map(Number).sort((a, b) => a - b).join(",");
    const rows = ["Port        Mode         Encapsulation  Status        Native vlan"];
    list.forEach(([n, f]) => rows.push(`${shortIf(n).padEnd(12)}${(f.mode === "trunk" ? "on" : f.mode === "desirable" ? "desirable" : "auto").padEnd(13)}802.1q         trunking      ${f.native || 1}`));
    rows.push("", "Port        Vlans allowed on trunk");
    list.forEach(([n]) => rows.push(`${shortIf(n).padEnd(12)}1-1005`));
    rows.push("", "Port        Vlans allowed and active in management domain");
    list.forEach(([n]) => rows.push(`${shortIf(n).padEnd(12)}${vl}`));
    rows.push("", "Port        Vlans in spanning tree forwarding state and not pruned");
    list.forEach(([n]) => rows.push(`${shortIf(n).padEnd(12)}${vl}`));
    return rows.join("\n");
}
function ipBrief(ctx) {
    const rows = ["Interface              IP-Address      OK? Method Status                Protocol "];
    for (const [name, f] of Object.entries(ctx.d.cfg.ifaces)) {
        const [s, p] = ifStatus(ctx, name, f);
        rows.push(`${name.length >= 23 ? name + " " : name.padEnd(23)}${(f.ip || "unassigned").padEnd(16)}YES ${(f.ip ? "manual" : "unset").padEnd(7)}${s.padEnd(22)}${p} `);
    }
    return rows.join("\n");
}
function ipv6Brief(ctx) {
    const rows = [];
    Object.entries(ctx.d.cfg.ifaces).forEach(([name, f], i) => {
        const [s, p] = ifStatus(ctx, name, f);
        rows.push(`${name.padEnd(27)}[${s === "administratively down" ? "administratively down" : s}/${p}]`);
        if (f.v6.length || f.ll || f.v6on) {
            rows.push(`    ${v6short(f.ll || autoLL(ctx.id, i))}`);
            f.v6.forEach((x) => rows.push(`    ${v6short(x.addr)}`));
        } else rows.push("    unassigned");
    });
    return rows.join("\n");
}
function ipRoute(ctx) {
    const rows = ["Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP", "       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area", "", "Gateway of last resort is not set", ""];
    for (const [name, f] of Object.entries(ctx.d.cfg.ifaces)) {
        if (!f.ip || ifStatus(ctx, name, f)[1] !== "up") continue;
        rows.push(`C       ${netOf(f.ip, f.mask)}/${maskBits(f.mask)} is directly connected, ${name}`);
        rows.push(`L       ${f.ip}/32 is directly connected, ${name}`);
    }
    return rows.join("\n");
}

// Split a typed line into tokens with their positions.
function tokenize(line) {
    const out = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(line))) out.push({ t: m[0], at: m.index });
    return out;
}

// Match tokens to a command. Returns { cmd, args } or { error, at }.
function match(line, mode, kind) {
    const toks = tokenize(line);
    let cands = CMDS.filter((c) => c.modes.includes(cmdMode(mode)) && (!c.only || c.only === kind)).map((c) => ({ c, args: [], done: false }));
    for (let i = 0; i < toks.length; i++) {
        const tok = toks[i].t, low = tok.toLowerCase();
        const finished = cands.filter((x) => x.done);
        const live = cands.filter((x) => !x.done && x.c.words.length > i);
        if (!live.length && finished.length) break;
        const lit = live.filter((x) => !x.c.words[i].startsWith("<") && x.c.words[i].startsWith(low));
        if (lit.length) {
            const exact = lit.filter((x) => x.c.words[i] === low);
            const pick = exact.length ? exact : lit;
            const kws = new Set(pick.map((x) => x.c.words[i]));
            if (kws.size > 1) return { error: "ambiguous", at: toks[i].at, tok };
            cands = [...pick, ...finished];
            continue;
        }
        const next = [...finished];
        for (const x of live) {
            const w = x.c.words[i];
            if (w === "<rest>") { x.args.push(line.slice(toks[i].at).trim()); x.done = true; next.push(x); continue; }
            if (w === "<if>") { x.args.push(line.slice(toks[i].at).trim()); x.done = true; x.isIf = true; next.push(x); continue; }
            if (VALID[w] && VALID[w](tok)) { x.args.push(tok); next.push(x); }
        }
        if (next.length === finished.length) return { error: "invalid", at: toks[i].at, i };
        cands = next;
    }
    const complete = cands.filter((x) => x.done || x.c.words.length === toks.length).sort((a, b) => a.done - b.done);
    if (!complete.length) return toks.length ? { error: "incomplete" } : { empty: true };
    return { cmd: complete[0].c, args: complete[0].args, isIf: complete[0].isIf };
}

// "?" help: what can come next.
function helpFor(line, mode, kind) {
    const endsSpace = /\s$/.test(line) || line === "";
    const toks = tokenize(line);
    const done = endsSpace ? toks : toks.slice(0, -1);
    const partial = endsSpace ? "" : toks[toks.length - 1].t.toLowerCase();
    let cands = CMDS.filter((c) => c.modes.includes(cmdMode(mode)) && (!c.only || c.only === kind));
    for (let i = 0; i < done.length; i++) {
        const low = done[i].t.toLowerCase();
        let lit = cands.filter((c) => c.words.length > i && !c.words[i].startsWith("<") && c.words[i].startsWith(low));
        if (lit.some((c) => c.words[i] === low)) lit = lit.filter((c) => c.words[i] === low);
        cands = lit.length ? lit : cands.filter((c) => c.words.length > i && c.words[i].startsWith("<") && (c.words[i] === "<rest>" || c.words[i] === "<if>" || VALID[c.words[i]](done[i].t)));
    }
    const i = done.length;
    const items = new Set();
    for (const c of cands) {
        if (c.words.length === i) items.add("<cr>");
        else if (c.words.length > i) {
            const w = c.words[i];
            if (w.startsWith("<")) { if (!partial) items.add(HELP_NAME[w] || w); } else if (w.startsWith(partial)) items.add(w);
        }
    }
    return [...items].sort((a, b) => (a === "<cr>") - (b === "<cr>") || a.localeCompare(b));
}

// ─── A device's terminal session ────────────────────────────────────────────
function Session() { return { mode: "user", ifc: null, line: null, out: [], hist: [], hi: -1, pend: null, connected: false, pinged: {} }; }

function makeCtx(app, id) {
    const def = app.lab.devices[id];
    const d = app.st.devs[id];
    const s = app.sess[id];
    const ctx = {
        id, d, s, kind: def.kind,
        print: (...ts) => { ts.forEach((t) => String(t).split("\n").forEach((l) => s.out.push(l))); },
        invalid: () => ctx.print("% Invalid input detected at '^' marker."),
        ask: (prompt, secret, fn, tries = 0) => { s.pend = { prompt, secret, fn, tries }; },
        linked: (port) => { const p = String(port).split(".")[0]; return app.lab.links.some(([a, ap, b, bp]) => (a === id && ap === p) || (b === id && bp === p)); },
        trunking: (port) => isTrunk(app.lab, app.st, id, port),
        logout: () => {
            s.mode = "user"; s.connected = false;
            ctx.print("", `${d.cfg.hostname} con0 is now available`, "", "", "", "", "", "Press RETURN to get started.");
        },
        saveStartup: () => { d.startup = JSON.stringify(d.cfg); },
        banner: (text) => {
            const delim = text[0];
            const rest = text.slice(1);
            const close = rest.indexOf(delim);
            if (close >= 0) { d.cfg.banner = rest.slice(0, close); return; }
            ctx.print(`Enter TEXT message.  End with the character '${delim}'.`);
            const lines = rest ? [rest] : [];
            const more = (v) => {
                const at = v.indexOf(delim);
                if (at >= 0) { lines.push(v.slice(0, at)); d.cfg.banner = lines.join("\n").trim(); return; }
                lines.push(v);
                ctx.ask("", false, more);
            };
            ctx.ask("", false, more);
        },
        iosPing: (t) => {
            const fam = ip2n(t) !== null ? 4 : 6;
            const r = ping(app.lab, app.st, id, t, fam);
            if (r.bad) return ctx.print("% Unrecognized host or address, or protocol not running.");
            const first = !s.pinged[t];
            s.pinged[t] = true;
            const marks = r.ok ? (first && r.owner.dev !== id ? ".!!!!" : "!!!!!") : ".....";
            const okCount = marks.split("").filter((m) => m === "!").length;
            ctx.print(`Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${fam === 4 ? normIp(t) : v6short(v6(t))}, timeout is 2 seconds:\n${marks}\nSuccess rate is ${okCount * 20} percent (${okCount}/5)${okCount ? ", round-trip min/avg/max = 0/0/1 ms" : ""}`);
        },
        tftp: (host, name) => {
            const target = Object.keys(app.lab.devices).find((k) => app.lab.devices[k].kind === "server" && app.st.devs[k].cfg.ip === normIp(host));
            const reach = ip2n(host) !== null && ping(app.lab, app.st, id, host, 4).ok;
            if (!target || !reach) return ctx.print(`%Error opening tftp://${host}/${name} (Timed out)`);
            const size = runningConfig(d, def.kind, d.cfg, false).length;
            const files = app.st.devs[target].cfg.files;
            const old = files.findIndex((f) => f.name === name);
            if (old >= 0) files.splice(old, 1);
            files.push({ name, size, from: d.cfg.hostname });
            ctx.print(`\nWriting running-config...!!\n[OK - ${size} bytes]\n\n${size} bytes copied in 3.011 secs (${Math.round(size / 3)} bytes/sec)`);
        },
        run: (line, asMode) => {
            const saved = s.mode;
            s.mode = asMode;
            const ok = execLine(ctx, line, true);
            if (s.mode === asMode) s.mode = saved;
            return ok;
        },
    };
    return ctx;
}

function prompt(ctx) { return ctx.d.cfg.hostname + MODE_SUFFIX[ctx.s.mode]; }

// Run one typed line in the current mode. Returns false if it was rejected.
function execLine(ctx, line, nested) {
    const s = ctx.s;
    const res = match(line, s.mode, ctx.kind);
    if (res.empty) return true;
    if (res.cmd) {
        if (res.isIf) {
            const name = normIf(res.args[0], ctx.d, ctx.kind);
            if (!name) { ctx.invalid(); return false; }
            res.args[0] = name;
        }
        // interface range: run the command once per port
        if (s.mode === "range" && s.range && !["exit", "end", "do"].includes(res.cmd.words[0])) {
            const list = s.range;
            for (const name of list) {
                s.ifc = name;
                res.cmd.run(ctx, res.args);
                if (s.mode !== "range") break;
            }
            if (s.mode === "range") s.ifc = list[0];
            return true;
        }
        res.cmd.run(ctx, res.args);
        return true;
    }
    // Global commands also work from interface/line mode (IOS drops back to global config).
    if (["if", "subif", "line", "range", "vlan"].includes(s.mode) && res.error !== "ambiguous") {
        const g = match(line, "config", ctx.kind);
        if (g.cmd && !["exit", "end"].includes(g.cmd.words[0])) {
            const before = { mode: s.mode, ifc: s.ifc, line: s.line, range: s.range, vlan: s.vlan };
            s.mode = "config"; s.ifc = null; s.line = null; s.range = null; s.vlan = null;
            if (g.isIf) {
                const name = normIf(g.args[0], ctx.d, ctx.kind);
                if (!name) { Object.assign(s, before); ctx.invalid(); return false; }
                g.args[0] = name;
            }
            g.cmd.run(ctx, g.args);
            return true;
        }
    }
    if (res.error === "ambiguous") ctx.print(`% Ambiguous command: "${line.trim()}"`);
    else if (res.error === "incomplete") ctx.print("% Incomplete command.");
    else {
        const toks = tokenize(line);
        if (!nested && (s.mode === "user" || s.mode === "priv") && toks.length === 1 && res.i === 0) {
            ctx.print(ctx.d.cfg.lookup
                ? `Translating "${toks[0].t}"...domain server (255.255.255.255)\n% Unknown command or computer name, or unable to find computer address`
                : `Translating "${toks[0].t}"\n% Unknown command or computer name, or unable to find computer address`);
        } else {
            ctx.print(`${" ".repeat((nested ? 0 : prompt(ctx).length) + res.at)}^`);
            ctx.invalid();
        }
    }
    return false;
}

// What the terminal does with one press of Enter.
function submit(app, id, raw) {
    const ctx = makeCtx(app, id);
    const s = ctx.s;
    if (!s.connected) {
        s.connected = true;
        s.mode = "user";
        if (ctx.d.cfg.banner) ctx.print(ctx.d.cfg.banner);
        const con = ctx.d.cfg.lines.con;
        if (con.login === "login" && con.pw) {
            ctx.print("", "User Access Verification", "");
            const check = (v, tries) => {
                if (v === con.pw) return;
                if (tries < 2) return "retry";
                ctx.print("% Bad passwords");
                s.connected = false;
            };
            s.pend = { prompt: "Password: ", secret: true, fn: check, tries: 0 };
        } else if (con.login === "local") {
            ctx.print("", "User Access Verification", "");
            const users = ctx.d.cfg.users;
            s.pend = { prompt: "Username: ", fn: (u) => {
                s.pend = { prompt: "Password: ", secret: true, fn: (p) => {
                    if (users[u] && users[u].pw === p) return;
                    ctx.print("% Login invalid", "");
                    s.connected = false;
                }, tries: 0 };
            }, tries: 0 };
        }
        return;
    }
    if (s.pend) {
        const p = s.pend;
        s.out.push(p.prompt + (p.secret ? "" : raw));
        s.pend = null;
        const r = p.fn(raw, p.tries);
        if (r === "retry") s.pend = { ...p, tries: p.tries + 1 };
        return;
    }
    s.out.push(prompt(ctx) + raw);
    if (raw.trim()) {
        s.hist.push(raw);
        if (s.hist.length > 50) s.hist.shift();
    }
    s.hi = -1;
    execLine(ctx, raw, false);
}

// ─── Host Command Prompt ────────────────────────────────────────────────────
function hostCommand(app, id, raw) {
    const c = app.st.devs[id].cfg;
    const out = [];
    const line = raw.trim();
    const [cmdWord, arg] = line.split(/\s+/);
    const low = (cmdWord || "").toLowerCase();
    if (!line) return out;
    if (low === "ipconfig") {
        out.push("", "FastEthernet0 Connection:(default port)", "",
            "   Connection-specific DNS Suffix..: ",
            `   Link-local IPv6 Address.........: ${v6short(autoLL(id, 9))}`,
            `   IPv6 Address....................: ${c.v6 ? v6short(c.v6) : "::"}`,
            `   IPv4 Address....................: ${c.ip || "0.0.0.0"}`,
            `   Subnet Mask.....................: ${c.mask || "0.0.0.0"}`,
            `   Default Gateway.................: ${c.v6gw ? v6short(c.v6gw) : "::"}`,
            `                                     ${c.gw || "0.0.0.0"}`, "");
    } else if (low === "ping") {
        if (!arg) { out.push("Usage: ping [-n count] <destination address>"); return out; }
        const fam = ip2n(arg) !== null ? 4 : v6(arg) ? 6 : 0;
        if (!fam) { out.push(`Ping request could not find host ${arg}. Please check the name and try again.`); return out; }
        const r = ping(app.lab, app.st, id, arg, fam);
        const s = app.sess[id];
        const first = !s.pinged[arg];
        s.pinged[arg] = true;
        const shown = fam === 4 ? normIp(arg) : v6short(v6(arg));
        const ttl = r.owner ? (app.lab.devices[r.owner.dev].kind === "router" ? 255 : r.routed ? 127 : 128) : 128;
        out.push("", `Pinging ${shown} with 32 bytes of data:`, "");
        let got = 0;
        for (let i = 0; i < 4; i++) {
            if (r.ok && !(i === 0 && first && r.routed)) { got++; out.push(`Reply from ${shown}: bytes=32 time<1ms TTL=${ttl}`); } else out.push("Request timed out.");
        }
        out.push("", `Ping statistics for ${shown}:`, `    Packets: Sent = 4, Received = ${got}, Lost = ${4 - got} (${(4 - got) * 25}% loss),`);
        if (got) out.push("Approximate round trip times in milli-seconds:", "    Minimum = 0ms, Maximum = 1ms, Average = 0ms");
        out.push("");
    } else if (low === "help" || low === "?") {
        out.push("Available commands:", "  ipconfig    Show this computer's addresses", "  ping        Send echo messages (ping 172.16.0.254)", "  cls         Clear the screen");
    } else if (low === "cls") {
        return null;
    } else {
        out.push("Invalid Command.");
    }
    return out;
}

// ─── Storage ────────────────────────────────────────────────────────────────
const KEY = (id) => `answrit:ptlab:${id}`;
function load(id, lab) {
    try {
        const raw = localStorage.getItem(KEY(id));
        if (raw) {
            const st = JSON.parse(raw);
            if (st && st.devs && Object.keys(lab.devices).every((k) => st.devs[k])) return upgradeState(st);
        }
    } catch (e) { /* storage unavailable */ }
    return freshState(lab);
}
function store(id, st) { try { localStorage.setItem(KEY(id), JSON.stringify(st)); } catch (e) { /* storage unavailable */ } }

// ─── Packet Tracer look ─────────────────────────────────────────────────────
// Original drawings in the style of Packet Tracer's workspace (no Cisco artwork is copied).
const DEV_ART = {
    router: `<defs><linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd3ec"/><stop offset="1" stop-color="#2b8fb3"/></linearGradient></defs>
        <ellipse cx="0" cy="5" rx="17" ry="7" fill="#1f6f8f"/><rect x="-17" y="-3" width="34" height="8" fill="#2b8fb3"/>
        <ellipse cx="0" cy="-3" rx="17" ry="7" fill="url(#gR)" stroke="#1f6f8f" stroke-width=".6"/>
        <path d="M-9 -5h6l-2 -2M9 -1h-6l2 2M-2 -8l3 -1.5M2 2l-3 1.5" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
    switch: `<defs><linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fdcf0"/><stop offset="1" stop-color="#3aa3c6"/></linearGradient></defs>
        <path d="M-18 -4l8 -6h28l-8 6z" fill="url(#gS)" stroke="#1f6f8f" stroke-width=".6"/>
        <path d="M-18 -4h28v9h-28z" fill="#2b8fb3"/><path d="M10 -4l8 -6v9l-8 6z" fill="#1f6f8f"/>
        <path d="M-10 -7h12l-2 -1.5M8 -5.5h-12l2 1.5" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
    pc: `<rect x="-12" y="-15" width="24" height="18" rx="1.5" fill="#d8dde3" stroke="#7d8790" stroke-width=".7"/>
        <rect x="-9.5" y="-12.5" width="19" height="12.5" fill="#5aa9d6"/>
        <path d="M-4 3h8l2 4h-12z" fill="#b9c1c9"/><rect x="-13" y="7" width="26" height="4" rx="1" fill="#c9d0d7" stroke="#7d8790" stroke-width=".5"/>`,
    laptop: `<path d="M-13 -12h26v15h-26z" fill="#d8dde3" stroke="#7d8790" stroke-width=".7"/><rect x="-11" y="-10.5" width="22" height="12" fill="#5aa9d6"/>
        <path d="M-16 3h32l-3 6h-26z" fill="#c9d0d7" stroke="#7d8790" stroke-width=".6"/><path d="M-9 5.5h18" stroke="#9aa4ad" stroke-width="1"/>`,
    server: `<defs><linearGradient id="gV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3aa3c6"/><stop offset="1" stop-color="#1f6f8f"/></linearGradient></defs>
        <rect x="-9" y="-17" width="18" height="32" rx="1.5" fill="url(#gV)" stroke="#185a74" stroke-width=".6"/>
        <path d="M-6 -12h12M-6 -8h12M-6 -4h12" stroke="#cdeef8" stroke-width="1.2"/><circle cx="0" cy="8" r="1.6" fill="#9ff0a6"/>`,
};
const MODEL_LABEL = { router: "2911", switch: "2960-24TT", pc: "PC-PT", server: "Server-PT" };
const DESK_APPS = {
    pc: ["IP Configuration", "Dial-up", "Terminal", "Command Prompt", "Web Browser", "PC Wireless", "VPN", "Traffic Generator", "MIB Browser", "Cisco IP Communicator", "Email", "PPPoE Dialer", "Text Editor", "Firewall", "IPv6 Firewall", "Netflow Collector", "IoX IDE", "TFTP Service", "Telnet / SSH Client", "Bluetooth"],
    server: ["IP Configuration", "Terminal", "Command Prompt", "Web Browser", "PC Wireless", "VPN", "AAA Accounting", "Traffic Generator", "MIB Browser", "Cisco IP Communicator", "Email", "PPPoE Dialer", "Text Editor", "Firewall", "IPv6 Firewall", "Netflow Collector", "IoX IDE", "Telnet / SSH Client", "IoT Monitor", "IoT IDE"],
};
const APP_GLYPH = {
    "IP Configuration": '<rect x="8" y="12" width="32" height="20" rx="2" fill="#eef6fb"/><text x="13" y="27" font-size="9" font-weight="700" fill="#1f4e79">106</text><rect x="27" y="17" width="9" height="11" fill="#9bc4e2"/>',
    "Command Prompt": '<rect x="7" y="10" width="34" height="26" rx="2" fill="#5e6b78"/><rect x="10" y="15" width="28" height="18" fill="#1d2228"/><text x="13" y="28" font-size="8" fill="#fff" font-family="monospace">run</text>',
    "Terminal": '<rect x="7" y="10" width="34" height="26" rx="2" fill="#5e6b78"/><rect x="10" y="15" width="28" height="18" fill="#2f3b48"/><path d="M14 20l5 4-5 4" stroke="#fff" stroke-width="2" fill="none"/>',
    "Web Browser": '<circle cx="24" cy="24" r="13" fill="#7cc6ef"/><path d="M11 24h26M24 11c-6 7-6 19 0 26M24 11c6 7 6 19 0 26" stroke="#fff" stroke-width="1.5" fill="none"/>',
    "Text Editor": '<rect x="12" y="9" width="22" height="30" fill="#fff" stroke="#555"/><path d="M15 15h16M15 20h16M15 25h12" stroke="#555"/><path d="M30 34l9-14 3 2-9 14z" fill="#e6b400"/>',
    "Email": '<rect x="9" y="15" width="30" height="20" fill="#fff8e1" stroke="#a07e2a"/><path d="M9 15l15 11 15-11" stroke="#a07e2a" fill="none"/>',
    "Bluetooth": '<circle cx="24" cy="24" r="14" fill="#1565c0"/><path d="M19 18l10 10-5 5V13l5 5-10 10" stroke="#fff" stroke-width="2" fill="none"/>',
    "TFTP Service": '<path d="M8 16h12l3 3h17v18H8z" fill="#f4b23e" stroke="#a46f12"/>',
};
const appGlyph = (name) => APP_GLYPH[name] || `<rect x="10" y="11" width="28" height="24" rx="3" fill="#eaf4fa" stroke="#7aa8c4"/><path d="M15 19h18M15 24h18M15 29h11" stroke="#7aa8c4" stroke-width="1.6"/>`;

function linkUp(app, l) {
    const end = (dev, port) => {
        const kind = app.lab.devices[dev].kind;
        return kind === "router" || kind === "switch" ? !app.st.devs[dev].cfg.ifaces[port].shut : true;
    };
    return end(l[0], l[1]) && end(l[2], l[3]);
}
function ptWorkspace(app) {
    const L = app.lab;
    if (L.wide) return ptWorkspaceWide(app);
    const lines = L.links.map((l) => {
        const a = L.devices[l[0]], b = L.devices[l[2]];
        const tri = (from, to, port, dev) => {
            const t = 0.28, x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
            const kind = L.devices[dev].kind;
            const on = (kind === "router" || kind === "switch" ? !app.st.devs[dev].cfg.ifaces[port].shut : true) && linkUp(app, l);
            return on ? `<path d="M${x - 3.6} ${y + 3}L${x} ${y - 3.6}L${x + 3.6} ${y + 3}Z" fill="#26c43b"/>` : `<path d="M${x - 3.6} ${y - 3}L${x} ${y + 3.6}L${x + 3.6} ${y - 3}Z" fill="#e5172b"/>`;
        };
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#111" stroke-width="1.3"/>${tri(a, b, l[1], l[0])}${tri(b, a, l[3], l[2])}`;
    }).join("");
    const devs = Object.entries(L.devices).map(([id, d]) => `
        <g class="pt-node" data-dev="${id}" transform="translate(${d.x} ${d.y})" role="button" tabindex="0" aria-label="${esc(d.label)}">
            <rect x="-22" y="-20" width="44" height="40" fill="transparent"/>
            ${DEV_ART[d.kind]}
            <text y="${d.kind === "server" ? 24 : 21}" class="pt-node-l">${esc(MODEL_LABEL[d.kind])}</text>
            <text y="${d.kind === "server" ? 33 : 30}" class="pt-node-l">${esc(d.label)}</text>
        </g>`).join("");
    return `<svg viewBox="0 0 360 236" class="pt-topo" aria-label="Logical workspace. Tap a device to open it.">${lines}${devs}</svg>`;
}
// Bigger canvas (scrolls on phones, like Packet Tracer) with the lab's notes and port labels.
function ptWorkspaceWide(app) {
    const L = app.lab, SC = 1.25;
    const on = (dev, port) => { const k = L.devices[dev].kind; return k === "router" || k === "switch" ? !app.st.devs[dev].cfg.ifaces[port].shut : true; };
    const lines = L.links.map((l) => {
        const a = L.devices[l[0]], b = L.devices[l[2]];
        const end = (from, to, port, dev) => {
            const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
            const tx = from.x + (dx / len) * 34, ty = from.y + (dy / len) * 34;
            const far = L.devices[dev].kind === "server" ? 66 : 46;
            const lx = from.x + (dx / len) * far + (dy / len) * 12, ly = from.y + (dy / len) * far - (dx / len) * 12;
            const up = on(dev, port) && on(l[0] === dev ? l[2] : l[0], l[0] === dev ? l[3] : l[1]);
            const tri = up ? `<path d="M${tx - 5} ${ty + 4}L${tx} ${ty - 5}L${tx + 5} ${ty + 4}Z" fill="#26c43b"/>` : `<path d="M${tx - 5} ${ty - 4}L${tx} ${ty + 5}L${tx + 5} ${ty - 4}Z" fill="#e5172b"/>`;
            return `${tri}<text x="${lx}" y="${ly + 3}" class="pt-port">${esc(shortIf(port).replace("Gig", "Gig").replace("FastEthernet0", "Fa0"))}</text>`;
        };
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#111" stroke-width="2.4" ${l[4] === "dash" ? 'stroke-dasharray="9 6"' : ""}/>${end(a, b, l[1], l[0])}${end(b, a, l[3], l[2])}`;
    }).join("");
    const notes = (L.notes || []).map((n) => {
        if (!n.box) return `<text x="${n.x}" y="${n.y}" class="pt-note-t" text-anchor="${n.a || "middle"}">${esc(n.t)}</text>`;
        const w = Math.max(...n.box.map((s) => s.length)) * 6.1 + 12, h = n.box.length * 12.5 + 8;
        return `<rect x="${n.x - 6}" y="${n.y - 13}" width="${w}" height="${h}" fill="#F4F6FB"/>` + n.box.map((s, i) => `<text x="${n.x}" y="${n.y + i * 12.5}" class="pt-note-t" text-anchor="start" xml:space="preserve">${esc(s)}</text>`).join("");
    }).join("");
    const devs = Object.entries(L.devices).map(([id, d]) => `
        <g class="pt-node" data-dev="${id}" transform="translate(${d.x} ${d.y})" role="button" tabindex="0" aria-label="${esc(d.label)}">
            <g transform="scale(${SC})"><rect x="-22" y="-20" width="44" height="40" fill="transparent"/>${DEV_ART[d.art || d.kind]}</g>
            <text y="${d.kind === "server" ? 33 : 29}" class="pt-node-l big">${esc(d.modelLabel || d.model || MODEL_LABEL[d.kind])}</text>
            <text y="${d.kind === "server" ? 45 : 41}" class="pt-node-l big">${esc(d.label)}</text>
        </g>`).join("");
    return `<svg viewBox="0 0 1010 490" class="pt-topo wide" aria-label="Logical workspace. Tap a device to open it.">${notes}${lines}${devs}</svg>`;
}
const hms = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, "0")).join(":");
const TB_ICONS = ["M4 3h11l5 5v13H4z", "M3 7h7l2 2h9v10H3z", "M5 4h12l2 2v14H5zM8 4v5h7V4", "M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z", "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8v.5M12 11v6", "M5 19l14-14M8 5H5v3M16 19h3v-3", "M9 4l-5 5 5 5M4 9h11a5 5 0 0 1 0 10h-3", "M15 4l5 5-5 5M20 9H9a5 5 0 0 0 0 10h3", "M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM14.5 14.5L20 20M7 10h6M10 7v6", "M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM14.5 14.5L20 20", "M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM14.5 14.5L20 20M7 10h6", "M3 5h18v12H3zM8 21h8"];

// ─── Mounting a lab ─────────────────────────────────────────────────────────
function mount(root, labId, { alive } = {}) {
    const lab = getLab(labId);
    if (!lab) { root.innerHTML = '<div class="error-box">This lab wasn\'t found.</div>'; return () => {}; }
    const app = { lab, st: load(labId, lab), sess: {}, open: null, tab: {}, desk: {}, page: {}, act: false, res: null, sug: true };
    if (typeof app.st.elapsed !== "number") app.st.elapsed = 0;
    Object.keys(lab.devices).forEach((k) => { app.sess[k] = Session(); app.sess[k].out.push("Press RETURN to get started!"); });
    const checks = lab.checks();
    const LIMIT = 4.5 * 3600;
    const timeText = () => (lab.countUp ? hms(app.st.elapsed) : hms(Math.max(0, LIMIT - app.st.elapsed)));
    const timeWord = lab.countUp ? "Time Elapsed" : "Time Left";
    let saveTimer = null;
    const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store(labId, app.st), 200); };
    const W = lab.worksheet;
    const short = (label) => label.replace(/^[^:]+: /, "");
    const score = () => {
        const res = checks.map((c) => ({ ...c, ok: !!c.test(app.st, lab) }));
        return { res, pct: Math.round((res.filter((r) => r.ok).length / res.length) * 100) };
    };

    root.innerHTML = `
        <div class="pt" id="pt">
            <div class="pt-titlebar">
                <a class="pt-exit" href="#/packet-tracer" aria-label="Leave the lab">✕</a>
                <span class="pt-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="pt-wtitle">Cisco Packet Tracer - ${esc(lab.file || "final_practice_27_oct_2020.pka")}</span>
            </div>
            <div class="pt-menu" aria-hidden="true">${["File", "Edit", "Options", "View", "Tools", "Extensions", "Window", "Help"].map((m) => `<span>${m}</span>`).join("")}</div>
            <div class="pt-tools" aria-hidden="true">${TB_ICONS.map((d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`).join("")}<span class="pt-q">?</span></div>
            <div class="pt-modebar">
                <button type="button" class="pt-pill on">Logical</button>
                <button type="button" class="pt-pill" data-nope="Physical view">Physical</button>
                <span class="pt-xy">x: 256, y: 7</span>
                <span class="pt-spacer"></span>
                <span class="pt-root">Root</span>
                <span class="pt-clock" aria-hidden="true">16:00:00</span>
            </div>
            <div class="pt-canvas" id="pt-canvas"></div>
            <div class="pt-timebar">
                <span class="pt-time">Time: <b id="pt-time">00:00:00</b></span>
                <span class="pt-round" aria-hidden="true">⟳</span><span class="pt-round" aria-hidden="true">⏩</span>
                <span class="pt-spacer"></span>
                <button type="button" class="pt-pill on">Realtime</button>
                <button type="button" class="pt-pill" data-nope="Simulation mode">Simulation</button>
            </div>
            <div class="pt-tray" aria-hidden="true">
                <div class="pt-tray-cats">${["#5bb7d6", "#4ea7c9", "#3f8fb3", "#f2c200", "#3fa0c4", "#59b4d4"].map((c) => `<i style="background:${c}"></i>`).join("")}</div>
                <div class="pt-tray-models">${["PT8200", "4331", "4321", "IR8340", "1941", "2901", "2911"].map((m) => `<span><i></i>${m}</span>`).join("")}</div>
                <div class="pt-tray-pdu"><span>Scenario 0</span><span>Fire</span><span>Last Status</span><span>Source</span><span>Destination</span><span>Type</span><span>Color</span><span>Time(sec)</span></div>
            </div>
            <div class="pt-act" id="pt-act"></div>
            <div class="pt-layer" id="pt-win" hidden></div>
            <div class="pt-layer" id="pt-res" hidden></div>
            <div class="pt-note" id="pt-note" role="status" aria-live="polite"></div>
        </div>`;
    const $c = (sel) => $(sel, root);
    const winEl = $c("#pt-win"), resEl = $c("#pt-res"), actEl = $c("#pt-act"), noteEl = $c("#pt-note");
    let noteTimer = null;
    const note = (t) => { noteEl.textContent = t; noteEl.classList.add("show"); clearTimeout(noteTimer); noteTimer = setTimeout(() => noteEl.classList.remove("show"), 2200); };
    $$("[data-nope]", root).forEach((b) => { b.onclick = () => note(`${b.dataset.nope} isn't part of this practice lab.`); });

    function drawCanvas() {
        const c = $c("#pt-canvas");
        c.innerHTML = ptWorkspace(app);
        $$(".pt-node", c).forEach((n) => {
            n.onclick = () => openDevice(n.dataset.dev);
            n.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDevice(n.dataset.dev); } };
        });
    }

    // ── Clock: workspace time counts up, PT Activity "Time Left" counts down.
    const tick = setInterval(() => {
        if (alive && !alive()) return;
        app.st.elapsed += 1;
        const t = $c("#pt-time"); if (t) t.textContent = hms(app.st.elapsed);
        $$("[data-left]", root).forEach((el) => { el.textContent = timeText(); });
        if (app.st.elapsed % 10 === 0) save();
    }, 1000);

    // ── PT Activity window (instructions)
    function renderAct() {
        const { pct } = score();
        const left = timeText();
        actEl.className = `pt-act ${app.act ? "open" : ""}`;
        actEl.innerHTML = app.act ? `
            <div class="pt-win act-win" role="dialog" aria-label="PT Activity">
                <div class="pt-wbar"><button type="button" class="pt-wdot red" id="act-min" aria-label="Minimize"></button><i class="pt-wdot yel"></i><i class="pt-wdot grn"></i><span>PT Activity: <span data-left>${left}</span></span></div>
                <div class="act-doc">${actDoc()}</div>
                <div class="act-foot">
                    <div class="act-row"><span>${timeWord}: <span data-left>${left}</span></span><span>Completion: <b>${pct}%</b></span></div>
                    <div class="act-row">
                        <label class="pt-chk"><input type="checkbox" disabled> Top</label>
                        <label class="pt-chk"><input type="checkbox" checked disabled> Dock</label>
                        <button type="button" class="pt-navy" id="act-check">Check Results</button>
                        <span class="pt-spacer"></span>
                        <button type="button" class="pt-navy" disabled>Back</button><span class="act-page">1/1</span><button type="button" class="pt-navy" disabled>Next</button>
                    </div>
                </div>
            </div>` : `
            <button type="button" class="act-mini" id="act-open">
                <span class="act-mini-t">PT Activity <small>${timeWord}: <span data-left>${left}</span></small></span>
                <span class="act-mini-c">Completion: <b>${pct}%</b></span>
                <span class="pt-navy small" id="act-check2">Check Results</span>
                <span class="act-mini-up" aria-hidden="true">▲</span>
            </button>`;
        if (app.act) {
            $("#act-min", actEl).onclick = () => { app.act = false; renderAct(); };
            $("#act-check", actEl).onclick = () => openResults();
            bindDoc();
        } else {
            $("#act-open", actEl).onclick = (e) => { if (e.target.id === "act-check2") return openResults(); app.act = true; renderAct(); };
        }
    }

    function actDoc() {
        if (lab.ver) return vlanDoc();
        const sh = app.st.sheet || (app.st.sheet = {});
        const cell = (r, k) => {
            if (r.given === k) return `<b>${esc(r[k])}</b>`;
            const key = `${r.sn}-${k}`, v = sh[key] || "";
            const mark = app.sheetChecked && v.trim() ? (normCell(k, v) === normCell(k, r[k]) ? "ok" : "no") : "";
            return `<input class="doc-in ${mark}" data-key="${key}" value="${esc(v)}" autocomplete="off" autocapitalize="none" spellcheck="false" inputmode="${k === "range" ? "text" : "decimal"}" aria-label="SN ${r.sn} ${k}">`;
        };
        const design = (title, rows) => `<tr><th colspan="2" class="dt">${title}</th></tr>${rows}`;
        const blank = (a, b) => `<tr><td class="ph">${a}</td><td class="ph">${b}</td></tr>`;
        return `
            <p class="doc-banner">PRACTICE SKILLS!!! PRACTICE SKILLS!!! PRACTICE SKILLS!!!</p>
            <p><b>Step 1: Determine the IP Addressing Scheme.</b> Design an IPv4 addressing scheme and complete the Addressing Table based on the following requirements.</p>
            <ul class="doc-dots">
                <li>Subnet the <b class="r">172.16.0.0/16</b> network to provide <b class="r">60</b> host addresses per subnet, for the first four subnets, while wasting the fewest addresses.</li>
                <li>Starting with the fifth subnet, subnet the network again so that the next 4 subnets will provide <b class="r">12</b> host addresses per subnet while wasting the fewest addresses.</li>
            </ul>
            <div class="doc-scroll"><table class="doc-t">
                <tr><th>SN</th><th>Assignment</th><th>Subnet Address</th><th>Assignable Address Range</th><th>Broadcast Address</th><th>Subnet Mask</th></tr>
                ${W.rows.map((r) => `${r.split ? '<tr class="gap"><td colspan="6"></td></tr>' : ""}<tr>
                    <td class="${r.label ? "hl" : ""}">${r.sn}</td><td class="${r.label ? "hl" : ""}">${esc(r.label)}</td>
                    <td>${cell(r, "net")}</td><td>${cell(r, "range")}</td><td>${cell(r, "bc")}</td><td>${cell(r, "mask")}</td></tr>`).join("")}
            </table></div>
            <p class="doc-tools"><button type="button" class="pt-navy small" id="doc-check">Check my table</button> <button type="button" class="pt-link" id="doc-show">${app.sheetReveal ? "Hide answers" : "Show answers"}</button><span class="doc-hint">(AnswrIT extra: type in the blank cells.)</span></p>
            ${app.sheetReveal ? `<div class="doc-scroll"><table class="doc-t ans">${W.rows.map((r) => `<tr><td>${r.sn}</td><td>${r.net}</td><td>${r.range}</td><td>${r.bc}</td><td>${r.mask}</td></tr>`).join("")}</table></div>` : ""}
            <p><b>Step 2: IP Address Assignment Design</b>. Determine how to assign the IP addresses and record your addressing scheme in the table below based on the instructions. Use the table above to help you organize your work.</p>
            <ul class="doc-dots">
                <li>The first three subnets will not be used for this lab.</li>
                <li><b>LAN 1:</b> <span class="hl">IT A SCHOOL</span> (SN: 3): This subnet is connected to the <b>G0/0</b> interface of the <b>Router</b>. The G0/0 interface should be assigned the <b>LAST USABLE</b> in its subnet for its IP address.</li>
                <li><b>LAN 2:</b> <span class="hl">IT C SCHOOL</span> (SN: 5): This subnet is connected to the <b>G0/1</b> interface of the <b>Router</b>. The G0/1 interface should be assigned the <b>LAST USABLE</b> in its subnet for its IP address.</li>
                <li>The <b>Switch</b> will use the <b>the next to last</b> usable address for the VLAN IP address. Configure the hosts with the first usable respectively of their respective subnet.</li>
            </ul>
            <div class="doc-scroll"><table class="doc-t design">
                <tr><th>Router interface – G 0/0</th><th>Router interface – G 0/1</th></tr>
                <tr><td class="hlc"><b>LAN 1: IT A School</b></td><td class="hlc"><b>LAN 2: IT C School</b></td></tr>
                <tr><td class="ph">IP address &nbsp; Subnet mask</td><td class="ph">IP address &nbsp; Subnet mask</td></tr>
                <tr><td>IPv6 address/prefix <b>2001:DB8:ACAD:0001::1/64</b></td><td>IPv6 address/prefix <b>2001:DB8:ACAD:0002::1/64</b></td></tr>
                <tr><th>Switch – VLAN 1 – ITA</th><th>Switch – VLAN 1 – ITC</th></tr>
                <tr><td class="ph">IP address &nbsp; Subnet mask</td><td class="ph">IP address &nbsp; Subnet mask</td></tr>
                <tr><td class="ph">Default Gateway</td><td class="ph">Default Gateway</td></tr>
                <tr><th>Host 0</th><th>Host 2</th></tr>
                <tr><td class="ph">IP address &nbsp; Subnet mask</td><td class="ph">IP address &nbsp; Subnet mask</td></tr>
                <tr><td class="ph">Default Gateway</td><td class="ph">Default Gateway</td></tr>
                <tr><td>IPv6 address/prefix <b>2001:DB8:ACAD:0001::FE/64</b></td><td>IPv6 address/prefix <b>2001:DB8:ACAD:0002::FE/64</b></td></tr>
                <tr><th>Host 1</th><th>Server</th></tr>
                <tr><td class="ph">IP address &nbsp; Subnet mask</td><td class="ph">IP address &nbsp; Subnet mask</td></tr>
                <tr><td class="ph">Default Gateway</td><td class="ph">Default Gateway</td></tr>
                <tr><td>IPv6 address/prefix <b>2001:DB8:ACAD:0001::FF/64</b></td><td>IPv6 address/prefix <b>2001:DB8:ACAD:0002::FF/64</b></td></tr>
            </table></div>
            <p><b>Step 3: Configure the Router.</b> Configure the Router with all initial configuration settings.</p>
            <p><b>1. Configure Basic Device Settings</b></p>
            <ol type="a" class="doc-ol">
                <li>Console into the router</li><li>Name the Router <span class="r">IT_Router</span>.</li><li>Disable DNS lookup</li>
                <li>Assign <span class="r">ccna1</span> as the privileged EXEC encrypted password.</li><li>Assign <span class="r">cisco</span> as the console and VTY passwords.</li>
                <li>Prevent all passwords from being viewed in clear text.</li><li>Create a banner that reads: <span class="r">AUTHORIZED ACCESS ONLY!</span></li>
                <li>Configure and activate the interfaces on the router using the information contained in the addressing table.</li>
                <li>Add a description to each interface describing the LAN they are connected to.</li><li>Save the configuration to the NVRAM.</li>
            </ol>
            <p><b>2. Configure Basic Security Measures on the Router</b></p>
            <p class="doc-ind">a. Strengthen passwords and security.</p>
            <ul class="doc-dots ind2">
                <li>Require that a minimum of <b class="r">10</b> characters be used for all passwords.</li>
                <li>Protect against brute force login attempts: block logins for 5 minutes if 3 failed attempts within 60 seconds</li>
                <li>Configure the console and vty line to log out of a connection that has been idle for 5 minutes.</li>
            </ul>
            <p class="doc-ind">a. Enable SSH connections.</p>
            <ul class="doc-dots ind2">
                <li>Assign the domain name : <span class="r">ITTN.navy</span></li>
                <li>Create a local SSH user and password. The user should have administrator-level access.<br><b>User name</b>: <span class="r">Administrator</span> <b>Password</b>: <span class="r">CCNAIntroNet11!!</span></li>
                <li>Configure the transport input for the vty lines so they accept SSH connections, but do not allow Telnet connections.</li>
                <li>The vty lines should use the local user database for authentication.</li>
                <li>Generate a RSA crypto key using a modulus of 1024 bits.</li>
            </ul>
            <p><b>3. Configure Interfaces on the Router.</b></p>
            <ol type="a" class="doc-ol">
                <li>Assign the Ipv4 and Ipv6 addresses as per the addressing table. Configure a description to show which LAN each interface belongs to. Activate the interface.</li>
                <li>To get the link-local address to match the unicast address on the interface, manually enter the link-local addresses on each of the interfaces. (FE80::1)</li>
                <li>Enable Ipv6 routing.</li>
            </ol>
            <p><b>4. Configure the Switch for remote management.</b></p>
            <ol type="a" class="doc-ol">
                <li>Console into the switch</li><li>Name the Switches (ITA, ITC) according to the LAN's.</li>
                <li>Configure and activate the VLAN 1 interface with the addresses listed in the address configuration table. Annotate an interface description and activate the interface.</li>
                <li>Assign the default gateway.</li><li>Configure a vty and console access.</li>
            </ol>
            <p><b>5. Configure and Verify Host Addressing</b></p>
            <ol type="a" class="doc-ol">
                <li>Use the Ipv4 and Ipv6 values provided in the addressing table to configure all host PCs with the correct addressing.</li>
                <li>Use the router interface link-local addresses as the IPv6 default gateways on the hosts.</li>
                <li>Verify all hosts can ping each other over IPv4.</li>
            </ol>
            <p><b>6. Backup the Configuration of the Router to TFTP.</b></p>
            <ol type="a" class="doc-ol"><li>Backup the running configuration of the router to the TFTP Server (Server).</li><li>Use the default name.</li></ol>
            <p class="doc-red">Once you have completed all steps and have a successful ping between all hosts, check activity with check results.</p>
            <details class="doc-help"><summary>AnswrIT help: show the commands for each part</summary>
                ${lab.help.map(([t, code]) => `<p><b>${esc(t)}</b></p><pre>${esc(code)}</pre>`).join("")}
                <p><b>Full address plan</b></p><pre>${esc(W.design.map(([who, ip, mask, gw, six]) => `${who}: ${ip} ${mask}${gw ? `  gw ${gw}` : ""}${six ? `  ${six}` : ""}`).join("\n"))}</pre>
            </details>`;
    }
    function vlanDoc() {
        const P = lab.P, A = lab.answer;
        const vers = Array.from({ length: VLAN_VERSIONS }, (_, i) => i + 1);
        const reqs = lab.reqs.slice(1).join("\n").replace(/\n {2}/g, " ").split("\n");
        return `
            <div class="doc-ver">
                <b>Version:</b>
                ${vers.map((v) => `<button type="button" class="doc-vbtn ${lab.ver === v ? "on" : ""}" data-ver="${v}">${v}${v === 1 ? " · class" : ""}</button>`).join("")}
                <button type="button" class="doc-vbtn ${lab.ver > VLAN_VERSIONS ? "on" : ""}" data-ver="new">${lab.ver > VLAN_VERSIONS ? `#${lab.ver} · ` : ""}New random</button>
            </div>
            <p class="doc-hint">Every version has the same steps and the same 48 graded items as the real activity. Only the names, VLANs, networks, ports and passwords change. Version 1 is the practice file from class.</p>
            <p>In the real activity this window is empty: everything is written on the map. Here is the same information in one place.</p>
            <p><b>Requirements</b></p>
            <ul class="doc-dots">${reqs.map((r) => `<li>${esc(r.replace(/^- /, ""))}</li>`).join("")}</ul>
            <p><b>VLANs</b></p>
            <div class="doc-scroll"><table class="doc-t"><tr><th>VLAN</th><th>Name</th><th>Network</th></tr>
                ${[[P.A, P.nameA, P.netA, P.pA], [P.B, P.nameB, P.netB, P.pB], [P.N, P.nameN, P.netN, P.pN]].map(([v, n, net, pf]) => `<tr><td>${v}</td><td>${esc(n)}</td><td>${net}/${pf}</td></tr>`).join("")}
            </table></div>
            <p><b>Also on the map</b></p>
            <ul class="doc-dots">
                <li>Server link (${esc(lab.devices.R.label)} to ${esc(P.server)}): <b>${P.link}/30</b> and <b>${esc(P.v6show)}/64</b>. The server is labeled <b>1st</b>.</li>
                <li>Next to ${esc(lab.devices.R.label)}: <b>::${esc(P.rid)}</b> (its IPv6 host part) and link-local <b>${esc(P.ll)}</b>.</li>
                <li>Switches are labeled 1ST / 2ND / 3RD, PCs and laptops 1st / 2nd. Port names are shown on every cable.</li>
            </ul>
            <p><b>Rules the lab doesn't write down</b></p>
            <ul class="doc-dots">
                <li>The router gets the <b>last usable</b> address in every network (each VLAN and the server link).</li>
                <li>"1st", "2nd", "3rd" mean the first, second and third <b>usable</b> address of that device's network. Switches use the ${esc(P.nameN)} VLAN (${P.N}).</li>
                <li>The server's IPv6 address is the first one: <b>${esc(P.v6show)}1/64</b>. Its IPv6 gateway is the router's link-local address.</li>
                <li>Router console and VTY password: <b>cisco</b>. Enable secret: <b>class</b>.</li>
                <li>Native VLAN on every trunk, including the link to the router. The router uses one subinterface per VLAN, numbered like the VLAN.</li>
            </ul>
            <p class="doc-tools"><button type="button" class="pt-navy small" id="doc-reset">Start this version over</button></p>
            <details class="doc-help"><summary>AnswrIT help: show the answers</summary>
                <p><b>Address plan</b></p>
                <div class="doc-scroll"><table class="doc-t"><tr><th>Device</th><th>IPv4</th><th>Mask</th><th>Other</th></tr>
                    ${A.plan.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("")}</table></div>
                ${A.help.map(([title, code]) => `<p><b>${esc(title)}</b></p><pre>${esc(code)}</pre>`).join("")}
                <p class="doc-hint">PCs, laptops and the server: Desktop, then IP Configuration (IPv4 address, mask, gateway and DNS server).</p>
            </details>`;
    }
    const normCell = (k, v) => k === "range" ? String(v).split(/\s*(?:-|–|to)\s*/).map(normIp).join("-") : normIp(v);
    function bindDoc() {
        if (lab.ver) {
            $$("[data-ver]", actEl).forEach((b) => {
                b.onclick = () => {
                    const v = b.dataset.ver === "new" ? VLAN_VERSIONS + 1 + Math.floor(Math.random() * 9000) : +b.dataset.ver;
                    store(labId, app.st);
                    location.hash = `#/packet-tracer/lab/${v === 1 ? VLAN_LAB : `${VLAN_LAB}-${v}`}`;
                };
            });
            $("#doc-reset", actEl).onclick = () => {
                if (!window.confirm("Start this version over? Everything you configured in it will be erased.")) return;
                app.st = freshState(lab); app.st.elapsed = 0;
                Object.keys(lab.devices).forEach((k) => { app.sess[k] = Session(); app.sess[k].out.push("Press RETURN to get started!"); });
                closeDevice(); store(labId, app.st); update(); renderAct();
            };
            return;
        }
        const sh = app.st.sheet;
        $$(".doc-in", actEl).forEach((inp) => { inp.oninput = () => { sh[inp.dataset.key] = inp.value; inp.classList.remove("ok", "no"); save(); }; });
        const keepScroll = (fn) => { const d = $(".act-doc", actEl), top = d.scrollTop; fn(); renderAct(); $(".act-doc", actEl).scrollTop = top; };
        $("#doc-check", actEl).onclick = () => keepScroll(() => { app.sheetChecked = true; });
        $("#doc-show", actEl).onclick = () => keepScroll(() => { app.sheetReveal = !app.sheetReveal; });
    }

    // ── Activity Results
    function openResults(tab = "overall") {
        app.res = tab;
        resEl.hidden = false;
        renderResults();
    }
    function renderResults() {
        const { res, pct } = score();
        const tab = app.res;
        const tests = [];
        const pairs = lab.conn || ["H0", "H1", "H2", "SV"].flatMap((a, i, h) => h.slice(i + 1).map((b) => [a, b]));
        pairs.forEach(([a, b]) => tests.push({ a, b, ok: !!app.st.devs[b].cfg.ip && ping(lab, app.st, a, app.st.devs[b].cfg.ip, 4).ok }));
        const groups = [];
        res.forEach((r) => {
            const name = lab.devices[r.dev].label;
            let g = groups.find((x) => x.name === name);
            if (!g) groups.push(g = { name, items: [] });
            g.items.push(r);
        });
        resEl.innerHTML = `
            <div class="pt-win res-win" role="dialog" aria-label="Activity Results">
                <div class="pt-wbar"><button type="button" class="pt-wdot red" id="res-x" aria-label="Close"></button><i class="pt-wdot yel"></i><i class="pt-wdot grn"></i><span>Activity Results</span></div>
                <div class="pt-tabs">${[["overall", "Overall Feedback"], ["items", "Assessment Items"], ["conn", "Connectivity Tests"]].map(([k, l]) => `<button type="button" data-rt="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
                <div class="res-body">
                    ${tab === "overall" ? `
                        <div class="res-box">
                            <p>${pct === 100 ? "Congratulations! You completed the activity." : "Keep trying. Your activity is not yet complete."}</p>
                            <p>Time Elapsed: ${hms(app.st.elapsed)}</p>
                            <p>Completion: ${pct}%</p>
                            <p>Assessment items correct: ${res.filter((r) => r.ok).length} of ${res.length}</p>
                        </div>` : tab === "items" ? `
                        <table class="res-t"><tr><th>Assessment Items</th><th>Status</th></tr>
                            <tr class="grp"><td colspan="2">▾ Network</td></tr>
                            ${groups.map((g) => `<tr class="grp"><td colspan="2">&nbsp;&nbsp;▾ ${esc(g.name)}</td></tr>
                                ${g.items.map((r) => `<tr><td class="it">${esc(short(r.label))}</td><td class="${r.ok ? "ok" : "no"}">${r.ok ? "Correct" : "Incorrect"}</td></tr>`).join("")}`).join("")}
                        </table>` : `
                        ${lab.conn ? `<p class="res-note">This activity has no connectivity tests in Packet Tracer either. AnswrIT extra: these pings show whether your VLANs and routing work. They don't count toward the score.</p>` : ""}
                        <table class="res-t"><tr><th>Connectivity Tests</th><th>Status</th></tr>
                            ${tests.map((t) => `<tr><td class="it">Ping ${esc(lab.devices[t.a].label)} → ${esc(lab.devices[t.b].label)}</td><td class="${t.ok ? "ok" : "no"}">${t.ok ? "Correct" : "Incorrect"}</td></tr>`).join("")}
                        </table>`}
                </div>
                <div class="res-foot"><button type="button" class="pt-navy" id="res-ok">OK</button></div>
            </div>`;
        $$("[data-rt]", resEl).forEach((b) => { b.onclick = () => { app.res = b.dataset.rt; renderResults(); }; });
        const close = () => { app.res = null; resEl.hidden = true; resEl.innerHTML = ""; };
        $("#res-x", resEl).onclick = close;
        $("#res-ok", resEl).onclick = close;
    }

    // Everything that shows the score/lights.
    function update() {
        save();
        drawCanvas();
        const c = $(".act-mini-c b", actEl) || $(".act-row b", actEl);
        if (c) c.textContent = `${score().pct}%`;
    }

    // ── Device windows
    function openDevice(id) {
        app.open = id;
        winEl.hidden = false;
        document.body.classList.add("lab-sheet-open");
        renderWin();
    }
    function closeDevice() {
        app.open = null;
        winEl.hidden = true;
        winEl.innerHTML = "";
        document.body.classList.remove("lab-sheet-open");
    }
    const TABS = {
        router: ["Physical", "Config", "CLI", "Attributes"],
        switch: ["Physical", "Config", "CLI", "Attributes"],
        pc: ["Physical", "Config", "Desktop", "Programming", "Attributes"],
        server: ["Physical", "Config", "Services", "Desktop", "Programming", "Attributes"],
    };
    function renderWin() {
        const id = app.open, def = lab.devices[id];
        const tabs = TABS[def.kind];
        const tab = app.tab[id] || (def.kind === "router" || def.kind === "switch" ? "CLI" : "Desktop");
        winEl.innerHTML = `
            <div class="pt-win dev-win" role="dialog" aria-label="${esc(def.label)}">
                <div class="pt-wbar"><button type="button" class="pt-wdot red" id="win-x" aria-label="Close ${esc(def.label)}"></button><i class="pt-wdot yel"></i><i class="pt-wdot grn"></i><span>${esc(def.label)}</span></div>
                <div class="pt-tabs">${tabs.map((t) => `<button type="button" data-tab="${t}" class="${t === tab ? "on" : ""}">${t}</button>`).join("")}</div>
                <div class="win-body" id="win-body"></div>
                <div class="win-foot"><label class="pt-chk"><input type="checkbox" disabled> Top</label></div>
            </div>`;
        $("#win-x", winEl).onclick = closeDevice;
        $$("[data-tab]", winEl).forEach((b) => { b.onclick = () => { app.tab[id] = b.dataset.tab; renderWin(); }; });
        const body = $("#win-body", winEl);
        if (tab === "CLI") cliTab(body, id);
        else if (tab === "Desktop") desktopTab(body, id);
        else if (tab === "Config") configTab(body, id);
        else if (tab === "Services") servicesTab(body, id);
        else if (tab === "Physical") physicalTab(body, id);
        else if (tab === "Programming") body.innerHTML = `<div class="prog"><div class="prog-top"><b>No Project Opened</b><span>Open New Delete Rename Import</span></div><div class="prog-main"><div></div><div></div></div><div class="prog-out">Serial Outputs</div></div>`;
        else attributesTab(body, id);
    }

    // CLI tab: white "IOS Command Line Interface" box, typing inline after the prompt.
    function cliTab(body, id) {
        const s = app.sess[id];
        const ctx = () => makeCtx(app, id);
        body.innerHTML = `
            <div class="cli">
                <div class="cli-head">IOS Command Line Interface</div>
                <div class="cli-box" id="cli-box">
                    <pre id="cli-out"></pre>
                    <form class="cli-line" id="cli-form" autocomplete="off"><span id="cli-ps"></span><input id="cli-in" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Command"></form>
                </div>
                <div class="cli-assist">
                    <label class="pt-chk"><input type="checkbox" id="cli-sug-on" ${app.sug ? "checked" : ""}> Suggestions</label>
                    <div class="cli-sug" id="cli-sug"></div>
                    <div class="cli-keys">${[["Tab", "Tab"], ["ArrowUp", "↑"], ["ArrowDown", "↓"], ["?", "?"], ["ctrlz", "Ctrl+Z"]].map(([k, l]) => `<button type="button" data-key="${k}">${l}</button>`).join("")}</div>
                </div>
                <div class="cli-btns"><button type="button" class="pt-btn" id="cli-copy">Copy</button><button type="button" class="pt-btn" id="cli-paste">Paste</button></div>
            </div>`;
        const out = $("#cli-out", body), box = $("#cli-box", body), input = $("#cli-in", body), sug = $("#cli-sug", body);
        const paint = () => {
            out.textContent = s.out.slice(-600).join("\n");
            $("#cli-ps", body).textContent = !s.connected ? "" : s.pend ? s.pend.prompt : prompt(ctx());
            input.type = s.pend && s.pend.secret ? "password" : "text";
            box.scrollTop = box.scrollHeight;
            paintSug();
        };
        const paintSug = () => {
            if (!app.sug) { sug.innerHTML = ""; return; }
            let items = [];
            if (!s.connected) items = [{ label: "⏎ Press RETURN", run: true }];
            else if (s.pend) items = [{ hint: s.pend.secret ? "Type the password, then Enter" : "Type your answer, then Enter (blank = default)" }];
            else {
                helpFor(input.value, s.mode, ctx().kind).forEach((it) => {
                    if (it === "<cr>") items.push({ label: "⏎ Enter", run: true });
                    else if (/^[a-z0-9:-]+$/.test(it)) items.push({ label: it, ins: it });
                    else items.push({ hint: it.split("  ")[0] });
                });
            }
            sug.innerHTML = items.slice(0, 40).map((it) => it.hint ? `<span class="cli-hint">${esc(it.hint)}</span>`
                : `<button type="button" class="cli-chip ${it.run ? "run" : ""}" data-ins="${esc(it.ins || "")}" ${it.run ? 'data-run="1"' : ""}>${esc(it.label)}</button>`).join("");
            $$(".cli-chip", sug).forEach((b) => {
                b.onmousedown = (e) => e.preventDefault();
                b.onclick = () => {
                    if (b.dataset.run) return run();
                    const v = input.value;
                    input.value = (/\s$/.test(v) || !v ? v : v.replace(/\S+$/, "")) + b.dataset.ins + " ";
                    input.focus({ preventScroll: true });
                    paintSug();
                };
            });
        };
        const enter = (v) => {
            if (s.connected && !s.pend && /\?\s*$/.test(v)) {
                const line = v.replace(/\?\s*$/, "");
                s.out.push(prompt(ctx()) + v);
                helpFor(line, s.mode, ctx().kind).forEach((it) => s.out.push(`  ${it}`));
                return line;
            }
            submit(app, id, v);
            update();
            return "";
        };
        const run = () => { const keep = enter(input.value); input.value = keep; paint(); input.focus({ preventScroll: true }); };
        $("#cli-form", body).onsubmit = (e) => { e.preventDefault(); run(); };
        input.oninput = paintSug;
        const key = (k, e) => {
            if (k === "?") {
                if (e) e.preventDefault();
                if (!s.connected || s.pend) return;
                s.out.push(prompt(ctx()) + input.value + "?");
                helpFor(input.value, s.mode, ctx().kind).forEach((it) => s.out.push(`  ${it}`));
                paint();
            } else if (k === "Tab") {
                if (e) e.preventDefault();
                const line = input.value;
                if (/\s$/.test(line) || !line) return;
                const items = helpFor(line, s.mode, ctx().kind).filter((x) => /^[a-z0-9:-]+$/.test(x));
                if (items.length === 1) { input.value = line.replace(/\S+$/, items[0]) + " "; paintSug(); }
            } else if (k === "ArrowUp" || k === "ArrowDown") {
                if (e) e.preventDefault();
                if (!s.hist.length) return;
                if (k === "ArrowUp") s.hi = s.hi < 0 ? s.hist.length - 1 : Math.max(0, s.hi - 1);
                else s.hi = s.hi < 0 ? -1 : s.hi + 1 >= s.hist.length ? -1 : s.hi + 1;
                input.value = s.hi < 0 ? "" : s.hist[s.hi];
                paintSug();
            } else if (k === "ctrlz") {
                if (e) e.preventDefault();
                if (CFG_MODES.includes(s.mode)) {
                    s.out.push(prompt(ctx()) + "^Z");
                    s.mode = "priv"; s.ifc = null; s.line = null; s.range = null;
                    s.out.push("%SYS-5-CONFIG_I: Configured from console by console");
                    paint();
                }
            }
        };
        input.onkeydown = (e) => {
            if (e.key === "?" || e.key === "Tab" || e.key === "ArrowUp" || e.key === "ArrowDown") key(e.key, e);
            else if (e.key === "z" && e.ctrlKey) key("ctrlz", e);
        };
        $$("[data-key]", body).forEach((b) => {
            b.onmousedown = (e) => e.preventDefault();
            b.onclick = () => { key(b.dataset.key); input.focus({ preventScroll: true }); };
        });
        $("#cli-sug-on", body).onchange = (e) => { app.sug = e.target.checked; paintSug(); };
        box.onclick = () => { if (!window.getSelection().toString()) input.focus({ preventScroll: true }); };
        $("#cli-copy", body).onclick = async () => {
            try { await navigator.clipboard.writeText(s.out.join("\n")); note("Copied the CLI text."); } catch (e) { note("Couldn't copy here. Select the text instead."); }
        };
        $("#cli-paste", body).onclick = async () => {
            let text = "";
            try { text = await navigator.clipboard.readText(); } catch (e) { text = window.prompt("Paste your commands here:") || ""; }
            text.split(/\r?\n/).forEach((l) => enter(l));
            paint();
        };
        paint();
    }

    // Desktop tab: blue desktop with app icons; IP Configuration and Command Prompt work.
    function desktopTab(body, id) {
        const def = lab.devices[id], open = app.desk[id];
        if (!open) {
            body.innerHTML = `<div class="desk"><div class="desk-grid">${DESK_APPS[def.kind].map((a) => `
                <button type="button" class="desk-app" data-app="${esc(a)}"><svg viewBox="0 0 48 48" class="desk-ic" aria-hidden="true"><rect width="48" height="48" rx="4" fill="#25b6e4"/>${appGlyph(a)}</svg><span>${esc(a)}</span></button>`).join("")}</div></div>`;
            $$("[data-app]", body).forEach((b) => { b.onclick = () => { app.desk[id] = b.dataset.app; renderWin(); }; });
            return;
        }
        const head = (title) => `<div class="app-bar"><span>${esc(title)}</span><button type="button" id="app-x" aria-label="Close ${esc(title)}">X</button></div>`;
        if (open === "IP Configuration") {
            const c = app.st.devs[id].cfg;
            const ll = v6short(autoLL(id, 9));
            const f = (k, val, ph = "") => `<input class="ipc-in" data-k="${k}" value="${esc(val)}" placeholder="${ph}" autocomplete="off" autocapitalize="none" spellcheck="false" inputmode="${k.startsWith("v6") ? "text" : "decimal"}">`;
            body.innerHTML = `<div class="ipc">${head("IP Configuration")}
                <div class="ipc-row"><label>Interface</label><select disabled><option>FastEthernet0</option></select></div>
                <fieldset><legend>IP Configuration</legend>
                    <div class="ipc-radio"><label><input type="radio" disabled> DHCP</label><label><input type="radio" checked> Static</label></div>
                    <div class="ipc-row"><label>IPv4 Address</label>${f("ip", c.ip)}</div>
                    <div class="ipc-row"><label>Subnet Mask</label>${f("mask", c.mask)}</div>
                    <div class="ipc-row"><label>Default Gateway</label>${f("gw", c.gw || "0.0.0.0")}</div>
                    <div class="ipc-row"><label>DNS Server</label>${f("dns", c.dns || "0.0.0.0")}</div>
                </fieldset>
                <fieldset><legend>IPv6 Configuration</legend>
                    <div class="ipc-radio"><label><input type="radio" disabled> Automatic</label><label><input type="radio" checked> Static</label></div>
                    <div class="ipc-row"><label>IPv6 Address</label><span class="ipc-v6">${f("v6", c.v6 ? v6short(c.v6) : "")}<b>/</b>${f("v6len", c.v6 ? c.v6len : "")}</span></div>
                    <div class="ipc-row"><label>Link Local Address</label><input class="ipc-in" value="${esc(ll)}" disabled></div>
                    <div class="ipc-row"><label>Default Gateway</label>${f("v6gw", c.v6gw ? v6short(c.v6gw) : "")}</div>
                    <div class="ipc-row"><label>DNS Server</label><input class="ipc-in" disabled></div>
                </fieldset>
                <fieldset><legend>802.1X</legend>
                    <label class="pt-chk"><input type="checkbox" disabled> Use 802.1X Security</label>
                    <div class="ipc-row"><label>Authentication</label><select disabled><option>MD5</option></select></div>
                    <div class="ipc-row"><label>Username</label><input class="ipc-in" disabled></div>
                    <div class="ipc-row"><label>Password</label><input class="ipc-in" disabled></div>
                </fieldset>
                <p class="ipc-msg" id="ipc-msg" role="status"></p></div>`;
            const msg = $("#ipc-msg", body);
            $$(".ipc-in[data-k]", body).forEach((inp) => {
                inp.oninput = () => {
                    const k = inp.dataset.k, v = inp.value.trim();
                    let bad = "";
                    if (k === "ip" || k === "mask" || k === "gw" || k === "dns") {
                        if (v && ip2n(v) === null) bad = "Invalid IP address.";
                        else if (k === "mask" && v && maskBits(v) === null) bad = "Invalid subnet mask.";
                        else c[k] = v && !((k === "gw" || k === "dns") && v === "0.0.0.0") ? normIp(v) : "";
                    } else if (k === "v6" || k === "v6gw") {
                        if (v && !v6(v)) bad = "Invalid IPv6 address.";
                        else c[k] = v ? v6(v) : "";
                    } else {
                        const n = Number(v || 64);
                        if (!(n >= 1 && n <= 128)) bad = "Invalid prefix length."; else c.v6len = n;
                    }
                    inp.classList.toggle("bad", !!bad);
                    msg.textContent = bad;
                    update();
                };
                if (inp.value === "0.0.0.0") inp.onfocus = () => inp.select();
                if (inp.dataset.k === "ip") inp.onblur = () => {
                    const m = $('[data-k="mask"]', body);
                    if (ip2n(inp.value) !== null && !m.value) { m.value = classfulMask(inp.value); m.oninput(); }
                };
            });
        } else if (open === "Command Prompt") {
            const s = app.sess[id];
            if (!s.hostOut) s.hostOut = ["", "Cisco Packet Tracer PC Command Line 1.0"];
            body.innerHTML = `<div class="cmdp">${head("Command Prompt")}
                <div class="cmdp-box" id="cmd-box"><pre id="cmd-out"></pre><form class="cli-line" id="cmd-form" autocomplete="off"><span>C:\\&gt;</span><input id="cmd-in" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Command"></form></div>
                <div class="cli-sug dark" id="cmd-sug"></div></div>`;
            const out = $("#cmd-out", body), box = $("#cmd-box", body), input = $("#cmd-in", body), sug = $("#cmd-sug", body);
            const known = () => Object.entries(app.st.devs).flatMap(([k, d]) => k === id ? [] : allIps(d));
            const paintSug = () => {
                const t = input.value.trim().toLowerCase();
                const items = !t ? ["ipconfig", "ping"] : /^ping( \S*)?$/.test(t) ? known() : [];
                sug.innerHTML = items.map((x) => `<button type="button" class="cli-chip" data-ins="${esc(x)}">${esc(x)}</button>`).join("");
                $$(".cli-chip", sug).forEach((b) => {
                    b.onmousedown = (e) => e.preventDefault();
                    b.onclick = () => { const v = input.value; input.value = (/\s$/.test(v) || !v ? v : v.replace(/\S+$/, "")) + b.dataset.ins + " "; input.focus({ preventScroll: true }); paintSug(); };
                });
            };
            const paint = () => { out.textContent = s.hostOut.slice(-400).join("\n"); box.scrollTop = box.scrollHeight; paintSug(); };
            $("#cmd-form", body).onsubmit = (e) => {
                e.preventDefault();
                const v = input.value;
                s.hostOut.push("C:\\>" + v);
                if (v.trim()) s.hist.push(v);
                s.hi = -1;
                const res = hostCommand(app, id, v);
                if (res === null) s.hostOut = []; else s.hostOut.push(...res);
                input.value = "";
                paint();
                input.focus({ preventScroll: true });
            };
            input.oninput = paintSug;
            input.onkeydown = (e) => {
                if (e.key !== "ArrowUp" || !s.hist.length) return;
                e.preventDefault();
                s.hi = s.hi < 0 ? s.hist.length - 1 : Math.max(0, s.hi - 1);
                input.value = s.hist[s.hi];
            };
            box.onclick = () => { if (!window.getSelection().toString()) input.focus({ preventScroll: true }); };
            paint();
        } else {
            body.innerHTML = `<div class="ipc">${head(open)}<p class="ipc-empty">${esc(open)} isn't used in this practice lab. Use IP Configuration and Command Prompt.</p></div>`;
        }
        $("#app-x", body).onclick = () => { app.desk[id] = null; renderWin(); };
    }

    // Config tab: the left list plus a settings page. Hostname, NVRAM save and interface IPv4 work.
    function configTab(body, id) {
        const def = lab.devices[id], d = app.st.devs[id];
        const isNet = def.kind === "router" || def.kind === "switch";
        const nav = isNet
            ? [["GLOBAL"], ["Settings"], ["Algorithm Settings"], ...(def.kind === "router" ? [["ROUTING"], ["Static"], ["RIP"]] : []), ["SWITCHING"], ["VLAN Database"], ["INTERFACE"],
                ...Object.keys(d.cfg.ifaces).sort((x, y) => x.startsWith("Vlan") === y.startsWith("Vlan") ? 0 : x.startsWith("Vlan") ? -1 : 1).map((n) => [n])]
            : [["GLOBAL"], ["Settings"], ["Algorithm Settings"], ["INTERFACE"], ["FastEthernet0"], ["Bluetooth"]];
        const heads = ["GLOBAL", "ROUTING", "SWITCHING", "INTERFACE"];
        const page = app.page[id] || "Settings";
        body.innerHTML = `<div class="cfg">
            <div class="cfg-nav">${nav.map(([n]) => heads.includes(n) ? `<div class="cfg-h">${n}</div>` : `<button type="button" data-pg="${esc(n)}" class="${n === page ? "on" : ""}">${esc(n)}</button>`).join("")}</div>
            <div class="cfg-page" id="cfg-page"></div></div>`;
        $$("[data-pg]", body).forEach((b) => { b.onclick = () => { app.page[id] = b.dataset.pg; renderWin(); }; });
        const pg = $("#cfg-page", body);
        const equiv = d.equiv || (d.equiv = []);
        const equivBox = isNet ? `<div class="cfg-eq"><div class="cfg-eq-h">Equivalent IOS Commands</div><pre id="cfg-eq">${esc(equiv.slice(-30).join("\n"))}</pre></div>` : "";
        const log = (lines) => { equiv.push(...lines); const el = $("#cfg-eq", body); if (el) { el.textContent = equiv.slice(-30).join("\n"); el.scrollTop = el.scrollHeight; } };
        const P = (h) => d.cfg.hostname + h;
        if (isNet && page === "Settings") {
            pg.innerHTML = `<div class="cfg-title">Global Settings</div>
                <div class="cfg-row"><label>Display Name</label><input value="${esc(def.label)}" disabled></div>
                <div class="cfg-row"><label>Hostname</label><input id="cfg-host" value="${esc(d.cfg.hostname)}" autocomplete="off" autocapitalize="none" spellcheck="false"></div>
                <fieldset><legend>NVRAM</legend><button type="button" class="pt-btn" id="cfg-erase">Erase</button> <button type="button" class="pt-btn" id="cfg-save">Save</button></fieldset>
                <fieldset><legend>Startup Config</legend><button type="button" class="pt-btn" disabled>Load...</button> <button type="button" class="pt-btn" disabled>Export...</button></fieldset>
                <fieldset><legend>Running Config</legend><button type="button" class="pt-btn" disabled>Export...</button> <button type="button" class="pt-btn" disabled>Merge...</button></fieldset>${equivBox}`;
            $("#cfg-host", pg).onchange = (e) => {
                const v = e.target.value.trim();
                if (!v) return;
                log([`${P("(config)#")}hostname ${v}`]);
                d.cfg.hostname = v; update();
            };
            $("#cfg-save", pg).onclick = () => { d.startup = JSON.stringify(d.cfg); log([`${P("#")}copy running-config startup-config`, "Destination filename [startup-config]?", "Building configuration...", "[OK]"]); update(); note("Saved to NVRAM."); };
            $("#cfg-erase", pg).onclick = () => { d.startup = null; log([`${P("#")}erase startup-config`]); update(); };
        } else if (isNet && d.cfg.ifaces[page]) {
            const f = d.cfg.ifaces[page];
            pg.innerHTML = `<div class="cfg-title">${esc(page)}</div>
                <div class="cfg-row"><label>Port Status</label><label class="pt-chk"><input type="checkbox" id="cfg-on" ${f.shut ? "" : "checked"}> On</label></div>
                ${page.startsWith("Vlan") ? "" : `<div class="cfg-row"><label>Bandwidth</label><span class="cfg-dim">Auto</span></div><div class="cfg-row"><label>Duplex</label><span class="cfg-dim">Auto</span></div>`}
                <div class="cfg-row"><label>MAC Address</label><input value="0001.6383.${(page.length * 1117).toString(16).padStart(4, "0").slice(-4)}" disabled></div>
                <fieldset><legend>IP Configuration</legend>
                    <div class="cfg-row"><label>IPv4 Address</label><input id="cfg-ip" value="${esc(f.ip)}" inputmode="decimal" autocomplete="off"></div>
                    <div class="cfg-row"><label>Subnet Mask</label><input id="cfg-mask" value="${esc(f.mask)}" inputmode="decimal" autocomplete="off"></div>
                </fieldset>
                ${def.kind === "router" ? `<fieldset><legend>IPv6 Configuration</legend><div class="cfg-row"><label>Link Local Address</label><input value="${esc(f.ll ? v6short(f.ll) : "")}" disabled></div><div class="cfg-row"><label>IPv6 Addresses</label><input value="${esc(f.v6.map((x) => `${v6short(x.addr)}/${x.len}`).join(", "))}" disabled></div><p class="cfg-dim">Set IPv6 in the CLI tab.</p></fieldset>` : ""}
                ${equivBox}`;
            $("#cfg-on", pg).onchange = (e) => {
                f.shut = !e.target.checked;
                log([`${P("(config)#")}interface ${page}`, `${P("(config-if)#")}${f.shut ? "shutdown" : "no shutdown"}`]);
                update();
            };
            const applyIp = () => {
                const ip = $("#cfg-ip", pg).value.trim(), mask = $("#cfg-mask", pg).value.trim();
                if (!ip || !mask) return;
                if (ip2n(ip) === null || maskBits(mask) === null || !usable(ip, mask)) { note("Invalid IP address or subnet mask."); return; }
                f.ip = normIp(ip); f.mask = normIp(mask);
                log([`${P("(config)#")}interface ${page}`, `${P("(config-if)#")}ip address ${f.ip} ${f.mask}`]);
                update();
            };
            $("#cfg-ip", pg).onchange = applyIp;
            $("#cfg-mask", pg).onchange = applyIp;
            $("#cfg-ip", pg).onblur = () => { const m = $("#cfg-mask", pg); if (!m.value && ip2n($("#cfg-ip", pg).value) !== null) { m.value = classfulMask($("#cfg-ip", pg).value); applyIp(); } };
        } else if (!isNet && page === "Settings") {
            const c = d.cfg;
            pg.innerHTML = `<div class="cfg-title">Global Settings</div>
                <div class="cfg-row"><label>Display Name</label><input value="${esc(def.label)}" disabled></div>
                <div class="cfg-row"><label>Interfaces</label><select disabled><option>FastEthernet0</option></select></div>
                <fieldset><legend>Gateway/DNS IPv4</legend>
                    <div class="ipc-radio"><label><input type="radio" disabled> DHCP</label><label><input type="radio" checked> Static</label></div>
                    <div class="cfg-row"><label>Default Gateway</label><input data-k="gw" value="${esc(c.gw)}" inputmode="decimal" autocomplete="off"></div>
                    <div class="cfg-row"><label>DNS Server</label><input data-k="dns" value="${esc(c.dns || "")}" inputmode="decimal" autocomplete="off"></div></fieldset>
                <fieldset><legend>Gateway/DNS IPv6</legend>
                    <div class="ipc-radio"><label><input type="radio" disabled> Automatic</label><label><input type="radio" checked> Static</label></div>
                    <div class="cfg-row"><label>Default Gateway</label><input data-k="v6gw" value="${esc(c.v6gw ? v6short(c.v6gw) : "")}" autocomplete="off" autocapitalize="none"></div>
                    <div class="cfg-row"><label>DNS Server</label><input disabled></div></fieldset>`;
            hostFields(pg, id);
        } else if (!isNet && page === "FastEthernet0") {
            const c = d.cfg;
            pg.innerHTML = `<div class="cfg-title">FastEthernet0</div>
                <div class="cfg-row"><label>Port Status</label><label class="pt-chk"><input type="checkbox" checked disabled> On</label></div>
                <div class="cfg-row"><label>Bandwidth</label><span class="cfg-dim">100 Mbps · Auto</span></div>
                <div class="cfg-row"><label>MAC Address</label><input value="0090.21${id.charCodeAt(0).toString(16)}.4433" disabled></div>
                <fieldset><legend>IP Configuration</legend>
                    <div class="ipc-radio"><label><input type="radio" disabled> DHCP</label><label><input type="radio" checked> Static</label></div>
                    <div class="cfg-row"><label>IPv4 Address</label><input data-k="ip" value="${esc(c.ip)}" inputmode="decimal" autocomplete="off"></div>
                    <div class="cfg-row"><label>Subnet Mask</label><input data-k="mask" value="${esc(c.mask)}" inputmode="decimal" autocomplete="off"></div></fieldset>
                <fieldset><legend>IPv6 Configuration</legend>
                    <div class="cfg-row"><label>IPv6 Address</label><input data-k="v6" value="${esc(c.v6 ? v6short(c.v6) : "")}" autocomplete="off" autocapitalize="none"></div>
                    <div class="cfg-row"><label>Link Local Address</label><input value="${esc(v6short(autoLL(id, 9)))}" disabled></div></fieldset>`;
            hostFields(pg, id);
        } else {
            pg.innerHTML = `<div class="cfg-title">${esc(page)}</div><p class="cfg-dim">This page isn't used in this practice lab.</p>${equivBox}`;
        }
    }
    function hostFields(pg, id) {
        const c = app.st.devs[id].cfg;
        $$("input[data-k]", pg).forEach((inp) => {
            inp.oninput = () => {
                const k = inp.dataset.k, v = inp.value.trim();
                const ok = !v || (k === "v6" || k === "v6gw" ? !!v6(v) : ip2n(v) !== null);
                inp.classList.toggle("bad", !ok);
                if (!ok) return;
                c[k] = !v ? "" : k === "v6" || k === "v6gw" ? v6(v) : normIp(v);
                update();
            };
        });
    }

    function servicesTab(body, id) {
        const svc = ["HTTP", "DHCP", "DHCPv6", "TFTP", "DNS", "SYSLOG", "AAA", "NTP", "EMAIL", "FTP", "IoT", "VM Management", "Radius EAP"];
        const page = app.page[`${id}-svc`] || "TFTP";
        const files = app.st.devs[id].cfg.files || [];
        body.innerHTML = `<div class="cfg">
            <div class="cfg-nav"><div class="cfg-h">SERVICES</div>${svc.map((n) => `<button type="button" data-svc="${n}" class="${n === page ? "on" : ""}">${n}</button>`).join("")}</div>
            <div class="cfg-page">${page === "TFTP" ? `<div class="cfg-title">TFTP</div>
                <div class="cfg-row"><label>Service</label><span class="ipc-radio"><label><input type="radio" checked disabled> On</label><label><input type="radio" disabled> Off</label></span></div>
                <table class="res-t files"><tr><th>File</th></tr>${["asa842-k8.bin", "c1841-advipservicesk9-mz.124-15.T1.bin", "c2900-universalk9-mz.SPA.151-4.M4.bin", "c2960-lanbasek9-mz.150-2.SE4.bin", ...files.map((f) => f.name)].map((n) => `<tr><td class="${files.some((f) => f.name === n) ? "new" : ""}">${esc(n)}</td></tr>`).join("")}</table>`
                : `<div class="cfg-title">${page}</div><p class="cfg-dim">This service isn't used in this practice lab.</p>`}</div></div>`;
        $$("[data-svc]", body).forEach((b) => { b.onclick = () => { app.page[`${id}-svc`] = b.dataset.svc; renderWin(); }; });
    }

    function physicalTab(body, id) {
        const def = lab.devices[id];
        body.innerHTML = `<div class="phys">
            ${def.kind === "pc" || def.kind === "server" ? `<div class="phys-mod"><div class="cfg-h">MODULES</div>${["WMP300N", "PT-HOST-NM-1AM", "PT-HOST-NM-1CE", "PT-HOST-NM-1CFE", "PT-HOST-NM-1CGE", "PT-HOST-NM-1FFE", "PT-HOST-NM-1FGE", "PT-HOST-NM-1W"].map((m) => `<span>${m}</span>`).join("")}</div>` : ""}
            <div class="phys-main"><div class="phys-zoom"><span>Zoom In</span><span>Original Size</span><span>Zoom Out</span></div>
                <div class="phys-pic"><svg viewBox="-40 -30 80 60">${DEV_ART[def.kind]}</svg></div>
                <p class="cfg-dim">Physical Device View: ${esc(MODEL_LABEL[def.kind])}</p></div></div>`;
    }
    function attributesTab(body, id) {
        const rows = [["MTBF", "40000"], ["cost", "119000"], ["power source", "0"], ["rack units", "1"], ["wattage", "10"]];
        body.innerHTML = `<div class="attr"><p class="cfg-dim">Attributes:</p><table class="res-t"><tr><th>Name</th><th>Attribute</th></tr>${rows.map(([a, b], i) => `<tr><td>${i + 1}. ${a}</td><td>${b}</td></tr>`).join("")}</table>
            <p class="cfg-dim" style="margin-top:14px">Properties:</p><table class="res-t"><tr><th>Property</th><th>Value</th></tr><tr><td>1. ${esc(lab.devices[id].label)}</td><td>${esc(MODEL_LABEL[lab.devices[id].kind])}</td></tr></table></div>`;
    }

    // Keep windows above the phone keyboard.
    const vv = window.visualViewport;
    const fit = () => { if (vv) $c("#pt").style.setProperty("--vvh", `${vv.height}px`); };
    if (vv) { vv.addEventListener("resize", fit); fit(); }
    const onEsc = (e) => {
        if (e.key !== "Escape") return;
        if (app.res) { app.res = null; resEl.hidden = true; } else if (app.open) closeDevice(); else if (app.act) { app.act = false; renderAct(); }
    };
    document.addEventListener("keydown", onEsc);

    drawCanvas();
    renderAct();
    return () => {
        clearInterval(tick);
        clearTimeout(saveTimer); clearTimeout(noteTimer);
        store(labId, app.st);
        document.body.classList.remove("lab-sheet-open");
        document.removeEventListener("keydown", onEsc);
        if (vv) vv.removeEventListener("resize", fit);
    };
}

window.AnswritPtLab = {
    list: [
        ...Object.entries(LABS).map(([id, l]) => ({ id, title: l.title, sub: l.sub, course: l.course })),
        { id: VLAN_LAB, title: "Skills Practice: VLANs & Inter-VLAN Routing", sub: "Router-on-a-stick, trunks, native VLAN, SSH and IPv6, in several versions", course: "CCNA 2" },
    ],
    get: (id) => getLab(id),
    mount,
    // For tests.
    _internal: { LABS, getLab, makeVlanLab, v6, freshState, submit, Session, makeCtx, ping, hostCommand, mount },
};
})();
