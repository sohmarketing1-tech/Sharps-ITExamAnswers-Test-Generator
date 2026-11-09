# CCNA 2 Packet Tracer 1: answer key (verified 48/48)

Source: `packet-tracer-ccna2-1.pka` (same file as `~/Downloads/progress_check_1_practice.pka`), Packet Tracer 9.0.1.
Completed in Packet Tracer on 2026-11-09; Check Results showed **48/48** (see `ccna2-1-check-results-48of48.png`).
The lab has no instructions window and no connectivity tests: only the topology notes and the 48 assessment items.

## Topology and cabling (from port labels, `ccna2-1-topology-ports.png`)

| Link | Ends |
|---|---|
| PC0 Fa0 | SNOW Fa0/1 (VLAN 50) |
| Laptop0 Fa0 | SNOW Fa0/2 (VLAN 75) |
| SNOW Fa0/9 | BELLE Fa0/9 (trunk) |
| WHITE Fa0/10 | BELLE Fa0/10 (trunk) |
| PC1 Fa0 | WHITE Fa0/1 (VLAN 50) |
| Laptop1 Fa0 | WHITE Fa0/2 (VLAN 75) |
| BELLE Gig0/1 | ARIEL Gig0/0/0 (trunk, router-on-a-stick) |
| ARIEL Gig0/0/1 | DNS SVR Fa0 |

Devices: ARIEL = ISR4331 router; SNOW, BELLE, WHITE = 2960-24TT switches; DNS SVR = Server-PT. All start blank.

## Addressing (rule: "1st/2nd/3rd" labels = first/second/third usable; router = LAST usable)

| VLAN / net | Network | Router | Hosts |
|---|---|---|---|
| 50 SCOOBY | 192.168.10.0/27 | .30 (G0/0/0.50) | PC0 .1, PC1 .2 |
| 75 SCRAPPY | 192.168.10.32/27 | .62 (G0/0/0.75) | Laptop0 .33, Laptop1 .34 |
| 500 Native/Management | 192.168.10.64/29 | .70 (G0/0/0.500, native) | SNOW .65, BELLE .66, WHITE .67 |
| Server link | 10.40.50.0/30 | .2 (G0/0/1) | DNS SVR .1 |
| IPv6 server link | 2021:200:F:A::/64 | ::9, link-local FE80::1 | DNS SVR ::1 (gateway FE80::1) |

End devices: DNS server 10.40.50.1. Switch default gateway 192.168.10.70.

## Commands that scored 48/48

ARIEL
```
hostname ARIEL
enable secret class
banner motd #Keep Out!#
line con 0
 password cisco
 login
line vty 0 4
 password cisco
 login
service password-encryption
interface g0/0/0
 no shutdown
interface g0/0/0.50
 encapsulation dot1Q 50
 ip address 192.168.10.30 255.255.255.224
interface g0/0/0.75
 encapsulation dot1Q 75
 ip address 192.168.10.62 255.255.255.224
interface g0/0/0.500
 encapsulation dot1Q 500 native
 ip address 192.168.10.70 255.255.255.248
interface g0/0/1
 ip address 10.40.50.2 255.255.255.252
 ipv6 address 2021:200:F:A::9/64
 ipv6 address FE80::1 link-local
 no shutdown
```

SNOW / WHITE (WHITE: trunk is f0/10, SVI .67)
```
hostname SNOW
vlan 50
 name SCOOBY
vlan 75
 name SCRAPPY
vlan 500
 name Native/Management
interface f0/1
 switchport mode access
 switchport access vlan 50
interface f0/2
 switchport mode access
 switchport access vlan 75
interface f0/9
 switchport mode trunk
 switchport trunk native vlan 500
interface vlan 500
 ip address 192.168.10.65 255.255.255.248
 no shutdown
ip default-gateway 192.168.10.70
```

BELLE
```
hostname BELLE
vlan 50 / name SCOOBY, vlan 75 / name SCRAPPY, vlan 500 / name Native/Management
interface range f0/9 - 10
 switchport mode trunk
 switchport trunk native vlan 500
interface g0/1
 switchport mode trunk
 switchport trunk native vlan 500
interface vlan 500
 ip address 192.168.10.66 255.255.255.248
 no shutdown
ip default-gateway 192.168.10.70
ip domain-name cisco.com
username admin secret cisco
crypto key generate rsa general-keys modulus 1024
ip ssh version 2
line vty 0 15
 login local
 transport input ssh
```

PCs (Desktop > IP Configuration): PC0 192.168.10.1 / 255.255.255.224 / gw .30 / DNS 10.40.50.1;
Laptop1 192.168.10.34 / 255.255.255.224 / gw .62 / DNS 10.40.50.1. (PC1 .2 and Laptop0 .33 are not graded.)
DNS SVR: 10.40.50.1 / 255.255.255.252 / gw 10.40.50.2; IPv6 2021:200:F:A::1/64, gateway FE80::1.

## The 48 graded items
ARIEL 14 (MOTD, console pw, hostname, .50 VLAN ID+IP, .500 native+IP, .75 VLAN ID+IP, G0/0/1 IP, IPv6 addr+prefix, link-local, VTY pw);
BELLE 11 (domain, Fa0/10, Fa0/9, G0/1 native, Vlan500 IP, modulus bits, VLAN 50 name, VTY 4 & 11 login + transport input);
SNOW 5 (Fa0/1, Fa0/2 access, Fa0/9 native, Vlan500 mask, VLAN 75 name);
WHITE 6 (Fa0/1, Fa0/2 access, Fa0/10 native, Vlan500 IP + mask, VLAN 500 name);
DNS SVR 4; PC0 4; Laptop1 4.
Not graded: enable secret, switch default gateways, PC1, Laptop0.
