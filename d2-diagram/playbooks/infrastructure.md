# Infrastructure playbook: deployments, networks, threat models

Where each part runs, what can reach what, and where data crosses a trust
boundary. Runtime calls: `${CLAUDE_SKILL_DIR}/playbooks/architecture.md`; roles
and colours: `${CLAUDE_SKILL_DIR}/reference/design-system.md`.

## 1. Pick the view

| The reader asks | Start from | Holds at 800px |
|---|---|---|
| Where does each part run, how many copies? | `${CLAUDE_SKILL_DIR}/templates/deployment.d2` | 3 nesting levels, 10 workload cards |
| What can reach what, through which gateway or rule? | `${CLAUDE_SKILL_DIR}/templates/network.d2` | 1 VPC x 2 AZs x 3 subnet tiers x 2 nodes |
| Where does data cross a trust boundary, and what crosses? | `${CLAUDE_SKILL_DIR}/templates/threat-model.d2` | 3 boundaries, 10 elements, 10 flows |

"Our AWS infra from Terraform" asks both: a deployment and a network diagram.
Past a budget: one diagram per cluster, VPC or trust zone, plus an overview.

## 2. Deployment and Kubernetes

- Nesting is real containment: cloud (`boundary`) > cluster (`zone`) >
  namespace (`zone-blue` when it is the focus). Each level adds 50px per side:
  three fit 800px; `direction: right` with three was 1342px (8.3px text).
- One card per workload: `style.multiple: true`, the count in the label (121px
  wide; three pod boxes in a group took 356px and a 1015px canvas, 11px text).
- Sinks in one data zone, each below the workload that uses it: all vertical.
- Label hops that leave a zone (`":5432"`); a hop crossing two borders put its
  label on a border (W-edge-label-on-border): leave it bare.

```d2
# cwd: ../templates
...@neutral-theme
aws: AWS us-east-1 {
  class: boundary
  eks: EKS prod {
    class: zone
    shop: "ns: shop" {
      class: zone-blue
      api: "orders-api\n3 pods" {class: [service; focal]; style.multiple: true}
    }
  }
  data: Data {
    class: zone
    rds: "Orders DB\nRDS Postgres" {class: datastore}
  }
}
aws.eks.shop.api -> aws.data.rds: ":5432" {class: flow}
```

## 3. Network

| Part | How |
|---|---|
| Arrows | allowed traffic, from the side that opens the connection, labelled with the port (`":5432"`) or `egress` |
| VPC | one `boundary`, CIDR and region in its title |
| Subnet | one `zone`, AZ and CIDR in its title: `"Public 1a\n10.0.1.0/24"`; CIDRs inside the VPC's, none overlapping |
| Node | one width in every subnet: class `n: {width: 104; height: 56}`, datastores `width: 104` |
| Classes | ingress `flow` (the focus path), data access `dep`, egress `secondary`; every subnet plain `zone` |

**1. No AZ frame.** It is one more nesting level (~100px wider; the template
is 826px, 13.5px text) and needs an ELK flag: name the AZ in each subnet title.

**2. Line the AZ columns up.** Give every node one width (natural cylinders
made the data subnets 327 and 334px beside 328px ones) and wire both AZs
alike, so each tier is one row. Declare AZ b mirrored: the ingress runs down
the outer columns and the gateway sits centred (in the same order, 62px left).
Label the per-AZ copies apart (`"NAT\ngateway 1a"`): identical labels raise
`S-duplicate-label`.

**3. A gateway is as wide as the columns it serves** (`width: 520`): its four
edges drop straight; at its natural width four labels sat on bends.

**4. Traffic that points up is written `upper <- lower`** (`vpc.pub_a.nat <-
vpc.app_a.worker: egress`). Written `->`, egress crossed twice, struck two
subnet titles and widened the canvas to 979px.

**5. No edge between AZs.** One replication edge made the template 1572px
tall (W-tall): write `primary` and `standby` in the labels instead.

**6. Rules live in labels.** A node has one parent, so a security group is a
second label line (`"orders-api\nsg-app"`), never a container. Kubernetes
network policies: one zone per namespace, one edge per allowed ingress.

**7. On-premises and VPN: the site is a second `boundary` above the VPC,** one
edge between the two gateways. A lone node inside a subnet zone had its edge
strike the two-line subnet title (E-edge-through-label): put it in the VPC.

```d2
# cwd: ../templates
...@neutral-theme
office: "Office 192.168.0.0/16" {
  class: boundary
  fw: "Firewall\nFortiGate" {class: service}
}
vpc: "VPC 10.0.0.0/16" {
  class: boundary
  vgw: VPN gateway {class: service}
  erp: "ERP\nEC2, private 1a" {class: [service; focal]}
}
office.fw -> vpc.vgw: "IPsec VPN\nUDP 500, 4500" {class: flow}
vpc.vgw -> vpc.erp: ":443" {class: flow}
```

**8. Several VPCs: an overview first,** one box per VPC around the transit
gateway (attachments are `--`, no direction), then one diagram per VPC.

```d2
# cwd: ../templates
...@neutral-theme
dc: "Data center\n172.16.0.0/12" {class: [service; external]}
tgw: "Transit gateway\nus-east-1" {class: [service; focal]; width: 520}
shared: "Shared VPC\n10.0.0.0/16" {class: service}
prod: "Prod VPC\n10.1.0.0/16" {class: service}
dev: "Dev VPC\n10.2.0.0/16" {class: service}
dc -> tgw: Direct Connect {class: flow}
tgw -- shared: {class: dep}
tgw -- prod: {class: dep}
tgw -- dev: {class: dep}
```

## 4. Threat model (data-flow diagram)

| Element | How |
|---|---|
| External entity | `actor` (people) or `[service; external]` (third parties), outside every boundary |
| Process | a numbered circle, `"4. Payments"`: class `proc: {shape: circle; width: 116; height: 116}` |
| Data store | `datastore`, one width for all |
| Trust boundary | one `boundary` per zone, stacked in trust order from the internet down |
| Flow | every edge labelled `"what\nprotocol"`; the flows under review `flow`, the rest `dep` |

- [ ] Processes numbered: the IDs the threat table (in the doc) cites.
- [ ] One focus: the process under review `focal`, the flows it is about `flow`.
- [ ] Arrows follow the data: a read points from the store,
      `internal.auth <- data.users: "password hash\nSQL"` (`<-` keeps it short).

**1. `direction: down`, labels on two short lines.** `right` drew the template
1538px wide (7.3px text); one-line labels of neighbouring flows overlapped
(E-label-overlap), `"card token\nmTLS"` stays inside its lane.

**2. One chain of processes per column; let wide nodes fan out.** A circle's
ports sit ~40px apart, so a web app feeding Auth and Payments jogged and put
4 of 7 labels on bends. The browser (`width: 300`) fans out straight.

**3. Short names and titles.** A 116px circle holds ~12 characters: the 15
of "2. Checkout API" spilled below it. A boundary title of 9 characters at
most: the edge into the first child struck "Internal network".

**4. PII and secrets reviews use the same notation:** name the fields in the
label (`"email, name\nHTTPS"`) and draw one boundary per owner (our account,
each vendor), so the flow that leaves the account crosses a visible line.
