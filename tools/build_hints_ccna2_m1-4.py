"""Hand-written memory hints for CCNA 2 Modules 1-4, checked against the exam data.

Each hint: cue (clue in the question), keys (exact words from the right answer to memorize),
tip (one short memory trick). The build marks each key as "unique" when it appears in only one
answer choice in the whole exam, and fails if a key isn't really in the right answer.
"""
import json, pathlib, re, sys

ROOT = pathlib.Path("/Users/jonathansharp/CascadeProjects/quiz-scraper")
NAME = "ccna-2-v7-modules-1-4-switching-concepts-vlans-and-intervlan-routing-exam-answers.json"

H = {
    1: ("command history", ["buffer size", "previously entered"], "History is a buffer: you set its size and recall what you previously entered. It doesn't save to a log file or reach a previous session."),
    2: ("first action … powered on", ["power-on self-test"], "Power On → POST first. POST stands for Power-On Self-Test."),
    3: ("reset a lost password", ["physical access"], "You can't reset a lost password from far away. You need hands on the router."),
    4: ("login local", ["username"], "LOGIN LOCAL means check a LOCAL list of usernames, so you must create a username with a secret."),
    5: ("auto-MDIX", ["controllers"], "MDIX is about the cable hardware, and hardware details live under show CONTROLLERS."),
    6: ("late collisions", ["half-duplex end"], "Collisions only happen in half duplex, so that's the end that sees them."),
    7: ("set the BOOT variable", ["boot system"], "Tell the switch which IOS to boot: boot SYSTEM."),
    8: ("locate and load the IOS", ["BOOT environment variable"], "The BOOT variable is the map that points to the IOS file."),
    9: ("adds security", ["SSH"], "SSH = Secure SHell. The S is for Secure."),
    10: ("loopback", ["logical"], "A loopback loops back inside the router. It's logical, not a port you plug into."),
    11: ("runt frame", ["64 bytes"], "Under 64 bytes is a runt. 64 is the smallest legal frame."),
    12: ("boot loader runs after …", ["POST"], "Boot order: POST → boot loader → IOS."),
    13: ("adding a Layer 2 switch", ["broadcast domain"], "Switches pass broadcasts along, so adding one makes the broadcast domain bigger."),
    14: ("cut-through", ["without any error checking"], "Cut-through cuts corners: it forwards right away, without error checking."),
    15: ("hub vs switch", ["extends", "divides"], "A hub EXTENDS the collision domain. A switch DIVIDES it."),
    16: ("forwarding decisions", ["CAM table"], "Switches look up MAC addresses in the CAM table to decide."),
    17: ("switch buffers", ["store frames", "congestion"], "Buffers store frames during congestion so they don't get dropped."),
    18: ("keep traffic local", ["high port density"], "More ports on one switch means more traffic stays on that switch."),
    19: ("packet handling time", ["ASIC"], "An ASIC is a special chip built just to switch fast."),
    20: ("frame with an unknown destination", ["adds the source MAC address", "forwards the frame out all ports"], "First LEARN the sender, then FLOOD because the destination is unknown."),
    21: ("added to the switch table", ["source MAC address", "incoming port"], "Switches learn from the SOURCE: who sent it and which port it came in on."),
    22: ("error-free before forwarding", ["store-and-forward"], "Store-and-forward stores the whole frame and checks it before sending."),
    23: ("how many broadcast domains", ["8"], "Every router interface is its own broadcast domain. Count them: 8."),
    24: ("disable DTP", ["non-Cisco", "should not be trunking"], "DTP is Cisco-only and only for trunks. Turn it off for non-Cisco switches and links that shouldn't trunk."),
    25: ("native VLAN", ["untagged", "common identifier"], "Native VLAN = untagged traffic, and both ends of the trunk must agree on it."),
    26: ("remove only VLAN 100", ["(config)# no vlan 100"], "Remove one VLAN from global config with no vlan 100. Deleting vlan.dat wipes every VLAN."),
    27: ("ports missing from the VLAN list", ["trunk"], "show vlan lists access ports only. Trunk ports don't show up there."),
    28: ("broadcast in VLAN 20", ["Only devices in VLAN 20"], "Each VLAN is its own broadcast domain, so broadcasts stay inside VLAN 20."),
    29: ("same VLAN can't cross switches", ["Allow VLAN 20 on the trunk"], "Same VLAN on both switches but no traffic? The trunk isn't letting it through."),
    30: ("the VLAN is deleted", ["stop communicating"], "Delete the VLAN and its ports go silent. They do NOT fall back to VLAN 1. (Compare: taking ONE port out of its VLAN sends it back to VLAN 1.)"),
    31: ("802.1Q tag fields", ["tag protocol ID", "a VLAN number", "level or service", "Token Ring"], "Type = TPID, VLAN ID = the VLAN number, Priority = level of service, CFI = Token Ring."),
    32: ("Cisco best practice for G0/1", ["trunk"], "A link between switches should be set to trunk on purpose, not left on auto."),
    33: ("DTP modes", ["manual configuration", "Actively attempts", "Permanent", "Passively waits"], "DesiRable = Really wants a trunk (active). Auto = waits. Trunk = always. Nonegotiate = you set it by hand."),
    34: ("no switchport access vlan 30", ["returned to VLAN 1"], "Take a port out of its VLAN and it goes back to VLAN 1, the default. (Compare: deleting the VLAN makes ports stop talking.)"),
    35: ("voice VLAN and access VLAN for one port", ["Fa0/1 switchport"], "Port settings for one port: show interfaces <port> SWITCHPORT."),
    36: ("voice and data on Fa0/20", ["voice VLAN to the switch port is incorrect"], "A voice VLAN needs switchport voice vlan. The command in the picture is the wrong one."),
    37: ("steps for a voice VLAN", ["Add a voice VLAN", "access mode", "Assign the voice VLAN", "trusted"], "Create it, set the port to access, assign the voice VLAN, trust CoS. No trunk, PortFast or subinterfaces."),
    38: ("show interfaces trunk", ["G0/2 is not configured as a trunk"], "A port missing from show interfaces trunk isn't a trunk."),
    39: ("error on router CiscoVille", ["encapsulation dot1Q 20"], "A subinterface needs encapsulation dot1Q before it accepts an IP address."),
    40: ("command on the switch for CiscoVille", ["switchport mode trunk"], "Router-on-a-stick needs a trunk on the switch side: switchport mode trunk."),
    41: ("router-on-a-stick", ["trunk"], "One router link carrying every VLAN means a trunk."),
    42: ("downsides of router-on-a-stick", ["dedicated router", "traffic flow speed"], "It needs its own router, and every VLAN shares one link, which slows traffic."),
    43: ("errors on Gi1/1", ["default VLAN", "trunk mode"], "The output shows access VLAN 1 (default) and mode trunk. Both are wrong for this port."),
    44: ("PC2 can't reach PC1", ["wrong VLAN"], "Check that the dot1Q number matches the VLAN. Here it doesn't."),
    45: ("port type on the switch for CiscoVille", ["trunk port"], "Router-on-a-stick always connects to a trunk port."),
    46: ("hosts can't talk, switch is fine", ["incorrectly matched"], "Each subinterface's IP has to match its VLAN. Here they're mixed up."),
    47: ("VLAN 30 trouble", ["incorrect IP address"], "Trouble reaching VLAN 30? Look at .30's IP address. It's wrong."),
    48: ("routed port", ["not assigned to a VLAN"], "A routed port acts like a router port, so it has no VLAN."),
    49: ("how many subinterfaces", ["4"], "One subinterface per VLAN. Count the VLANs: 4."),
    50: ("mdix auto", ["straight-through or a crossover"], "MDIX auto lets either cable type work."),
    51: ("ip address … 255.255.255.0", ["IPv4"], "Dotted numbers with a mask = IPv4."),
    52: ("configure terminal", ["global configuration"], "configure terminal takes you to global config: Switch(config)#."),
    53: ("configure terminal", ["global configuration"], "configure terminal takes you to global config: Switch(config)#."),
    54: ("shutdown", ["disables"], "shutdown turns the interface OFF."),
    55: ("shutdown", ["disables"], "shutdown turns the interface OFF."),
    56: ("ipv6 address", ["applies an IPv6 address"], "ipv6 address APPLIES an IPv6 address. Trap: 'permits an IPv6 address' is wrong."),
    57: ("exit from interface config", ["returns to global configuration"], "exit goes back one level: interface → global config."),
    58: ("enable", ["privileged"], "enable turns > into # (privileged mode)."),
    59: ("duplex full", ["both directions"], "Full duplex = both directions at the same time."),
    60: ("should NOT carry voice or management", ["data"], "Data VLAN carries user data only."),
    61: ("IP Phone quality", ["voice"], "IP phone → voice VLAN."),
    62: ("initially the management VLAN", ["default"], "Out of the box, VLAN 1 (the default VLAN) is the management VLAN."),
    63: ("delay under 150 ms", ["voice"], "Phone calls need low delay → voice VLAN."),
    64: ("separate into groups of users", ["data"], "Groups of users and their devices → data VLAN."),
    65: ("SSH, Telnet, HTTPS, SNMP", ["management"], "Those are all ways to manage a switch → management VLAN."),
    66: ("untagged traffic", ["native"], "Untagged = native."),
    67: ("untagged traffic", ["native"], "Untagged = native."),
    68: ("administratively down", ["no shutdown"], "Administratively down means someone shut it down. Undo it with no shutdown."),
    69: ("allow SSH, block Telnet", ["transport input"], "Which protocols can log in is set by transport input (transport input ssh)."),
    70: ("congestion from collisions", ["high port density"], "Collisions → give devices their own switch ports."),
    71: ("SVI inter-VLAN routing", ["faster", "no need for a connection to a router"], "SVIs route inside the switch: faster, and no router needed."),
    72: ("the ? after encapsulation dot1Q", ["VLAN number"], "encapsulation dot1Q <VLAN number>."),
    73: ("untagged across a trunk", ["native"], "Untagged = native."),
    74: ("show vlan brief", ["all switch ports"], "show vlan brief lists every VLAN and which switch ports are in it."),
    75: ("DHCP messages", ["find a DHCP server", "responding", "accepting", "confirming"], "DORA: Discover (find), Offer (respond), Request (accept), Ack (confirm)."),
    76: ("SSH, Telnet, HTTPS, SNMP", ["management"], "Those are all ways to manage a switch → management VLAN."),
}

