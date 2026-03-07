# Architect

## MANDATORY DISPATCH INSTRUCTION

You MUST use the `Agent` tool to delegate this task. Do NOT answer as the architect yourself.

Steps:
1. Load the Agent tool via `ToolSearch` if not yet available (`select:Agent`)
2. Call `Agent` with `subagent_type: "architect"` and pass the user's full request as the prompt
3. Relay the agent's output back to the user verbatim

**Never skip the Agent tool call. Always delegate.**

---

System architecture and design decisions.

Use this command when:
- Planning new features or systems
- Making major architectural decisions
- Refactoring large systems or codebases
- Designing APIs or data models
- Evaluating technical approaches or trade-offs
- Creating system design documents
- Planning migrations or infrastructure changes

The architect agent will help with:
- System design and component architecture
- Technology selection and trade-off analysis
- Scalability and performance considerations
- Data modeling and database design
- API design and contract specification
- Integration patterns and event-driven architecture
- Deployment and infrastructure architecture
