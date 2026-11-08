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

// ─── Devices ────────────────────────────────────────────────────────────────
function newIface(shut) { return { ip: "", mask: "", v6: [], ll: "", desc: "", shut, v6on: false }; }
function newNetDevice(kind) {
    const ifaces = {};
    if (kind === "router") {
        ["GigabitEthernet0/0", "GigabitEthernet0/1", "GigabitEthernet0/2"].forEach((n) => { ifaces[n] = newIface(true); });
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
            lines: { con: { pw: "", login: "", timeout: "" }, vty: { pw: "", login: "", timeout: "", transport: "" } },
            ifaces,
        },
        startup: null,
    };
}
function newHost() { return { cfg: { ip: "", mask: "", gw: "", v6: "", v6len: 64, v6gw: "", files: [] } }; }
function freshState(lab) {
    const devs = {};
    for (const [id, d] of Object.entries(lab.devices)) devs[id] = d.kind === "router" || d.kind === "switch" ? newNetDevice(d.kind) : newHost();
    return { devs, sheet: {} };
}

// ─── Reachability (ping) ────────────────────────────────────────────────────
function segOf(lab, id, port) {
    if (lab.devices[id].kind === "switch") return id;
    const l = lab.links.find(([a, ap, b, bp]) => (a === id && ap === port) || (b === id && bp === port));
    if (!l) return null;
    const other = l[0] === id ? l[2] : l[0];
    return lab.devices[other].kind === "switch" ? other : null;
}
function hostPort(lab, id) {
    const l = lab.links.find(([a, , b]) => a === id || b === id);
    return l ? (l[0] === id ? l[1] : l[3]) : "FastEthernet0";
}
function autoLL(id, n) {
    const a = (id.charCodeAt(0) % 256).toString(16).padStart(2, "0");
    const b = ((id.charCodeAt(id.length - 1) * 31 + n) % 65536).toString(16);
    return v6(`fe80::2d0:97ff:fe${a}:${b}`);
}

