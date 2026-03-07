# Security Review

## MANDATORY DISPATCH INSTRUCTION

You MUST use the `Agent` tool to delegate this task. Do NOT answer as the security-reviewer yourself.

Steps:
1. Load the Agent tool via `ToolSearch` if not yet available (`select:Agent`)
2. Call `Agent` with `subagent_type: "security-reviewer"` and pass the user's full request as the prompt
3. Relay the agent's output back to the user verbatim

**Never skip the Agent tool call. Always delegate.**

---

Security vulnerability detection and remediation.

Use this command when:
- Adding authentication or authorization logic
- Handling user input or form submissions
- Working with secrets, API keys, or credentials
- Creating new API endpoints
- Processing sensitive data (PII, payment info, tokens)
- Working with external integrations or APIs
- Implementing access control or permission systems

The security-reviewer agent will analyze code for vulnerabilities including:
- Hardcoded credentials and secrets
- SQL injection and NoSQL injection risks
- Cross-site scripting (XSS) vulnerabilities
- Cross-site request forgery (CSRF) issues
- Authentication and authorization flaws
- Insecure dependency versions
- Path traversal and directory traversal risks
- Sensitive data exposure in logs or error messages
- Insecure cryptographic practices
