# Output Contract

Always return results in this shape:

1. `Goal`
2. `Input`
3. `D2 File`
4. `Commands Run`
5. `Artifacts`
6. `Validation`
7. `Formatting`
8. `Notes` (optional)
9. `Failure Diagnosis` (only if failed)

Example:

```text
Goal: Generate architecture diagram for billing domain.
Input: requirements text from user.
D2 File: diagrams/billing-architecture.d2
Commands Run:
  - d2 validate diagrams/billing-architecture.d2
  - d2 fmt diagrams/billing-architecture.d2
  - d2 diagrams/billing-architecture.d2 diagrams/billing-architecture.svg
Artifacts:
  - diagrams/billing-architecture.svg
Validation: passed
Formatting: applied
```
