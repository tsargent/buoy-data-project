# Custom Agents Guide

This directory contains configuration files for specialized AI agents that can assist with specific tasks in the Buoy Data Project.

## Available Agents

### 1. Code Review Agent
**File**: `code-review-agent.md`

**Purpose**: Review code changes for quality, correctness, and adherence to project standards.

**Expertise**:
- TypeScript best practices
- Fastify API design
- Prisma ORM patterns
- BullMQ worker queues
- Real-time streaming
- Error handling and logging

**When to Use**:
- Before submitting pull requests
- After implementing new features
- When refactoring existing code
- For security and performance reviews

**Example Prompt**:
> "Review the changes in `apps/server/src/routes/observations.ts` for TypeScript best practices and API design patterns."

---

### 2. Documentation Agent
**File**: `documentation-agent.md`

**Purpose**: Create and maintain project documentation, API references, and setup guides.

**Expertise**:
- API documentation
- System architecture docs
- Developer onboarding guides
- Code examples and tutorials
- Keeping docs in sync with code

**When to Use**:
- After adding new API endpoints
- When changing database schema
- For documenting new features
- To update outdated documentation
- When creating tutorials

**Example Prompt**:
> "Update the API documentation in `docs/API.md` to include the new `/observations/by-station/:id` endpoint with examples."

---

### 3. Testing Agent
**File**: `testing-agent.md`

**Purpose**: Generate tests, improve test coverage, and ensure code quality through testing.

**Expertise**:
- Vitest configuration
- Unit testing
- Integration testing (API, database)
- Worker job testing
- Test-driven development
- Mock data creation

**When to Use**:
- When adding new features
- Before fixing bugs (to reproduce)
- To improve test coverage
- For testing edge cases
- When setting up test infrastructure

**Example Prompt**:
> "Create integration tests for the `/stations` endpoint that cover success cases, error handling, and edge cases."

---

## How to Use Agents

### With GitHub Copilot
1. Open the relevant agent file in VS Code
2. Copy the agent context into your Copilot chat
3. Provide the specific task and any relevant code/files
4. Let the agent guide your implementation

### With AI Assistants
1. Reference the agent file as context: "Using the guidelines in `.github/agents/code-review-agent.md`..."
2. Provide the specific files or code to review/create/test
3. Follow the agent's recommendations

### General Workflow
1. **Identify the Task**: Determine which agent is best suited
2. **Provide Context**: Share relevant files, code snippets, or descriptions
3. **Be Specific**: Clearly state what you want the agent to do
4. **Iterate**: Refine based on agent feedback
5. **Validate**: Always test and verify agent suggestions

## Agent Conventions

All agents in this directory follow these patterns:

### Structure
- **Role Definition**: What the agent is and does
- **Project Context**: Background about this specific project
- **Guidelines/Checklist**: Specific criteria and best practices
- **Examples**: Code samples showing good vs. bad patterns
- **When to Use**: Scenarios where the agent is helpful

### Using Multiple Agents
You can combine agents for complex tasks:

1. **Documentation Agent** → Create initial docs
2. **Code Review Agent** → Review code examples in docs
3. **Testing Agent** → Add tests mentioned in docs

## Creating New Agents

If you need a specialized agent:

1. Create a new `.md` file in this directory
2. Follow the structure of existing agents
3. Include project-specific context
4. Add concrete examples
5. Define clear use cases
6. Update this README

### Example Agent Template
```markdown
# [Agent Name] for Buoy Data Project

You are a [role description].

## Your Role
[What this agent does]

## Project Context
[Relevant project information]

## Guidelines
[Specific criteria and best practices]

## Examples
[Code samples and patterns]

## When to Use
[Scenarios where this agent helps]
```

## Tips for Effective Agent Use

### Be Specific
❌ "Review my code"
✅ "Review `apps/server/src/routes/observations.ts` for error handling and input validation"

### Provide Context
Include:
- Relevant file paths
- Related code snippets
- Error messages
- Requirements or constraints
- Expected behavior

### Iterate
- Start with a broad review
- Address critical issues first
- Refine with follow-up questions
- Validate suggestions before implementing

### Validate Results
- Test generated code
- Review suggestions critically
- Ensure consistency with project
- Verify against existing patterns

## Integration with Development Tools

### VS Code
- Install GitHub Copilot extensions
- Use Copilot Chat to interact with agents
- Reference agent files in chat context
- Use inline suggestions while coding

### Code Reviews
- Reference agent checklists in PR reviews
- Use agent criteria for self-review
- Share agent feedback with team
- Document deviations from guidelines

### CI/CD (Future)
- Automated code review checks
- Test coverage requirements
- Documentation validation
- API schema validation

## Maintenance

Keep agents up to date:
- Update when coding standards change
- Add new patterns as project evolves
- Include lessons learned
- Remove outdated guidance
- Add examples from real code

## Questions or Improvements

If you have ideas for new agents or improvements to existing ones:
1. Create an issue describing the need
2. Propose the agent structure
3. Provide example use cases
4. Submit a PR with the new agent

---

**Note**: These agents are AI assistants configured with project-specific knowledge. Always review and validate their suggestions before implementing changes.
