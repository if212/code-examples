# Infrastructure playbook: deployments, networks, threat models

Where each part runs, what can reach what, where data crosses a trust boundary.
Runtime calls: `playbooks/architecture.md`; roles and keys: `reference/design-system.md`.

## 1. Pick the view

| The reader asks | Start from | Holds at 800px |
|---|---|---|
| Where does each part run, how many copies? | `${CLAUDE_SKILL_DIR}/templates/deployment.d2` | 3 nesting levels, 3 workloads over 3 sinks: 792x846 |
| What can reach what, through which gateway or rule? | `${CLAUDE_SKILL_DIR}/templates/network.d2` | 1 VPC x 2 AZs x 2 subnet tiers x 2 nodes, 1 data service: 794x834 |
| Where does data cross a trust boundary, and what crosses? | `${CLAUDE_SKILL_DIR}/templates/threat-model.d2` | 3 boundaries, 9 elements, 7 flows: 530x816 |

"Our AWS infra from Terraform" asks both: a deployment and a network diagram.
Past a budget: one diagram per cluster, VPC or trust zone, plus an overview.

## 2. Deployment and Kubernetes

- Nesting is real containment: cloud (`boundary`) > cluster (`zone`) >
  namespace (`zone`; `boundary` when the request says "namespace boundary").
  A focal workload never sits on a `zone-blue` panel. Each level costs ~80px
  of height: three fit 800px; `direction: right` with three was 1342px.
- One card per workload: `style.multiple: true`, the count in the label
  (three pod boxes in a group took a 1015px canvas, 11px text).
- Sinks straight under the workload that uses each, no zone of their own (a
  Data zone cost 85px). A sink fed from deep inside is lifted: `pg <- api`
  puts it in the top rank beside the entry, its edge straight (a hidden pin
  edge did not move it).
- Attachments (HPA, ConfigMap, Secret, PVC) sit in the row under their
  workload, written workload first: `api <- hpa: scales`; control edges carry
  their verb (`scales`, `reads`, `mounts`); the workload spans its row.
- Label hops that leave a zone (`":5432"`); a hop crossing two borders put
  its label on a border (W-edge-label-on-border): leave it bare.
- Icon cards in one diagram share one label line count, name first
  (`"api-config\nConfigMap"`); mirrored peers share the widest width.
- Icons asked for in a Kubernetes diagram: `k8s` icons for resources, lucide
  for the rest (internet `globe`, load balancer `split`, database `database`
  on a rectangle card), each lucide icon fetched with `--color 326CE5`
  (`${CLAUDE_SKILL_DIR}/workflows/icons.md`).

```d2
# cwd: ../templates
...@neutral-theme
direction: down
classes: {card: {width: 130}; row1: {height: 96}}
ingress: "Ingress\nnginx" {class: [service; tech; card; row1]}
ns: "ns: shop" {
  class: boundary
  svc: "api\nService" {class: [service; tech; card]}
  api: "api\nDeployment x3" {class: [service; tech]; width: 430; style.multiple: true}
  hpa: "api\nHPA" {class: [service; tech; card]}
  config: "api-config\nConfigMap" {class: [service; tech; card]}
  secret: "api-secret\nSecret" {class: [service; tech; card]}
}
pg: "Orders DB\nRDS Postgres" {class: [datastore; tech; card]; height: 107}
ingress -> ns.svc: routes {class: dep}
ns.svc -> ns.api: selects {class: dep}
ns.api <- ns.hpa: scales {class: dep}
ns.api -> ns.config: reads {class: dep}
ns.api -> ns.secret: reads {class: dep}
pg <- ns.api: ":5432" {class: dep}
```

## 3. Network

| Part | How |
|---|---|
| Arrows | allowed traffic, from the side that opens the connection; `dep`, egress `secondary`, keyed "allowed traffic" and "egress" |
| Ports | at the arrow's tail: class `port: {source-arrowhead.style: {font-color: ${ink-600}; font-size: 14}}` (Snowflake brand: `${sf-gray}`) and `source-arrowhead.label: ":5432"`; a mid-edge label added 59px per rank (three: over 900px) |
| VPC | one `boundary`, CIDR and region in its title |
| Subnet | one `zone`, AZ and CIDR on two title lines of 12 characters at most, `label.near: top-center`: centred between the two columns' edges (top-left, the edge into the left node touched the CIDR line) |
| Node | one size in every subnet: `n: {width: 96}` with `compact`; RDS or ElastiCache: ONE node below both AZs (rule 5) |

