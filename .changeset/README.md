# Changesets

Every user-visible change gets a changeset: `npm run changeset`. Pick the bump and write one line for the changelog.

All `@caju-motion/*` packages are released **in lockstep** (same version, the `fixed` group in `config.json`).

Releasing is manual: GitHub → Actions → **release** → Run workflow.
- With pending changesets, it opens a "Version Packages" PR.
- Run it again after merging that PR to publish to npm with provenance. This needs the `NPM_TOKEN` secret.
