# Agent Loop

Use a bounded control loop around the model:

1. classify intent and scope;
2. inspect the owning code path;
3. research only when uncertainty or reference fidelity requires it;
4. plan when the task spans files, risks regression, or needs architectural choice;
5. implement one coherent change;
6. verify observable acceptance;
7. repair only the failing mechanism;
8. stop when proof is sufficient.

Focused subagents should return durable facts, not transcript-sized narratives. Read-only exploration stays isolated from implementation context.
