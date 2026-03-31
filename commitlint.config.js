// commitlint.config.js
// Location: root of project

// Commitlint enforces Conventional Commits format:
// <type>(<scope>): <description>
//
// Examples of VALID commit messages:
//   feat(auth): add Google OAuth provider
//   fix(listings): correct slug generation for Arabic names
//   chore(deps): upgrade Prisma to 6.5.0
//   docs(readme): add setup instructions
//   refactor(middleware): simplify RBAC logic
//   test(auth): add unit tests for password hashing
//
// Examples of INVALID commit messages (will be BLOCKED):
//   "fix stuff"
//   "WIP"
//   "asdf"
//
// WHY Conventional Commits?
// 1. Makes Git history readable by humans AND tools
// 2. Enables automatic changelog generation
// 3. Forces you to think "what TYPE of change is this?"
//    A feat is new functionality. A fix corrects broken behavior.
//    A refactor changes code without changing behavior. Knowing the difference
//    is a core software engineering skill.

module.exports = {
  extends: ["@commitlint/config-conventional"],
};