**1. No AZ frame.** It is one more nesting level (~100px wider) and needs an
ELK flag: name the AZ in each subnet title.

**2. Line the AZ columns up:** one node size, both AZs wired alike so each
tier is one row, AZ b declared mirrored so the gateway sits centred.
Per-AZ copies: `"NAT\ngateway 1a"` (same labels: S-duplicate-label).

**3. A gateway is as wide as the columns it serves** (`width: 520`): its four
edges drop straight; at its natural width four labels sat on bends.

**4. Traffic that points up is written `upper <- lower`** (`vpc.pub_a.nat <-
vpc.app_a.worker`); as `->`, egress crossed twice and the scale fell to 0.88.

**5. No edge between AZs,** except replication (rule 9). A managed Multi-AZ
service is ONE node below both AZs, its subnets in the label: one endpoint,
the standby takes no connections. Two of them: the smaller above, joined by
a hidden `{class: ghost}` edge, each as wide as the columns it serves (the
template keeps one: the second rank cost ~170px).

**6. Rules live in labels.** A node has one parent, so a security group is a
second label line (`"orders-api\nsg-app"`), never a container. Kubernetes
network policies: one zone per namespace, one edge per allowed ingress.

**7. The ingress path forks into both AZs: no `flow`** (a path that forks
into peers stops being one path; W-dogleg measured 448px of drift).

**8. On-premises and VPN: the site is a second `boundary` above the VPC,**
one edge between the two gateways; a lone node inside a subnet had its edge
strike the subnet title: put it in the VPC. Several VPCs: an overview first,
one box per VPC around the transit gateway (attachments `--`).

```d2
# cwd: ../templates
...@neutral-theme
office: "Office 192.168.0.0/16" {
  class: boundary
  fw: "Firewall\nFortiGate" {class: [service; tech]}
}
vpc: "VPC 10.0.0.0/16" {
  class: boundary
  vgw: VPN gateway {class: service}
  erp: "ERP\nEC2, private 1a" {class: [service; tech]}
}
office.fw -> vpc.vgw: "IPsec VPN\nUDP 500, 4500" {class: dep}
vpc.vgw -> vpc.erp: ":443" {class: dep}
```

**9. Replicated pair** (primary -> replica in another AZ): one `async` edge
labelled with the mechanism (`logical replication`); ELK puts the replica a
rank lower, so name the AZ in each label. A grid pair drew diagonals (1130px,
9.9px text); a hidden pin put the label on a bend. A failover is `steps`.

## 4. Threat model (data-flow diagram)

| Element | How |
|---|---|
| External entity | `actor` (grey box), people and third parties alike, outside every boundary: one look per kind, so the DFD needs no key |
| Process | a numbered circle, `"4. Payments"`: `proc: {shape: circle; width: 110; height: 110}` holds 11 characters (at 100 they touched the rim) |
| Data store | `datastore` as wide as a circle (`store: {width: 110}`): one column pitch, so each store drops straight to its process (120 beside 100: the Data boundary stood 46px out, now 18) |
| Trust boundary | one `boundary` per zone, stacked in trust order from the internet down; titles of 9 characters at most |
| Flow | `"what\nprotocol"` at the edge's lower end: class `endlabel` (`target-arrowhead.style` like `port`, same brand swap) and `target-arrowhead.label`; mid-edge labels made the template 1029px tall (aspect 0.47) |

- [ ] Processes numbered: the IDs the threat table (in the doc) cites.
- [ ] The process under review `focal` when the request names it.
- [ ] Arrows follow the data: a read points from the store, written
      `process <- store` (the store stays below; its label, target end, sits by it).

**1. `direction: down`**; `right` drew the template 1538px wide (7.3px text).
**2. One chain of processes per column;** the browser as wide as the DMZ (340)
fans out straight, centred; a circle's fan-out jogged (4 of 7 labels on bends).
**3. Name the data, do not paint the path:** the card-token path forks from
the browser beside the login flow (S-emphasis, peers) and turns to reach
Stripe (W-dogleg): its labels say "card token" instead of `flow`.
**4. The external system beside the data zone keeps a narrow label**
(`"token,\namount\nHTTPS"`; two lines: a 192px void) and `width: 120` (aspect 0.63; 0.58 at 86).
**5. PII and secrets reviews use the same notation:** name the fields in the
label (`"email, name\nHTTPS"`) and draw one boundary per owner.