d = json.loads((ROOT / "data" / NAME).read_text())
Q = d["questions"] if isinstance(d, dict) else d
all_opts = [o.lower() for q in Q for o in (q.get("options") or [])]
for q in Q:  # matching answers count too
    all_opts += [str(v).lower() for v in (q.get("correct_pairs") or {}).values()]
out, problems = {}, []
for q in Q:
    qid = q["id"]
    if qid not in H:
        problems.append(f"{qid}: no hint"); continue
    cue, keys, tip = H[qid]
    if q.get("type") == "matching":
        right = " ".join(f"{k} {v}" for k, v in q["correct_pairs"].items()).lower()
    else:
        right = " ".join(c for c in q["correct_answer"].split("|")).lower()
    ks = []
    for k in keys:
        if k.lower() not in right:
            problems.append(f"{qid}: key '{k}' not in the right answer")
        hits = sum(1 for o in all_opts if re.search(r"(?<![a-z0-9])" + re.escape(k.lower()) + r"(?![a-z0-9])", o))
        ks.append({"k": k, "unique": hits == 1})
    out[str(qid)] = {"cue": cue, "keys": ks, "tip": tip}
if problems:
    print("\n".join(problems)); sys.exit(1)
dest = ROOT / "static/beta/hints" / NAME
dest.parent.mkdir(exist_ok=True)
dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
u = sum(1 for h in out.values() for k in h["keys"] if k["unique"])
print(len(out), "hints;", u, "of", sum(len(h["keys"]) for h in out.values()), "keys are unique in the whole exam")
