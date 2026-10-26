# Fifteen engineering ideas — applicability decisions

The full original list was reviewed. This project uses classical probability models, so adding an LLM is not a prerequisite.

| Idea | Actual scope / decision |
| --- | --- |
| 1. Dynamic Context Assembler | No LLM context window; not applicable. |
| 2. Durable State Machine Workflow | Partial conceptual fit: existing transactional approval generation, stale-state protection, restart and rollback. Not Temporal/LangGraph or Slack approval. |
| 3. Raw MCP Server & Client | Deferred: no required agent consumer. Documented read-only artifacts satisfy this workflow. |
| 4. System-One Triage Router | Sport selection is explicit, not learned model triage or a claimed 95/5 split. |
| 5. Self-Correcting Agentic RAG | Outcome replay is not document RAG; not applicable. |
| 6. 3-Tier Memory Engine | Saved rating history is not three-tier agent memory. |
| 7. Trajectory CI Gate | Adapted: reconstruct predictions from scores; enforce date boundaries, receipts and browser-byte integrity. Not an agent golden-DAG grader. |
| 8. Inter-Agent Sanitization Proxy | No multi-agent runtime; not applicable. |
| 9. Voice Interruption Loop | Deferred: unrelated user task and hosting cost. |
| 10. DPO Feedback Flywheel | Not applicable to these classical models. |
| 11. Cost Kill-Switch & Degradation Chain | Zero paid runtime for workbenches; not a Frontier-to-cache cascade. No new live spending. |
| 12. Shadow Routing Comparator | Offline adaptation: frozen Elo/constant comparison and negative-result retention; no live traffic mirror or A/B claim. |
| 13. Computer-Use Fallback Agent | Excluded: unnecessary and conflicts with the user's desktop-control restriction. |
| 14. PII Unmasking Proxy | Public score data, no external LLM path; no reversible anonymization claim. |
| 15. Public Architecture Teardown | Architecture, protocol, results and decisions prepared locally; publication pending, not three published deep dives. |

No complete implementation of all fifteen projects is claimed. The useful influence is recovery, trajectory verification, comparison discipline and inspectable design.