// Every place a device has an address: { dev, seg, addrs, inNet(a), gw, up, router }
function stacks(lab, st, fam) {
    const out = [];
    for (const [id, def] of Object.entries(lab.devices)) {
        const d = st.devs[id];
        if (def.kind === "router") {
            Object.entries(d.cfg.ifaces).forEach(([name, f], i) => {
                const seg = segOf(lab, id, name);
                if (!seg) return;
                if (fam === 4 && f.ip) out.push({ dev: id, seg, addrs: [f.ip], inNet: (a) => sameNet(a, f.ip, f.mask), up: !f.shut, router: true });
                if (fam === 6 && (f.v6.length || f.ll || f.v6on)) {
                    const ll = f.ll || autoLL(id, i);
                    out.push({ dev: id, seg, addrs: [...f.v6.map((x) => x.addr), ll], inNet: (a) => isLL(a) || f.v6.some((x) => samePfx(a, x.addr, x.len)), up: !f.shut, router: true });
                }
            });
        } else if (def.kind === "switch") {
            const f = d.cfg.ifaces.Vlan1;
            if (fam === 4 && f.ip) out.push({ dev: id, seg: id, addrs: [f.ip], inNet: (a) => sameNet(a, f.ip, f.mask), gw: d.cfg.gw, up: !f.shut });
        } else {
            const c = d.cfg, seg = segOf(lab, id, hostPort(lab, id));
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
const MODE_SUFFIX = { user: ">", priv: "#", config: "(config)#", if: "(config-if)#", line: "(config-line)#", range: "(config-if-range)#" };
const CFG_MODES = ["config", "if", "line", "range"];

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
    return null;
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
function curLine(ctx) { return ctx.d.cfg.lines[ctx.s.line]; }

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
cmd("user priv", "show ipv6 interface brief", (ctx) => ctx.print(ipv6Brief(ctx)), "router");
cmd("user priv", "show ip route", (ctx) => ctx.print(ipRoute(ctx)), "router");
cmd("user priv", "show version", (ctx) => ctx.print(ctx.kind === "router"
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
cmd("config", "interface <if>", (ctx, [n]) => { ctx.s.mode = "if"; ctx.s.ifc = n; });
cmd("config", "interface range <rest>", (ctx) => { ctx.s.mode = "range"; ctx.s.ifc = null; });
cmd("config", "line console <n>", (ctx, [n]) => { if (n !== "0") return ctx.invalid(); ctx.s.mode = "line"; ctx.s.line = "con"; });
cmd("config", "line vty <n> <n>", (ctx, [a, b]) => {
    if (+a > +b || +b > 15) return ctx.invalid();
    ctx.s.mode = "line"; ctx.s.line = "vty";
});
cmd("config", "exit", (ctx) => { ctx.s.mode = "priv"; });
cmd("config if line range", "end", (ctx) => { ctx.s.mode = "priv"; ctx.print("%SYS-5-CONFIG_I: Configured from console by console"); });
cmd("config", "do <rest>", (ctx, [rest]) => ctx.run(rest, "priv"));
cmd("if line range", "do <rest>", (ctx, [rest]) => ctx.run(rest, "priv"));

// Interface
cmd("if", "ip address <ip> <ip>", (ctx, [a, m]) => {
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
cmd("if range", "switchport mode <w>", () => {}, "switch");
cmd("if range", "switchport access vlan <n>", () => {}, "switch");
cmd("range", "shutdown", () => {});
cmd("range", "no shutdown", () => {});
cmd("range", "description <rest>", () => {});
cmd("if line range", "exit", (ctx) => { ctx.s.mode = "config"; ctx.s.ifc = null; ctx.s.line = null; });

// Lines
cmd("line", "password <w>", (ctx, [p]) => { if (pwOk(ctx, p)) curLine(ctx).pw = p; });
cmd("line", "no password", (ctx) => { curLine(ctx).pw = ""; });
cmd("line", "login", (ctx) => {
    curLine(ctx).login = "login";
    if (!curLine(ctx).pw) ctx.print("% Login disabled on line, until 'password' is set");
});
cmd("line", "login local", (ctx) => { curLine(ctx).login = "local"; });
cmd("line", "no login", (ctx) => { curLine(ctx).login = ""; });
cmd("line", "exec-timeout <n>", (ctx, [m]) => { curLine(ctx).timeout = `${+m} 0`; });
cmd("line", "exec-timeout <n> <n>", (ctx, [m, s]) => { curLine(ctx).timeout = `${+m} ${+s}`; });
cmd("line", "logging synchronous", () => {});
cmd("line", "transport input <rest>", (ctx, [rest]) => {
    if (ctx.s.line !== "vty") return ctx.invalid();
    const words = rest.toLowerCase().split(/\s+/).filter(Boolean);
    const ok = ["ssh", "telnet", "all", "none"];
    const full = words.map((w) => ok.find((k) => k.startsWith(w)));
    if (!full.length || full.some((w) => !w)) return ctx.invalid();
    curLine(ctx).transport = [...new Set(full)].sort().join(" ");
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
        if (f.ip) body.push(` ip address ${f.ip} ${f.mask}`);
        else if (kind === "router" || name.startsWith("Vlan")) body.push(" no ip address");
        if (kind === "router") body.push(" duplex auto", " speed auto");
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
    line(kind === "router" ? "line vty 0 4" : "line vty 0 4", c.lines.vty);
    if (kind === "switch") line("line vty 5 15", c.lines.vty);
    body.push("!", "!", "end");
    const text = body.join("\n");
    if (current) L.push(`Current configuration : ${text.length} bytes`);
    L.push(text);
    return L.join("\n");
}
function ifStatus(ctx, name, f) {
    if (f.shut) return ["administratively down", "down"];
    if (name.startsWith("Vlan")) return ["up", "up"];
    return ctx.linked(name) ? ["up", "up"] : ["down", "down"];
}
function ipBrief(ctx) {
    const rows = ["Interface              IP-Address      OK? Method Status                Protocol "];
    for (const [name, f] of Object.entries(ctx.d.cfg.ifaces)) {
        const [s, p] = ifStatus(ctx, name, f);
        rows.push(`${name.padEnd(23)}${(f.ip || "unassigned").padEnd(16)}YES ${(f.ip ? "manual" : "unset").padEnd(7)}${s.padEnd(22)}${p} `);
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
    let cands = CMDS.filter((c) => c.modes.includes(mode) && (!c.only || c.only === kind)).map((c) => ({ c, args: [], done: false }));
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
    let cands = CMDS.filter((c) => c.modes.includes(mode) && (!c.only || c.only === kind));
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
        linked: (port) => app.lab.links.some(([a, ap, b, bp]) => (a === id && ap === port) || (b === id && bp === port)),
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
        res.cmd.run(ctx, res.args);
        return true;
    }
    // Global commands also work from interface/line mode (IOS drops back to global config).
    if (["if", "line", "range"].includes(s.mode) && res.error !== "ambiguous") {
        const g = match(line, "config", ctx.kind);
        if (g.cmd && !["exit", "end"].includes(g.cmd.words[0])) {
            const before = { mode: s.mode, ifc: s.ifc, line: s.line };
            s.mode = "config"; s.ifc = null; s.line = null;
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
            if (st && st.devs && Object.keys(lab.devices).every((k) => st.devs[k])) return st;
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
const hms = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, "0")).join(":");
const TB_ICONS = ["M4 3h11l5 5v13H4z", "M3 7h7l2 2h9v10H3z", "M5 4h12l2 2v14H5zM8 4v5h7V4", "M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z", "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8v.5M12 11v6", "M5 19l14-14M8 5H5v3M16 19h3v-3", "M9 4l-5 5 5 5M4 9h11a5 5 0 0 1 0 10h-3", "M15 4l5 5-5 5M20 9H9a5 5 0 0 0 0 10h3", "M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM14.5 14.5L20 20M7 10h6M10 7v6", "M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM14.5 14.5L20 20", "M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM14.5 14.5L20 20M7 10h6", "M3 5h18v12H3zM8 21h8"];

// ─── Mounting a lab ─────────────────────────────────────────────────────────
function mount(root, labId, { alive } = {}) {
    const lab = LABS[labId];
    if (!lab) { root.innerHTML = '<div class="error-box">This lab wasn\'t found.</div>'; return () => {}; }
    const app = { lab, st: load(labId, lab), sess: {}, open: null, tab: {}, desk: {}, page: {}, act: false, res: null, sug: true };
    if (typeof app.st.elapsed !== "number") app.st.elapsed = 0;
    Object.keys(lab.devices).forEach((k) => { app.sess[k] = Session(); app.sess[k].out.push("Press RETURN to get started!"); });
    const checks = lab.checks();
    const LIMIT = 4.5 * 3600;
    let saveTimer = null;
    const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store(labId, app.st), 200); };
    const W = lab.worksheet;
    const short = (label) => label.replace(/^(Router|ITA|ITC|Host \d|Server): /, "");
    const score = () => {
        const res = checks.map((c) => ({ ...c, ok: !!c.test(app.st, lab) }));
        return { res, pct: Math.round((res.filter((r) => r.ok).length / res.length) * 100) };
    };

    root.innerHTML = `
        <div class="pt" id="pt">
            <div class="pt-titlebar">
                <a class="pt-exit" href="#/packet-tracer" aria-label="Leave the lab">✕</a>
                <span class="pt-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="pt-wtitle">Cisco Packet Tracer - final_practice_27_oct_2020.pka</span>
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
        $$("[data-left]", root).forEach((el) => { el.textContent = hms(Math.max(0, LIMIT - app.st.elapsed)); });
        if (app.st.elapsed % 10 === 0) save();
    }, 1000);

    // ── PT Activity window (instructions)
    function renderAct() {
        const { pct } = score();
        const left = hms(Math.max(0, LIMIT - app.st.elapsed));
        actEl.className = `pt-act ${app.act ? "open" : ""}`;
        actEl.innerHTML = app.act ? `
            <div class="pt-win act-win" role="dialog" aria-label="PT Activity">
                <div class="pt-wbar"><button type="button" class="pt-wdot red" id="act-min" aria-label="Minimize"></button><i class="pt-wdot yel"></i><i class="pt-wdot grn"></i><span>PT Activity: <span data-left>${left}</span></span></div>
                <div class="act-doc">${actDoc()}</div>
                <div class="act-foot">
                    <div class="act-row"><span>Time Left: <span data-left>${left}</span></span><span>Completion: <b>${pct}%</b></span></div>
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
                <span class="act-mini-t">PT Activity <small>Time Left: <span data-left>${left}</span></small></span>
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
    const normCell = (k, v) => k === "range" ? String(v).split(/\s*(?:-|–|to)\s*/).map(normIp).join("-") : normIp(v);
    function bindDoc() {
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
        const hosts = ["H0", "H1", "H2", "SV"];
        const tests = [];
        hosts.forEach((a, i) => hosts.slice(i + 1).forEach((b) => {
            tests.push({ a, b, ok: !!app.st.devs[b].cfg.ip && ping(lab, app.st, a, app.st.devs[b].cfg.ip, 4).ok });
        }));
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
                    s.mode = "priv"; s.ifc = null; s.line = null;
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
                    <div class="ipc-row"><label>DNS Server</label><input class="ipc-in" value="0.0.0.0" disabled></div>
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
                    if (k === "ip" || k === "mask" || k === "gw") {
                        if (v && ip2n(v) === null) bad = "Invalid IP address.";
                        else if (k === "mask" && v && maskBits(v) === null) bad = "Invalid subnet mask.";
                        else c[k] = v && !(k === "gw" && v === "0.0.0.0") ? normIp(v) : "";
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
                ...(def.kind === "router" ? ["GigabitEthernet0/0", "GigabitEthernet0/1", "GigabitEthernet0/2"] : ["Vlan1", "FastEthernet0/1", "FastEthernet0/2", "GigabitEthernet0/1"]).map((n) => [n])]
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
                    <div class="cfg-row"><label>DNS Server</label><input disabled></div></fieldset>
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
    list: Object.entries(LABS).map(([id, l]) => ({ id, title: l.title, sub: l.sub, course: l.course })),
    mount,
    // For tests.
    _internal: { LABS, freshState, submit, Session, makeCtx, ping, hostCommand, mount },
};
})();
