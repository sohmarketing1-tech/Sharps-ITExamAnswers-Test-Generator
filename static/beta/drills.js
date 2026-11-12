/* AnswrIT drills & mini-games, ported from the classic design.
 * app.js shows the gallery (from AnswritDrills.list) and the page header;
 * AnswritDrills.mount(root, id, ctx) draws one game into root and returns a cleanup function.
 * The question data below is copied unchanged from the classic static/app.js.
 */
(function () {
    "use strict";

    function topologySvg(inner) {
        return `<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
    }

    // ─── Game data (verbatim from the classic site) ─────────────────────────
    const PORT_DATA = [
        { port: 21, service: "FTP" },
        { port: 22, service: "SSH" },
        { port: 23, service: "Telnet" },
        { port: 25, service: "SMTP" },
        { port: 53, service: "DNS" },
        { port: 67, service: "DHCP" },
        { port: 69, service: "TFTP" },
        { port: 80, service: "HTTP" },
        { port: 110, service: "POP3" },
        { port: 123, service: "NTP" },
        { port: 143, service: "IMAP" },
        { port: 161, service: "SNMP" },
        { port: 389, service: "LDAP" },
        { port: 443, service: "HTTPS" },
        { port: 445, service: "SMB" },
        { port: 514, service: "Syslog" },
        { port: 3306, service: "MySQL" },
        { port: 3389, service: "RDP" },
    ];

    const CLI_DATA = [
        { command: "show running-config", desc: "Displays the current active configuration running in memory." },
        { command: "show ip interface brief", desc: "Shows a summary of each interface's IP address and up/down status." },
        { command: "show interfaces", desc: "Displays detailed statistics for all interfaces, including packet counts and errors." },
        { command: "show ip route", desc: "Displays the device's routing table." },
        { command: "show vlan brief", desc: "Lists all VLANs configured on the switch and which ports belong to each." },
        { command: "show mac address-table", desc: "Displays the MAC addresses the switch has learned and their associated ports." },
        { command: "ping", desc: "Tests reachability of another device by sending ICMP echo requests." },
        { command: "traceroute", desc: "Shows the path (hop by hop) packets take to reach a destination." },
        { command: "configure terminal", desc: "Enters global configuration mode so you can change device settings." },
        { command: "interface vlan 1", desc: "Enters configuration mode for the VLAN 1 virtual interface." },
        { command: "ip address 192.168.1.1 255.255.255.0", desc: "Assigns an IP address and subnet mask to the current interface." },
        { command: "no shutdown", desc: "Administratively enables an interface (brings it up)." },
        { command: "hostname R1", desc: "Sets the device's hostname, shown in the CLI prompt." },
        { command: "enable", desc: "Enters privileged EXEC mode, unlocking more powerful commands." },
        { command: "copy running-config startup-config", desc: "Saves the current running configuration so it persists after a reboot." },
        { command: "reload", desc: "Restarts the device." },
        { command: "show version", desc: "Displays the IOS version, uptime, and hardware details of the device." },
        { command: "show cdp neighbors", desc: "Lists directly connected Cisco devices discovered via CDP." },
    ];

    const OSI_LAYERS = [
        { num: 7, name: "Application" },
        { num: 6, name: "Presentation" },
        { num: 5, name: "Session" },
        { num: 4, name: "Transport" },
        { num: 3, name: "Network" },
        { num: 2, name: "Data Link" },
        { num: 1, name: "Physical" },
    ];

    const ACRONYM_DATA = [
        { acronym: "LAN", full: "Local Area Network", desc: "A network confined to a small geographic area, like a home, office, or building." },
        { acronym: "WAN", full: "Wide Area Network", desc: "A network that spans a large geographic area, connecting multiple LANs together." },
        { acronym: "DNS", full: "Domain Name System", desc: "Translates human-readable domain names (like google.com) into IP addresses." },
        { acronym: "DHCP", full: "Dynamic Host Configuration Protocol", desc: "Automatically assigns IP addresses and other network settings to devices." },
        { acronym: "NAT", full: "Network Address Translation", desc: "Translates private IP addresses to a public IP address so devices can reach the internet." },
        { acronym: "VLAN", full: "Virtual Local Area Network", desc: "Logically separates a physical network into multiple isolated broadcast domains." },
        { acronym: "STP", full: "Spanning Tree Protocol", desc: "Prevents switching loops in a network with redundant paths." },
        { acronym: "ARP", full: "Address Resolution Protocol", desc: "Maps an IP address to a MAC address on a local network." },
        { acronym: "ICMP", full: "Internet Control Message Protocol", desc: "Used for diagnostics and error reporting, like ping and traceroute." },
        { acronym: "TCP", full: "Transmission Control Protocol", desc: "A connection-oriented protocol that guarantees reliable, ordered delivery of data." },
        { acronym: "UDP", full: "User Datagram Protocol", desc: "A connectionless protocol that sends data fast but without delivery guarantees." },
        { acronym: "IP", full: "Internet Protocol", desc: "The core protocol for addressing and routing packets across networks." },
        { acronym: "MAC", full: "Media Access Control", desc: "A hardware address burned into a network interface card, unique to that device." },
        { acronym: "OSI", full: "Open Systems Interconnection", desc: "A 7-layer conceptual model describing how network communication works." },
        { acronym: "VPN", full: "Virtual Private Network", desc: "Creates a secure, encrypted tunnel over a public network like the internet." },
        { acronym: "FTP", full: "File Transfer Protocol", desc: "Used to transfer files between a client and server over a network." },
        { acronym: "HTTP", full: "HyperText Transfer Protocol", desc: "The protocol used to load websites in a browser." },
        { acronym: "HTTPS", full: "HTTP Secure", desc: "HTTP encrypted with TLS/SSL for secure web browsing." },
        { acronym: "SSH", full: "Secure Shell", desc: "Provides an encrypted way to remotely access and manage a device's command line." },
        { acronym: "RDP", full: "Remote Desktop Protocol", desc: "Allows remote graphical access to a Windows computer's desktop." },
        { acronym: "SNMP", full: "Simple Network Management Protocol", desc: "Used to monitor and manage devices on a network, like switches and routers." },
        { acronym: "SMTP", full: "Simple Mail Transfer Protocol", desc: "Used to send email between mail servers." },
        { acronym: "POP3", full: "Post Office Protocol version 3", desc: "Downloads email from a server to a single device, typically removing it from the server." },
        { acronym: "IMAP", full: "Internet Message Access Protocol", desc: "Syncs email across multiple devices by keeping messages on the server." },
        { acronym: "CIDR", full: "Classless Inter-Domain Routing", desc: "A method for allocating IP addresses using variable-length prefixes, like /24." },
        { acronym: "VLSM", full: "Variable Length Subnet Masking", desc: "Allows subnets of different sizes within the same network for efficient addressing." },
        { acronym: "ACL", full: "Access Control List", desc: "A set of rules that permit or deny traffic based on criteria like IP address or port." },
        { acronym: "QoS", full: "Quality of Service", desc: "Prioritizes certain types of network traffic (like voice or video) over others." },
        { acronym: "VoIP", full: "Voice over IP", desc: "Transmits voice calls as data over an IP network instead of traditional phone lines." },
        { acronym: "ISP", full: "Internet Service Provider", desc: "A company that provides internet access to homes and businesses." },
    ];

    const PROCESS_DATA = {
        tcp: [
            { num: 1, name: "SYN (client → server)" },
            { num: 2, name: "SYN-ACK (server → client)" },
            { num: 3, name: "ACK (client → server)" },
        ],
        dora: [
            { num: 1, name: "Discover (client broadcasts)" },
            { num: 2, name: "Offer (server responds)" },
            { num: 3, name: "Request (client requests offered IP)" },
            { num: 4, name: "Acknowledge (server confirms)" },
        ],
    };

    const RAID_DATA = [
        { level: "RAID 0", desc: "Stripes data across drives for speed, but has zero fault tolerance — one drive failure loses everything." },
        { level: "RAID 1", desc: "Mirrors data across two drives for full redundancy, at the cost of half your usable storage." },
        { level: "RAID 5", desc: "Stripes data and parity across 3+ drives, tolerating a single drive failure without data loss." },
        { level: "RAID 6", desc: "Like RAID 5 but with double parity, tolerating two simultaneous drive failures." },
        { level: "RAID 10", desc: "Combines mirroring and striping (mirrored pairs, then striped) for both speed and redundancy." },
    ];

    const IPV4_CATEGORIES = ["Private", "Public", "Loopback", "APIPA / Link-Local", "Multicast"];

    const OS_CMD_DATA = [
        { command: "ipconfig /all", desc: "(Windows) Displays detailed IP configuration for all network adapters." },
        { command: "ifconfig", desc: "(Linux/Unix) Displays or configures network interface settings." },
        { command: "ip addr show", desc: "(Linux) Displays IP addresses and network interface information." },
        { command: "netstat -an", desc: "Displays all active network connections and listening ports." },
        { command: "nslookup", desc: "Queries DNS to resolve a hostname to an IP address (or vice versa)." },
        { command: "ping", desc: "Tests connectivity to another host by sending ICMP echo requests." },
        { command: "tracert", desc: "(Windows) Shows the path packets take to a destination, hop by hop." },
        { command: "traceroute", desc: "(Linux/Unix) Shows the path packets take to a destination, hop by hop." },
        { command: "chmod 755 file.sh", desc: "(Linux) Changes file permissions — here, read/write/execute for owner, read/execute for others." },
        { command: "chown user:group file", desc: "(Linux) Changes the owner and group of a file." },
        { command: "grep -i error log.txt", desc: "(Linux) Searches a file for lines matching a pattern, ignoring case." },
        { command: "ls -la", desc: "(Linux) Lists all files in a directory, including hidden ones, with detailed info." },
        { command: "sudo systemctl restart sshd", desc: "(Linux) Restarts the SSH service with elevated privileges." },
        { command: "tasklist", desc: "(Windows) Lists all currently running processes." },
        { command: "ps aux", desc: "(Linux) Lists all currently running processes with detailed info." },
        { command: "kill -9 1234", desc: "(Linux) Forcefully terminates the process with PID 1234." },
        { command: "taskkill /PID 1234 /F", desc: "(Windows) Forcefully terminates the process with PID 1234." },
        { command: "netsh winsock reset", desc: "(Windows) Resets the Winsock catalog, often used to fix network stack issues." },
        { command: "df -h", desc: "(Linux) Shows disk space usage in human-readable format." },
        { command: "route print", desc: "(Windows) Displays the local routing table." },
    ];

    const CABLE_DATA = [
        { name: "RJ45", image: "/images/connector-rj45.jpg" },
        { name: "RJ11", image: "/images/connector-rj11.jpg" },
        { name: "Fiber LC", image: "/images/connector-fiber-lc.jpg" },
        { name: "Fiber SC", image: "/images/connector-fiber-sc.jpeg" },
        { name: "Fiber ST", image: "/images/connector-fiber-st.jpeg" },
        { name: "BNC", image: "/images/connector-bnc.jpg" },
        { name: "DB9", image: "/images/connector-db9.jpg" },
        { name: "DB25", image: "/images/connector-db25.jpg" },
    ];

    const TOPOLOGY_DATA = [
        {
            name: "Star",
            svg: topologySvg(`
                <line class="topology-line" x1="150" y1="100" x2="220" y2="100"/>
                <line class="topology-line" x1="150" y1="100" x2="185" y2="39"/>
                <line class="topology-line" x1="150" y1="100" x2="115" y2="39"/>
                <line class="topology-line" x1="150" y1="100" x2="80" y2="100"/>
                <line class="topology-line" x1="150" y1="100" x2="115" y2="161"/>
                <line class="topology-line" x1="150" y1="100" x2="185" y2="161"/>
                <circle class="topology-node topology-node-center" cx="150" cy="100" r="12"/>
                <circle class="topology-node" cx="220" cy="100" r="9"/>
                <circle class="topology-node" cx="185" cy="39" r="9"/>
                <circle class="topology-node" cx="115" cy="39" r="9"/>
                <circle class="topology-node" cx="80" cy="100" r="9"/>
                <circle class="topology-node" cx="115" cy="161" r="9"/>
                <circle class="topology-node" cx="185" cy="161" r="9"/>
            `),
        },
        {
            name: "Bus",
            svg: topologySvg(`
                <line class="topology-line topology-line-thick" x1="30" y1="100" x2="270" y2="100"/>
                <line class="topology-line" x1="30" y1="85" x2="30" y2="115"/>
                <line class="topology-line" x1="270" y1="85" x2="270" y2="115"/>
                <circle class="topology-node" cx="70" cy="100" r="9"/>
                <circle class="topology-node" cx="120" cy="100" r="9"/>
                <circle class="topology-node" cx="170" cy="100" r="9"/>
                <circle class="topology-node" cx="220" cy="100" r="9"/>
            `),
        },
        {
            name: "Ring",
            svg: topologySvg(`
                <polygon class="topology-line topology-ring" points="220,100 171.6,33.4 93.4,58.9 93.4,141.1 171.6,166.6"/>
                <circle class="topology-node" cx="220" cy="100" r="9"/>
                <circle class="topology-node" cx="171.6" cy="33.4" r="9"/>
                <circle class="topology-node" cx="93.4" cy="58.9" r="9"/>
                <circle class="topology-node" cx="93.4" cy="141.1" r="9"/>
                <circle class="topology-node" cx="171.6" cy="166.6" r="9"/>
            `),
        },
        {
            name: "Mesh",
            svg: topologySvg(`
                <line class="topology-line" x1="220" y1="100" x2="171.6" y2="33.4"/>
                <line class="topology-line" x1="220" y1="100" x2="93.4" y2="58.9"/>
                <line class="topology-line" x1="220" y1="100" x2="93.4" y2="141.1"/>
                <line class="topology-line" x1="220" y1="100" x2="171.6" y2="166.6"/>
                <line class="topology-line" x1="171.6" y1="33.4" x2="93.4" y2="58.9"/>
                <line class="topology-line" x1="171.6" y1="33.4" x2="93.4" y2="141.1"/>
                <line class="topology-line" x1="171.6" y1="33.4" x2="171.6" y2="166.6"/>
                <line class="topology-line" x1="93.4" y1="58.9" x2="93.4" y2="141.1"/>
                <line class="topology-line" x1="93.4" y1="58.9" x2="171.6" y2="166.6"/>
                <line class="topology-line" x1="93.4" y1="141.1" x2="171.6" y2="166.6"/>
                <circle class="topology-node" cx="220" cy="100" r="9"/>
                <circle class="topology-node" cx="171.6" cy="33.4" r="9"/>
                <circle class="topology-node" cx="93.4" cy="58.9" r="9"/>
                <circle class="topology-node" cx="93.4" cy="141.1" r="9"/>
                <circle class="topology-node" cx="171.6" cy="166.6" r="9"/>
            `),
        },
        {
            name: "Tree",
            svg: topologySvg(`
                <line class="topology-line" x1="150" y1="40" x2="90" y2="110"/>
                <line class="topology-line" x1="150" y1="40" x2="210" y2="110"/>
                <line class="topology-line" x1="90" y1="110" x2="60" y2="175"/>
                <line class="topology-line" x1="90" y1="110" x2="120" y2="175"/>
                <line class="topology-line" x1="210" y1="110" x2="180" y2="175"/>
                <line class="topology-line" x1="210" y1="110" x2="240" y2="175"/>
                <circle class="topology-node topology-node-center" cx="150" cy="40" r="10"/>
                <circle class="topology-node" cx="90" cy="110" r="9"/>
                <circle class="topology-node" cx="210" cy="110" r="9"/>
                <circle class="topology-node" cx="60" cy="175" r="8"/>
                <circle class="topology-node" cx="120" cy="175" r="8"/>
                <circle class="topology-node" cx="180" cy="175" r="8"/>
                <circle class="topology-node" cx="240" cy="175" r="8"/>
            `),
        },
    ];

    const SECPLUS_DATA = [
        { term: "CIA Triad", full: "Confidentiality, Integrity, Availability", desc: "The three core goals of information security: keep data private, keep it accurate/unaltered, and keep it accessible when needed." },
        { term: "AAA", full: "Authentication, Authorization, Accounting", desc: "The framework for controlling access: who you are, what you're allowed to do, and a log of what you did." },
        { term: "MFA", full: "Multi-Factor Authentication", desc: "Requires two or more independent credentials (something you know, have, or are) to verify identity." },
        { term: "Zero Trust", full: "Never trust, always verify", desc: "A security model that assumes no user or device is trusted by default, even inside the network perimeter." },
        { term: "Least Privilege", full: "Minimum necessary access", desc: "Users and systems should only have the access rights needed to perform their job, nothing more." },
        { term: "Defense in Depth", full: "Layered security controls", desc: "Uses multiple overlapping security measures so that if one layer fails, others still protect the system." },
        { term: "Phishing", full: "Social engineering via deceptive messages", desc: "An attack that tricks users into revealing sensitive info or clicking malicious links, usually via email." },
        { term: "Ransomware", full: "Malware that encrypts data for extortion", desc: "Malicious software that locks or encrypts a victim's files and demands payment to restore access." },
        { term: "Malware", full: "Malicious software", desc: "Any software designed to damage, disrupt, or gain unauthorized access to a system — viruses, worms, trojans, etc." },
        { term: "Firewall", full: "Traffic filtering device/software", desc: "Monitors and controls incoming/outgoing network traffic based on a defined set of security rules." },
        { term: "IDS", full: "Intrusion Detection System", desc: "Monitors network or system traffic for suspicious activity and alerts administrators, but doesn't block it." },
        { term: "IPS", full: "Intrusion Prevention System", desc: "Like an IDS, but actively blocks or prevents detected threats in real time." },
        { term: "PKI", full: "Public Key Infrastructure", desc: "The system of certificates, keys, and authorities used to manage encryption and digital identity verification." },
        { term: "Symmetric Encryption", full: "Same key encrypts and decrypts", desc: "A single shared secret key is used for both encrypting and decrypting data. Fast, but key distribution is a challenge." },
        { term: "Asymmetric Encryption", full: "Public/private key pair", desc: "Uses a public key to encrypt and a private key to decrypt (or vice versa for signing). Solves key distribution issues." },
        { term: "Hashing", full: "One-way data fingerprint", desc: "Converts data into a fixed-length value that can't be reversed, used to verify integrity (e.g., password storage)." },
        { term: "Social Engineering", full: "Human-based manipulation", desc: "Manipulating people into breaking security procedures or revealing confidential information." },
        { term: "DDoS", full: "Distributed Denial of Service", desc: "Overwhelms a target with traffic from many sources to make a service unavailable." },
        { term: "Patch Management", full: "Keeping software updated", desc: "The process of acquiring, testing, and installing updates to fix vulnerabilities and bugs." },
        { term: "Honeypot", full: "Decoy system", desc: "A trap system designed to lure attackers so their behavior can be observed and studied." },
    ];

    const SERVER_ROLES_DATA = [
        { role: "AD DS (Active Directory Domain Services)", desc: "Provides centralized authentication and a directory of users, computers, and resources in a domain." },
        { role: "DNS Server", desc: "Resolves hostnames to IP addresses (and vice versa) for the network." },
        { role: "DHCP Server", desc: "Automatically assigns IP addresses and network settings to devices as they join the network." },
        { role: "File Server", desc: "Provides centralized storage where users can save, access, and share files over the network." },
        { role: "Print Server", desc: "Manages and shares printers on the network so multiple users can send print jobs to them." },
        { role: "Web Server (IIS)", desc: "Hosts websites and web applications, serving content to clients over HTTP/HTTPS." },
        { role: "Certificate Authority (AD CS)", desc: "Issues and manages digital certificates used for encryption and identity verification." },
        { role: "DFS (Distributed File System)", desc: "Organizes and replicates shared folders across multiple servers into a single logical namespace." },
    ];

    const WIRELESS_DATA = [
        { standard: "802.11a", desc: "Up to 54 Mbps, 5 GHz band. Shorter range than 802.11b due to higher frequency." },
        { standard: "802.11b", desc: "Up to 11 Mbps, 2.4 GHz band. Longer range but slower and more prone to interference." },
        { standard: "802.11g", desc: "Up to 54 Mbps, 2.4 GHz band. Backward compatible with 802.11b." },
        { standard: "802.11n (Wi-Fi 4)", desc: "Up to 600 Mbps using MIMO, operates on both 2.4 GHz and 5 GHz bands." },
        { standard: "802.11ac (Wi-Fi 5)", desc: "Over 1 Gbps using wider channels and MU-MIMO, operates on the 5 GHz band." },
        { standard: "802.11ax (Wi-Fi 6)", desc: "Up to ~9.6 Gbps with OFDMA for better efficiency in crowded networks, operates on 2.4/5/6 GHz." },
    ];

    const LOGIC_GATES = [
        { gate: "AND", inputs: 2, fn: (a, b) => (a && b ? 1 : 0) },
        { gate: "OR", inputs: 2, fn: (a, b) => (a || b ? 1 : 0) },
        { gate: "NOT", inputs: 1, fn: (a) => (a ? 0 : 1) },
        { gate: "XOR", inputs: 2, fn: (a, b) => (a !== b ? 1 : 0) },
        { gate: "NAND", inputs: 2, fn: (a, b) => (a && b ? 0 : 1) },
        { gate: "NOR", inputs: 2, fn: (a, b) => (a || b ? 0 : 1) },
        { gate: "XNOR", inputs: 2, fn: (a, b) => (a === b ? 1 : 0) },
    ];

    const CLOUD_MODELS_DATA = [
        { model: "IaaS (Infrastructure as a Service)", desc: "Provides virtualized computing infrastructure — servers, storage, and networking — that you manage yourself. Example: AWS EC2, Azure VMs." },
        { model: "PaaS (Platform as a Service)", desc: "Provides a platform for developing and deploying applications without managing the underlying infrastructure. Example: Heroku, Azure App Service." },
        { model: "SaaS (Software as a Service)", desc: "Delivers fully-managed software applications over the internet, ready to use. Example: Gmail, Microsoft 365, Salesforce." },
        { model: "DaaS (Desktop as a Service)", desc: "Delivers a virtual desktop environment hosted in the cloud, accessible from any device. Example: Amazon WorkSpaces, Windows 365." },
    ];

    // ─── Gallery list ───────────────────────────────────────────────────────
    // course: which study course the game helps with (inferred from the topic; the classic site had no mapping).
    const LIST = [
        { id: "binary", name: "Binary Game", desc: "Learn to read and build binary numbers", group: "Networking", course: "ccna" },
        { id: "subnetDrills", name: "Subnetting", desc: "Unlimited subnet drills", group: "Networking", course: "ccna" },
        { id: "portMatch", name: "Port Match", desc: "Match ports to services", group: "Networking", course: "ccna" },
        { id: "osiSorter", name: "OSI Sorter", desc: "Put the 7 layers in order", group: "Networking", course: "ccna" },
        { id: "acronymDrill", name: "Acronym Drill", desc: "Flip cards for IT acronyms", group: "Networking", course: "ccna" },
        { id: "cliMatch", name: "Command Match", desc: "Cisco IOS command drills", group: "Networking", course: "ccna" },
        { id: "processSorter", name: "Process Sorter", desc: "TCP handshake & DHCP DORA", group: "Networking", course: "ccna" },
        { id: "ipv4Classify", name: "IPv4 Classifier", desc: "Public, private, or special?", group: "Networking", course: "ccna" },
        { id: "topologyId", name: "Topology ID", desc: "Star, bus, ring, mesh & tree", group: "Networking", course: "ccna" },
        { id: "wirelessMatch", name: "Wireless Standards", desc: "802.11 a/b/g/n/ac/ax", group: "Networking", course: "ite" },
        { id: "cableId", name: "Cable ID", desc: "Identify connectors & cables", group: "Hardware & OS", course: "ite" },
        { id: "raidMatch", name: "RAID Match", desc: "Learn the RAID levels", group: "Hardware & OS", course: "ite" },
        { id: "osCmdMatch", name: "OS Command Match", desc: "Windows & Linux commands", group: "Hardware & OS", course: "ite" },
        { id: "serverRoles", name: "Server Roles Match", desc: "AD DS, DNS, DHCP & more", group: "Hardware & OS", course: "ite" },
        { id: "cloudModels", name: "Cloud Service Models", desc: "IaaS, PaaS, SaaS & DaaS", group: "Hardware & OS", course: "ite" },
        { id: "ohmsLaw", name: "Ohm's Law Calculator", desc: "Solve for V, I, R, or P", group: "Hardware & OS", course: "ite" },
        { id: "logicGates", name: "Logic Gates", desc: "AND, OR, NOT, XOR & more", group: "Hardware & OS", course: "ite" },
        { id: "secplusFlash", name: "Security+ Flashcards", desc: "Core cybersecurity concepts", group: "Security", course: "general" },
    ];

    // Short instructions shown at the top of each game (from the classic screen subtitles).
    const INTRO = {
        binary: "Tap the switches to match the target number. This is the one skill you need before subnetting will make sense.",
        subnetDrills: "Unlimited random practice problems with instant feedback and a full binary breakdown.",
        portMatch: "Match common port numbers to the services that use them.",
        osiSorter: "Tap the 7 OSI layers in order, from Application (7) down to Physical (1).",
        acronymDrill: "Flip through the acronyms every IT student needs to know cold.",
        cliMatch: "Match Cisco IOS commands to what they actually do.",
        processSorter: "Tap the steps of a network process in the correct order.",
        raidMatch: "Match each RAID level to what it actually does.",
        ipv4Classify: "Classify each address: public, private, loopback, APIPA, or multicast.",
        osCmdMatch: "Windows and Linux commands: know what each one actually does.",
        cableId: "Identify the connector or cable type shown.",
        topologyId: "Identify the network topology diagram shown.",
        secplusFlash: "Flip through core cybersecurity concepts.",
        serverRoles: "Match each server role to what it does.",
        ohmsLaw: "Enter any two values to solve for the rest. V = I × R, P = V × I.",
        wirelessMatch: "Match each 802.11 Wi-Fi standard to its specs.",
        logicGates: "Solve the output of each Boolean logic gate.",
        cloudModels: "Match each cloud model to what it provides.",
    };

    // ─── Helpers ────────────────────────────────────────────────────────────
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function ipToInt(ip) { return ip.split(".").reduce((acc, o) => (acc << 8) + parseInt(o, 10), 0) >>> 0; }
    function intToIp(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."); }
    function toBinaryOctets(ip) { return ip.split(".").map((o) => parseInt(o, 10).toString(2).padStart(8, "0")).join("."); }
    function randomBaseIp(cls) {
        if (cls === "A") return `${randInt(1, 126)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(0, 255)}`;
        if (cls === "B") return `${randInt(128, 191)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(0, 255)}`;
        return `${randInt(192, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(0, 255)}`;
    }
    function computeSubnetInfo(ipStr, cidr) {
        const ipInt = ipToInt(ipStr);
        const maskInt = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
        const network = (ipInt & maskInt) >>> 0;
        const hostBits = 32 - cidr;
        const broadcast = (network | (hostBits === 0 ? 0 : (0xFFFFFFFF >>> cidr))) >>> 0;
        const hosts = hostBits >= 2 ? Math.pow(2, hostBits) - 2 : 0;
        return {
            network: intToIp(network), broadcast: intToIp(broadcast),
            first: intToIp(hosts > 0 ? network + 1 : network), last: intToIp(hosts > 0 ? broadcast - 1 : broadcast),
            hosts, mask: intToIp(maskInt), cidr,
        };
    }
    function generateRandomIpv4(category) {
        switch (category) {
            case "Private": {
                const kind = randInt(0, 2);
                if (kind === 0) return `10.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
                if (kind === 1) return `172.${randInt(16, 31)}.${randInt(0, 255)}.${randInt(1, 254)}`;
                return `192.168.${randInt(0, 255)}.${randInt(1, 254)}`;
            }
            case "Loopback": return `127.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
            case "APIPA / Link-Local": return `169.254.${randInt(0, 255)}.${randInt(1, 254)}`;
            case "Multicast": return `${randInt(224, 239)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
            default: {
                let first;
                do { first = randInt(1, 223); } while ([10, 127, 172, 192].includes(first) || (first >= 224 && first <= 239));
                return `${first}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
            }
        }
    }
    function pickNew(list, prev) {
        let item;
        do { item = list[randInt(0, list.length - 1)]; } while (item === prev && list.length > 1);
        return item;
    }

    const CHECK = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
    const CROSS = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    // ─── Shared pieces ──────────────────────────────────────────────────────
    function makeCtx(root, id, opts) {
        const timers = new Set();
        let dead = false;
        const ctx = {
            root, id,
            esc: opts.esc,
            shuffle: opts.shuffle,
            alive: () => !dead && (typeof opts.alive !== "function" || opts.alive()),
            later(fn, ms) {
                const t = setTimeout(() => { timers.delete(t); if (ctx.alive()) fn(); }, ms);
                timers.add(t);
            },
            cleanup() { dead = true; timers.forEach(clearTimeout); timers.clear(); },
            $: (sel) => root.querySelector(sel),
            $$: (sel) => Array.from(root.querySelectorAll(sel)),
        };
        return ctx;
    }

    function introHtml(ctx) { return `<p class="drill-intro muted">${ctx.esc(INTRO[ctx.id] || "")}</p>`; }

    function toggleHtml(label, name, options, current) {
        return `
            <div class="drill-toggle">
                <span class="drill-toggle-label">${label}</span>
                <div class="segmented${options.length === 3 ? " drill-seg-3" : ""}" role="group" aria-label="${label}">
                    ${options.map(([key, text]) => `<button type="button" data-${name}="${key}" aria-pressed="${key === current}">${text}</button>`).join("")}
                </div>
            </div>`;
    }
    function bindToggle(ctx, name, onPick) {
        ctx.$$(`[data-${name}]`).forEach((b) => {
            b.addEventListener("click", () => {
                ctx.$$(`[data-${name}]`).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
                onPick(b.dataset[name]);
            });
        });
    }

    function statsHtml(labels) {
        return `<div class="stat-grid drill-stats">${labels.map(([k, label, start]) =>
            `<div class="stat"><strong data-stat="${k}">${start}</strong><span>${label}</span></div>`).join("")}</div>`;
    }
    function setStat(ctx, k, v) { const n = ctx.$(`[data-stat="${k}"]`); if (n) n.textContent = v; }
    function accuracy(solved, correct) { return solved ? `${Math.round((correct / solved) * 100)}%` : "—"; }

    function setMsg(ctx, text, kind = "") {
        const m = ctx.$(".drill-msg");
        if (!m) return;
        m.textContent = text;
        m.className = "drill-msg" + (kind ? " " + kind : "");
    }

    // ─── Multiple-choice games (most of the drills) ─────────────────────────
    // cfg.next(prev) returns { item, prompt, label, visual?, mono?, correct, choices, wrong, shuffleChoices? }.
    function choiceGame(ctx, cfg) {
        const s = { solved: 0, correct: 0, current: null, answered: false };
        ctx.root.innerHTML = `
            <div class="drill">
                ${introHtml(ctx)}
                ${cfg.toggle ? `<div class="card drill-setup">${cfg.toggle.html}</div>` : ""}
                <div class="card drill-card">
                    <p class="drill-label"></p>
                    <div class="drill-q"></div>
                    <div class="drill-choices${cfg.text ? "" : " short"}"></div>
                    <p class="drill-msg" role="status" aria-live="polite"></p>
                    <button type="button" class="btn btn-secondary btn-block" data-act="skip">Skip / New question</button>
                </div>
                ${statsHtml([["solved", "Solved", 0], ["correct", "Correct", 0], ["acc", "Accuracy", "—"]])}
            </div>`;
        function stats() {
            setStat(ctx, "solved", s.solved);
            setStat(ctx, "correct", s.correct);
            setStat(ctx, "acc", accuracy(s.solved, s.correct));
        }
        function render() {
            const q = cfg.next(s.current && s.current.item);
            s.current = q;
            s.answered = false;
            ctx.$(".drill-label").textContent = q.label;
            const box = ctx.$(".drill-q");
            box.className = "drill-q" + (q.visual ? " visual" : "") + (q.mono ? " mono" : "") + (cfg.text ? " long" : "");
            box.innerHTML = q.visual || ctx.esc(q.prompt);
            const choices = q.shuffleChoices === false ? q.choices : ctx.shuffle(q.choices);
            const wrap = ctx.$(".drill-choices");
            wrap.innerHTML = choices.map((c) =>
                `<button type="button" class="option drill-choice" data-value="${ctx.esc(String(c))}"><span class="drill-choice-text">${ctx.esc(String(c))}</span><span class="drill-choice-mark"></span></button>`).join("");
            wrap.querySelectorAll(".drill-choice").forEach((b) => b.addEventListener("click", () => answer(b)));
            setMsg(ctx, "");
        }
        function answer(btn) {
            if (s.answered) return;
            s.answered = true;
            s.solved += 1;
            const correct = String(s.current.correct);
            const ok = btn.dataset.value === correct;
            if (ok) s.correct += 1;
            ctx.$$(".drill-choice").forEach((b) => {
                b.disabled = true;
                if (b.dataset.value === correct) { b.classList.add("is-correct"); b.querySelector(".drill-choice-mark").innerHTML = CHECK; }
            });
            if (!ok) { btn.classList.add("is-wrong"); btn.querySelector(".drill-choice-mark").innerHTML = CROSS; }
            setMsg(ctx, ok ? "Correct!" : s.current.wrong, ok ? "good" : "bad");
            stats();
            ctx.later(render, cfg.delay);
        }
        ctx.$('[data-act="skip"]').addEventListener("click", render);
        if (cfg.toggle) cfg.toggle.bind(render);
        render();
    }

    // Matches an item to its description: 1 right answer plus 3 others from the same list.
    function describeGame(ctx, list, key, label, { delay = 1100, mono = false } = {}) {
        choiceGame(ctx, {
            text: true, delay,
            next(prev) {
                const item = pickNew(list, prev);
                const wrong = ctx.shuffle(list.filter((x) => x !== item)).slice(0, 3).map((x) => x.desc);
                return { item, label, prompt: item[key], mono, correct: item.desc, choices: [item.desc, ...wrong], wrong: "Not quite. Check the highlighted answer." };
            },
        });
    }

    const GAMES = {};

    GAMES.portMatch = (ctx) => {
        let dir = "forward";
        choiceGame(ctx, {
            delay: 900,
            toggle: {
                html: toggleHtml("Direction", "dir", [["forward", "Port → Service"], ["reverse", "Service → Port"]], dir),
                bind: (rerender) => bindToggle(ctx, "dir", (d) => { dir = d; rerender(); }),
            },
            next(prev) {
                const item = pickNew(PORT_DATA, prev);
                const fwd = dir === "forward";
                const correct = fwd ? item.service : item.port;
                const wrong = ctx.shuffle(PORT_DATA.filter((x) => x !== item)).slice(0, 3).map((x) => (fwd ? x.service : x.port));
                return {
                    item, label: fwd ? "What service uses this port?" : "What port does this service use?",
                    prompt: fwd ? item.port : item.service, correct, choices: [correct, ...wrong],
                    wrong: `Not quite. The answer is ${correct}.`,
                };
            },
        });
    };
    GAMES.cliMatch = (ctx) => describeGame(ctx, CLI_DATA, "command", "What does this command do?", { mono: true });
    GAMES.raidMatch = (ctx) => describeGame(ctx, RAID_DATA, "level", "What does this RAID level do?");
    GAMES.osCmdMatch = (ctx) => describeGame(ctx, OS_CMD_DATA, "command", "What does this command do?", { mono: true });
    GAMES.serverRoles = (ctx) => describeGame(ctx, SERVER_ROLES_DATA, "role", "What does this server role do?");
    GAMES.wirelessMatch = (ctx) => describeGame(ctx, WIRELESS_DATA, "standard", "What describes this Wi-Fi standard?");
    GAMES.cloudModels = (ctx) => describeGame(ctx, CLOUD_MODELS_DATA, "model", "What does this cloud service model provide?");

    GAMES.ipv4Classify = (ctx) => choiceGame(ctx, {
        delay: 1000,
        next() {
            const category = IPV4_CATEGORIES[randInt(0, IPV4_CATEGORIES.length - 1)];
            const wrong = ctx.shuffle(IPV4_CATEGORIES.filter((x) => x !== category)).slice(0, 3);
            return {
                item: null, label: "How would you classify this address?", prompt: generateRandomIpv4(category), mono: true,
                correct: category, choices: [category, ...wrong], wrong: `Not quite. This is ${category}.`,
            };
        },
    });

    GAMES.cableId = (ctx) => choiceGame(ctx, {
        delay: 1000,
        next(prev) {
            const item = pickNew(CABLE_DATA, prev);
            const wrong = ctx.shuffle(CABLE_DATA.filter((x) => x !== item)).slice(0, 3).map((x) => x.name);
            return {
                item, label: "What is this connector or cable?",
                visual: `<img class="drill-img" src="${ctx.esc(item.image)}" alt="Identify this connector">`,
                correct: item.name, choices: [item.name, ...wrong], wrong: `Not quite. This is ${item.name}.`,
            };
        },
    });

    GAMES.topologyId = (ctx) => choiceGame(ctx, {
        delay: 1000,
        next(prev) {
            const item = pickNew(TOPOLOGY_DATA, prev);
            const wrong = ctx.shuffle(TOPOLOGY_DATA.filter((x) => x !== item)).slice(0, 3).map((x) => x.name);
            return {
                item, label: "What topology is this?", visual: `<div class="drill-topology">${item.svg}</div>`,
                correct: item.name, choices: [item.name, ...wrong], wrong: `Not quite. This is a ${item.name} topology.`,
            };
        },
    });

    GAMES.logicGates = (ctx) => choiceGame(ctx, {
        delay: 800,
        next() {
            const gate = LOGIC_GATES[randInt(0, LOGIC_GATES.length - 1)];
            const a = randInt(0, 1);
            const b = randInt(0, 1);
            const output = gate.inputs === 1 ? gate.fn(a) : gate.fn(a, b);
            return {
                item: null, label: "What is the output?", mono: true,
                prompt: gate.inputs === 1 ? `${gate.gate}(${a}) = ?` : `${gate.gate}(${a}, ${b}) = ?`,
                correct: output, choices: [0, 1], shuffleChoices: false, wrong: `Not quite. The answer is ${output}.`,
            };
        },
    });

    // ─── Binary Game ────────────────────────────────────────────────────────
    GAMES.binary = (ctx) => {
        const g = { bits: 8, difficulty: "easy", target: -1, values: [], solved: 0, streak: 0, best: 0, locked: false };
        ctx.root.innerHTML = `
            <div class="drill">
                ${introHtml(ctx)}
                <div class="card drill-setup">${toggleHtml("Difficulty", "diff", [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]], g.difficulty)}</div>
                <div class="card drill-card">
                    <p class="drill-label">Build this number</p>
                    <div class="drill-q drill-big" data-el="target">0</div>
                    <div class="drill-bits" data-el="bits"></div>
                    <p class="drill-current" data-el="current-row">Your binary = <strong data-el="current">0</strong></p>
                    <p class="drill-msg" role="status" aria-live="polite"></p>
                    <button type="button" class="btn btn-secondary btn-block" data-act="skip">Skip / New number</button>
                </div>
                ${statsHtml([["solved", "Solved", 0], ["streak", "Streak", 0], ["best", "Best streak", 0]])}
            </div>`;
        const stats = () => { setStat(ctx, "solved", g.solved); setStat(ctx, "streak", g.streak); setStat(ctx, "best", g.best); };
        const current = () => g.values.reduce((acc, bit, i) => acc + bit * Math.pow(2, g.bits - 1 - i), 0);
        function render() {
            const showPlaces = g.difficulty === "easy";
            ctx.$('[data-el="target"]').textContent = g.target;
            ctx.$('[data-el="current-row"]').hidden = g.difficulty === "hard";
            ctx.$('[data-el="bits"]').innerHTML = g.values.map((v, i) => `
                <button type="button" class="drill-bit${v ? " on" : ""}" data-i="${i}" aria-pressed="${v === 1}" aria-label="Bit worth ${Math.pow(2, g.bits - 1 - i)}">
                    <span class="drill-bit-value">${v}</span>
                    ${showPlaces ? `<span class="drill-bit-place">${Math.pow(2, g.bits - 1 - i)}</span>` : ""}
                </button>`).join("");
            ctx.$$(".drill-bit").forEach((b) => b.addEventListener("click", () => toggle(Number(b.dataset.i), b)));
            ctx.$('[data-el="current"]').textContent = current();
            setMsg(ctx, "");
        }
        function newProblem() {
            const max = Math.pow(2, g.bits) - 1;
            let t;
            do { t = randInt(0, max); } while (t === g.target && max > 1);
            g.target = t;
            g.values = new Array(g.bits).fill(0);
            g.locked = false;
            render();
        }
        function toggle(i, btn) {
            if (g.locked) return;
            g.values[i] = g.values[i] ? 0 : 1;
            btn.classList.toggle("on", g.values[i] === 1);
            btn.setAttribute("aria-pressed", String(g.values[i] === 1));
            btn.querySelector(".drill-bit-value").textContent = g.values[i];
            const now = current();
            ctx.$('[data-el="current"]').textContent = now;
            if (now === g.target) {
                g.locked = true;
                g.solved += 1;
                g.streak += 1;
                if (g.streak > g.best) g.best = g.streak;
                stats();
                setMsg(ctx, "Correct! 🎉", "good");
                ctx.later(newProblem, 700);
            }
        }
        bindToggle(ctx, "diff", (d) => { g.difficulty = d; g.streak = 0; stats(); newProblem(); });
        ctx.$('[data-act="skip"]').addEventListener("click", () => { g.streak = 0; stats(); newProblem(); });
        newProblem();
    };

    // ─── Subnetting ─────────────────────────────────────────────────────────
    GAMES.subnetDrills = (ctx) => {
        const s = { difficulty: "easy", current: null, solved: 0, correct: 0 };
        const FIELDS = [
            ["network", "Network address", "e.g. 192.168.1.0"],
            ["broadcast", "Broadcast address", "e.g. 192.168.1.63"],
            ["first", "First usable host", "e.g. 192.168.1.1"],
            ["last", "Last usable host", "e.g. 192.168.1.62"],
            ["hosts", "Usable hosts", "e.g. 62"],
        ];
        ctx.root.innerHTML = `
            <div class="drill">
                ${introHtml(ctx)}
                <div class="card drill-setup">${toggleHtml("Difficulty", "diff", [["easy", "Class C only"], ["medium", "Mixed classes"], ["hard", "VLSM / host-based"]], s.difficulty)}</div>
                <div class="card drill-card">
                    <p class="drill-label">Given</p>
                    <div class="drill-q mono" data-el="problem">—</div>
                    <form class="drill-fields" data-el="form" novalidate>
                        ${FIELDS.map(([k, label, ph]) => `
                            <div class="field">
                                <label for="drill-sn-${k}">${label}</label>
                                <input class="input" id="drill-sn-${k}" data-field="${k}" placeholder="${ph}" autocomplete="off" autocapitalize="none" spellcheck="false" ${k === "hosts" ? 'inputmode="numeric"' : 'inputmode="decimal"'}>
                            </div>`).join("")}
                        <p class="drill-msg" role="status" aria-live="polite"></p>
                        <div class="btn-row">
                            <button type="submit" class="btn btn-primary">Check answers</button>
                            <button type="button" class="btn btn-secondary" data-act="next">New problem</button>
                        </div>
                    </form>
                    <div class="drill-breakdown" data-el="breakdown" hidden></div>
                </div>
                ${statsHtml([["solved", "Solved", 0], ["correct", "Correct", 0], ["acc", "Accuracy", "—"]])}
            </div>`;
        function generate() {
            let ipStr, cidr, extra = "";
            if (s.difficulty === "easy") {
                ipStr = randomBaseIp("C");
                cidr = randInt(25, 30);
            } else if (s.difficulty === "medium") {
                const cls = ["A", "B", "C"][randInt(0, 2)];
                ipStr = randomBaseIp(cls);
                cidr = cls === "A" ? randInt(9, 28) : cls === "B" ? randInt(17, 29) : randInt(25, 30);
            } else {
                const cls = ["A", "B", "C"][randInt(0, 2)];
                ipStr = randomBaseIp(cls);
                const need = randInt(2, 500);
                let hostBits = 2;
                while (Math.pow(2, hostBits) - 2 < need) hostBits++;
                cidr = 32 - hostBits;
                extra = ` You need at least ${need} usable hosts on this subnet.`;
            }
            s.current = { ipStr, cidr, extra, info: computeSubnetInfo(ipStr, cidr) };
            ctx.$('[data-el="problem"]').textContent = `${ipStr} / ${cidr}${extra}`;
            ctx.$$("[data-field]").forEach((i) => { i.value = ""; i.classList.remove("is-right", "is-wrong"); });
            setMsg(ctx, "");
            const bd = ctx.$('[data-el="breakdown"]');
            bd.hidden = true;
            bd.innerHTML = "";
        }
        function check(e) {
            e.preventDefault();
            const d = s.current;
            if (!d) return;
            const info = d.info;
            const want = {
                network: info.network, broadcast: info.broadcast,
                first: info.hosts > 0 ? info.first : "N/A", last: info.hosts > 0 ? info.last : "N/A",
                hosts: String(info.hosts),
            };
            let all = true;
            ctx.$$("[data-field]").forEach((input) => {
                const ok = input.value.trim().toLowerCase() === String(want[input.dataset.field]).toLowerCase();
                input.classList.toggle("is-right", ok);
                input.classList.toggle("is-wrong", !ok);
                if (!ok) all = false;
            });
            s.solved += 1;
            if (all) s.correct += 1;
            setStat(ctx, "solved", s.solved);
            setStat(ctx, "correct", s.correct);
            setStat(ctx, "acc", accuracy(s.solved, s.correct));
            setMsg(ctx, all ? "All correct! Nice work." : "Some answers were off. Check the breakdown below.", all ? "good" : "bad");
            const bd = ctx.$('[data-el="breakdown"]');
            const row = (label, value) => `<div class="drill-bd-row"><span>${label}</span><code>${value}</code></div>`;
            bd.innerHTML = `
                <h3 class="section-title">Step-by-step breakdown</h3>
                ${row("IP address", `${d.ipStr} → ${toBinaryOctets(d.ipStr)}`)}
                ${row(`Subnet mask (/${d.cidr})`, `${info.mask} → ${toBinaryOctets(info.mask)}`)}
                ${row("Network address", info.network)}
                ${row("Broadcast address", info.broadcast)}
                ${row("Usable host range", info.hosts > 0 ? `${info.first} – ${info.last}` : "None")}
                ${row("Usable hosts", info.hosts)}`;
            bd.hidden = false;
        }
        ctx.$('[data-el="form"]').addEventListener("submit", check);
        ctx.$('[data-act="next"]').addEventListener("click", generate);
        bindToggle(ctx, "diff", (d) => { s.difficulty = d; generate(); });
        generate();
    };

    // ─── Tap-in-order sorters (OSI layers, TCP / DORA) ──────────────────────
    function sorterGame(ctx, { getItems, expected, doneMsg, extraButtons = "", toggle = null, onBind = null }) {
        const s = { order: [], next: 0, mistakes: 0, rounds: 0, best: null, roundId: 0 };
        ctx.root.innerHTML = `
            <div class="drill">
                ${introHtml(ctx)}
                ${toggle ? `<div class="card drill-setup">${toggle}</div>` : ""}
                <div class="card drill-card">
                    <div class="drill-chips" data-el="chips"></div>
                    <p class="drill-msg" role="status" aria-live="polite"></p>
                    <div class="btn-row">${extraButtons}<button type="button" class="btn btn-secondary" data-act="reset">New round</button></div>
                    <div data-el="extra"></div>
                </div>
                ${statsHtml([["rounds", "Rounds completed", 0], ["mistakes", "Mistakes (this round)", 0], ["best", "Best (fewest mistakes)", "—"]])}
            </div>`;
        const stats = () => {
            setStat(ctx, "rounds", s.rounds);
            setStat(ctx, "mistakes", s.mistakes);
            setStat(ctx, "best", s.best === null ? "—" : s.best);
        };
        function start() {
            s.roundId += 1;
            s.order = ctx.shuffle(getItems());
            s.next = 0;
            s.mistakes = 0;
            setMsg(ctx, "");
            stats();
            ctx.$('[data-el="chips"]').innerHTML = s.order.map((it, i) => `
                <button type="button" class="drill-chip" data-i="${i}">
                    <span class="drill-chip-num" aria-hidden="true"></span><span class="drill-chip-name">${ctx.esc(it.name)}</span>
                </button>`).join("");
            ctx.$$(".drill-chip").forEach((b) => b.addEventListener("click", () => tap(s.order[Number(b.dataset.i)], b)));
        }
        function tap(item, chip) {
            if (chip.classList.contains("placed")) return;
            const total = getItems().length;
            if (item.num === expected(s.next)) {
                chip.classList.add("placed");
                chip.disabled = true;
                s.next += 1;
                chip.querySelector(".drill-chip-num").textContent = s.next;
                if (s.next === total) {
                    s.rounds += 1;
                    if (s.best === null || s.mistakes < s.best) s.best = s.mistakes;
                    stats();
                    setMsg(ctx, doneMsg, "good");
                    const id = s.roundId;
                    ctx.later(() => { if (s.roundId === id) start(); }, 1200);
                }
            } else {
                s.mistakes += 1;
                stats();
                chip.classList.remove("shake");
                void chip.offsetWidth;
                chip.classList.add("shake");
                ctx.later(() => chip.classList.remove("shake"), 400);
                setMsg(ctx, "Not next. Try again.", "bad");
            }
        }
        ctx.$('[data-act="reset"]').addEventListener("click", start);
        const api = { start, resetScores() { s.rounds = 0; s.best = null; } };
        if (onBind) onBind(api);
        start();
    }

    GAMES.osiSorter = (ctx) => sorterGame(ctx, {
        getItems: () => OSI_LAYERS,
        expected: (i) => 7 - i,
        doneMsg: "All 7 layers in order! 🎉",
        extraButtons: '<button type="button" class="btn btn-secondary" data-act="mnemonic" aria-expanded="false">Show mnemonic</button>',
        onBind() {
            const btn = ctx.$('[data-act="mnemonic"]');
            const box = ctx.$('[data-el="extra"]');
            btn.addEventListener("click", () => {
                const open = btn.getAttribute("aria-expanded") !== "true";
                btn.setAttribute("aria-expanded", String(open));
                btn.textContent = open ? "Hide mnemonic" : "Show mnemonic";
                box.innerHTML = open ? '<p class="note drill-mnemonic">"All People Seem To Need Data Processing": Application, Presentation, Session, Transport, Network, Data Link, Physical.</p>' : "";
            });
        },
    });

    GAMES.processSorter = (ctx) => {
        let mode = "tcp";
        sorterGame(ctx, {
            getItems: () => PROCESS_DATA[mode],
            expected: (i) => i + 1,
            doneMsg: "Correct sequence! 🎉",
            toggle: toggleHtml("Process", "proc", [["tcp", "TCP handshake"], ["dora", "DHCP (DORA)"]], mode),
            onBind(api) {
                bindToggle(ctx, "proc", (m) => { mode = m; api.resetScores(); api.start(); });
            },
        });
    };

    // ─── Flip-card decks (acronyms, Security+) ──────────────────────────────
    function deckGame(ctx, data, frontKey, label) {
        const s = { deck: ctx.shuffle(data), index: 0, flipped: false };
        ctx.root.innerHTML = `
            <div class="drill">
                ${introHtml(ctx)}
                <p class="drill-counter muted" data-el="counter"></p>
                <button type="button" class="flashcard drill-flash" data-el="card" aria-live="polite"></button>
                <div class="btn-row drill-deck-btns">
                    <button type="button" class="btn btn-secondary" data-act="prev">Previous</button>
                    <button type="button" class="btn btn-primary" data-act="flip">Flip</button>
                    <button type="button" class="btn btn-secondary" data-act="next">Next</button>
                </div>
                <button type="button" class="btn btn-ghost btn-block" data-act="shuffle">Shuffle</button>
            </div>`;
        function render() {
            const item = s.deck[s.index];
            const card = ctx.$('[data-el="card"]');
            card.classList.toggle("back", s.flipped);
            card.innerHTML = s.flipped
                ? `<span class="side">Answer</span><p class="face-text">${ctx.esc(item.full)}</p><p class="drill-flash-desc">${ctx.esc(item.desc)}</p><span class="tap-hint">Tap to flip back</span>`
                : `<span class="side">${label}</span><p class="drill-flash-front">${ctx.esc(item[frontKey])}</p><span class="tap-hint">Tap to flip</span>`;
            ctx.$('[data-el="counter"]').textContent = `${s.index + 1} / ${s.deck.length}`;
        }
        const flip = () => { s.flipped = !s.flipped; render(); };
        const move = (d) => { s.index = (s.index + d + s.deck.length) % s.deck.length; s.flipped = false; render(); };
        ctx.$('[data-el="card"]').addEventListener("click", flip);
        ctx.$('[data-act="flip"]').addEventListener("click", flip);
        ctx.$('[data-act="prev"]').addEventListener("click", () => move(-1));
        ctx.$('[data-act="next"]').addEventListener("click", () => move(1));
        ctx.$('[data-act="shuffle"]').addEventListener("click", () => { s.deck = ctx.shuffle(s.deck); s.index = 0; s.flipped = false; render(); });
        render();
    }
    GAMES.acronymDrill = (ctx) => deckGame(ctx, ACRONYM_DATA, "acronym", "Acronym");
    GAMES.secplusFlash = (ctx) => deckGame(ctx, SECPLUS_DATA, "term", "Term");

    // ─── Ohm's Law Calculator ───────────────────────────────────────────────
    GAMES.ohmsLaw = (ctx) => {
        const FIELDS = [["v", "Voltage (V)", "volts"], ["i", "Current (I)", "amps"], ["r", "Resistance (R)", "ohms"], ["p", "Power (P)", "watts"]];
        ctx.root.innerHTML = `
            <div class="drill">
                ${introHtml(ctx)}
                <form class="card drill-card" data-el="form" novalidate>
                    <div class="drill-ohms-grid">
                        ${FIELDS.map(([k, label, ph]) => `
                            <div class="field">
                                <label for="drill-ohm-${k}">${label}</label>
                                <input class="input" id="drill-ohm-${k}" data-ohm="${k}" type="number" step="any" inputmode="decimal" placeholder="${ph}">
                            </div>`).join("")}
                    </div>
                    <p class="drill-msg" role="status" aria-live="polite"></p>
                    <div class="btn-row">
                        <button type="submit" class="btn btn-primary">Calculate</button>
                        <button type="button" class="btn btn-secondary" data-act="reset">Reset</button>
                    </div>
                </form>
            </div>`;
        const input = (k) => ctx.$(`[data-ohm="${k}"]`);
        const read = (k) => (input(k).value.trim() === "" ? null : parseFloat(input(k).value));
        function calc(e) {
            e.preventDefault();
            const vals = { v: read("v"), i: read("i"), r: read("r"), p: read("p") };
            const known = Object.values(vals).filter((x) => x !== null && !Number.isNaN(x)).length;
            if (known < 2) return setMsg(ctx, "Enter at least two values to solve for the rest.", "bad");
            let { v, i, r, p } = vals;
            if (v !== null && i !== null) { r = r === null ? v / i : r; p = v * i; }
            else if (v !== null && r !== null) { i = i === null ? v / r : i; p = v * (i !== null ? i : v / r); }
            else if (i !== null && r !== null) { v = v === null ? i * r : v; p = (v !== null ? v : i * r) * i; }
            else if (v !== null && p !== null) { i = i === null ? p / v : i; r = r === null ? v / (p / v) : r; }
            else if (i !== null && p !== null) { v = v === null ? p / i : v; r = r === null ? (p / i) / i : r; }
            else if (r !== null && p !== null) { v = v === null ? Math.sqrt(p * r) : v; i = i === null ? Math.sqrt(p / r) : i; }
            else return setMsg(ctx, "Enter at least two values to solve for the rest.", "bad");
            if ([v, i, r, p].some((x) => x === null || Number.isNaN(x) || !Number.isFinite(x))) {
                return setMsg(ctx, "Couldn't solve with those values. Check for a zero denominator.", "bad");
            }
            const round = (n) => Math.round(n * 10000) / 10000;
            input("v").value = round(v);
            input("i").value = round(i);
            input("r").value = round(r);
            input("p").value = round(p);
            setMsg(ctx, `V = ${round(v)}V, I = ${round(i)}A, R = ${round(r)}Ω, P = ${round(p)}W`, "good");
        }
        ctx.$('[data-el="form"]').addEventListener("submit", calc);
        ctx.$('[data-act="reset"]').addEventListener("click", () => { FIELDS.forEach(([k]) => { input(k).value = ""; }); setMsg(ctx, ""); });
    };

    // ─── Public interface ───────────────────────────────────────────────────
    function fallbackEsc(v) {
        return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function fallbackShuffle(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
    }

    window.AnswritDrills = {
        list: LIST,
        has: (id) => Object.prototype.hasOwnProperty.call(GAMES, id),
        mount(root, id, opts = {}) {
            const ctx = makeCtx(root, id, { esc: opts.esc || fallbackEsc, shuffle: opts.shuffle || fallbackShuffle, alive: opts.alive });
            const game = GAMES[id];
            if (!game) {
                root.innerHTML = '<div class="error-box">That drill wasn\'t found.</div>';
                return () => {};
            }
            game(ctx);
            return () => ctx.cleanup();
        },
    };
})();
