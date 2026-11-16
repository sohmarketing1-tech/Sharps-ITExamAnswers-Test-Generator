import html
pc = lambda: """IP Address: <network + its label (1st = +1, 2nd = +2, 3rd = +3)>
Subnet Mask: <mask of the PC network>
Default Gateway: <Router 2's address on that network (last usable)>
DNS Server: <server's IPv4 address>"""
lap = lambda: """IPv6 Address: <IPv6 network><its label: 1st = 1, 2nd = 2, 3rd = 3>
Prefix: 64
IPv6 Gateway: <Router 2's link-local on that port (FE80::1)>
IPv6 DNS Server: <server's IPv6 address>"""
S = [
("Router 1 (the middle router: 2 cables up to the ISP, 1 down to Router 2)", [
"""Router1>en
Router1#conf t
Router1(config)#ipv6 unicast-routing""",
"""Router1(config)#int <port to ISP, main cable>
Router1(config-if)#ip add <2nd usable of that link> 255.255.255.252
Router1(config-if)#ipv6 add <IPv6 network of that link>2/64
Router1(config-if)#no shut""",
"""Router1(config-if)#int <port to ISP, backup cable>
Router1(config-if)#ip add <2nd usable of that link> 255.255.255.252
Router1(config-if)#ipv6 add <IPv6 network of that link>2/64
Router1(config-if)#no shut""",
"""Router1(config-if)#int <port to Router 2>
Router1(config-if)#ip add <1st usable of that link> 255.255.255.252
Router1(config-if)#ipv6 add <IPv6 network of that link>1/64
Router1(config-if)#ipv6 add FE80::1 link-local
Router1(config-if)#clock rate 128000
Router1(config-if)#no shut
Router1(config-if)#exit""",
"""Router1(config)#ip route 0.0.0.0 0.0.0.0 <port to ISP, main>
Router1(config)#ipv6 route ::/0 <port to ISP, main>""",
"""Router1(config)#ip route 0.0.0.0 0.0.0.0 <port to ISP, backup> 10
Router1(config)#ipv6 route ::/0 <port to ISP, backup> 10""",
"""Router1(config)#ip route <PC network> <its mask> <Router 2's address on your link>
Router1(config)#ipv6 route <laptop IPv6 network>/64 <Router 2's IPv6 on your link>""",
"""Router1(config)#end
Router1#wr"""]),
("Router 2 (the bottom router: 1 cable up to Router 1, 2 cables down to the switches)", [
"""Router>en
Router#conf t
Router(config)#host <router name>""",
"""Router2(config)#enable secret <password>
Router2(config)#line con 0
Router2(config-line)#password <password>
Router2(config-line)#login
Router2(config-line)#line vty 0 4
Router2(config-line)#password <password>
Router2(config-line)#login
Router2(config-line)#exit
Router2(config)#serv pass""",
"""Router2(config)#ban motd #<banner text>#""",
"""Router2(config)#ipv6 unicast-routing""",
"""Router2(config)#int <port to Router 1>
Router2(config-if)#ip add <2nd usable of that link> 255.255.255.252
Router2(config-if)#ipv6 add <IPv6 network of that link>2/64
Router2(config-if)#ipv6 add FE80::2 link-local
Router2(config-if)#no shut""",
"""Router2(config-if)#int <port to the PC switch>
Router2(config-if)#desc <description text>
Router2(config-if)#ip add <last usable of PC network> <mask of PC network>
Router2(config-if)#no shut""",
"""Router2(config-if)#int <port to the laptop switch>
Router2(config-if)#desc <description text>
Router2(config-if)#ipv6 add <laptop IPv6 network><Nth usable, in hex>/64
Router2(config-if)#ipv6 add FE80::1 link-local
Router2(config-if)#no shut
Router2(config-if)#exit""",
"""Router2(config)#ip route 0.0.0.0 0.0.0.0 <port to Router 1>
Router2(config)#ipv6 route ::/0 <port to Router 1>""",
"""Router2(config)#end
Router2#wr"""]),
("PC0, PC1, PC2 (IPv4 side)", ["Desktop > IP Configuration > Static", pc()]),
("Laptop0, Laptop1, Laptop2 (IPv6 side)", ["Desktop > IP Configuration > IPv6 Static", lap()]),
("Notes", ["""ISP router, switches and server: already set up. Don't touch them.
Backup (floating) route = same route + a bigger number at the end (10).
Hex: 10th = a, 11th = b, 12th = c, 15th = f, 16th = 10.
Check Results only shows % in this lab, so ping the server from every PC and laptop."""]),
]
body = ""
for name, blocks in S:
    cls = ' class="newpage"' if name.startswith(("Router 2", "PC0")) else ''
    body += f'<section{cls}><h2>{html.escape(name)}</h2>'
    for b in blocks:
        body += '<p>' + "<br>".join(html.escape(l) for l in b.split("\n")) + '</p>'
    body += '</section>'
open("list.html", "w").write(f'''<!doctype html><meta charset=utf-8><title>Packet Tracer 2 Command List</title><style>
@page{{size:letter;margin:1in 1.15in}}
body{{font:11pt/1.3 Arial,Helvetica,sans-serif;color:#000;margin:0}}
h2{{font:inherit;margin:0 0 1.2em}}
p{{margin:0 0 1.2em;break-inside:avoid}}
section{{margin-bottom:1.6em}}.newpage{{break-before:page}}h2{{break-after:avoid}}
</style>{body}''')
