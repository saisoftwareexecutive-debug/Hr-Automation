# Contributing to HireFlow

Thank you for contributing to HireFlow. To maintain the highest standards of code quality, data security, and fair-hiring compliance, all contributors must adhere to the guidelines below.

---

## 🔒 Security & Data Privacy Non-Negotiables

1. **NEVER Commit Real Data**:
   - Never commit candidate phone numbers, full names, addresses, or application data.
   - Never commit `.env` or `.env.local` files containing live database keys or session secrets.
   - Any commit attempting to add data stores (`data/*.json`), backups, or credentials will be rejected by `npm run guard`.

2. **Fair-Hiring Guarantee**:
   - The application strictly forbids filtering, scoring, sorting, or prioritizing candidates based on religion, caste, community, gender, age, marital status, or name inferences.
   - Code contributions altering the scoring model must maintain 100% compliance with objective job criteria only.

---

## 🛠️ Development Workflow

1. **Install Node.js 20+**:
   Ensure you are using Node.js version 20 LTS or higher.
   ```bash
   npm ci
   ```

2. **Create a Local Feature Branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Run Pre-Commit Verification**:
   Before submitting changes or opening a Pull Request, you must run:
   ```bash
   npm run verify
   ```
   This executes:
   - `npm run guard` (Security & sensitive data scan)
   - `npm test` (Full unit & workflow test suite via Vitest)
   - `npm run build` (Next.js production build & type check)

4. **Commit Conventions**:
   Use standard conventional commits:
   - `feat: add new feature`
   - `fix: resolve issue`
   - `docs: update documentation`
   - `test: add unit or integration tests`
   - `chore: maintenance task`
