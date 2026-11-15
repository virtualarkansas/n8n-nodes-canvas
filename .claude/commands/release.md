# Release Command

Create and push a new release for the n8n-nodes-canvas package.

## Usage

```
/project:release [version]
```

**Arguments:**
- `version` - The version to release (e.g., `0.1.0-beta.2`, `0.2.0`, `1.0.0`)

## Process

When you run this command, I will:

1. **Show recent commits** since the last release so you can review what's changed
2. **Check `CHANGELOG.md`**: it needs a section headed `## {version}` (the release notes are taken
   from it); replace "(unreleased)" with today's date, and run
   `npx tsx test/tools/description-diff.ts <previous version>` to make sure every change that
   affects saved workflows is listed
3. **Update the version** in `package.json` and `package-lock.json` (`npm version {version} --no-git-tag-version`)
4. **Run the checks** the release workflow runs: `npm run lint`, `npm run build`, `npm run typecheck`, `npm test`
5. **Commit** the version bump
6. **Push** the commit to origin/main
7. **Create and push tag** `v{version}` to trigger the release workflow

GitHub Actions will then:
- Refuse to continue if the tag does not match the version in `package.json`
- Lint, build, type-check and run the unit tests
- Publish the package to npm (with provenance; dist-tag `latest`, or `alpha` / `beta` / `next` for pre-releases).
  It uses npm trusted publishing, not a token: the package's settings on npmjs.com name this
  repository and `release.yml` as trusted publisher, with `npm publish` allowed
- Create a GitHub Release with the .tgz artifact and the section of `CHANGELOG.md` for this version

## Version Format

- **Beta releases:** `X.Y.Z-beta.N` (e.g., `0.1.0-beta.2`) - marked as prerelease
- **Alpha releases:** `X.Y.Z-alpha.N` (e.g., `0.1.0-alpha.1`) - marked as prerelease
- **Stable releases:** `X.Y.Z` (e.g., `1.0.0`) - full release

## Example

```
/project:release 0.1.0-beta.2
```

## Release Notes

The release notes are the section of `CHANGELOG.md` headed `## {version}`. If there is none, the
release only links to the changelog.

## Post-Release

After the workflow completes (~1-2 min), verify the release at:
https://github.com/virtualarkansas/n8n-nodes-canvas/releases

## Manual Release (if needed)

If you need to release manually:
```bash
# 1. Update version in package.json and package-lock.json, and the heading in CHANGELOG.md
# 2. Commit the change
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v0.1.0-beta.2"

# 3. Create and push tag
git tag v0.1.0-beta.2
git push origin main
git push origin v0.1.0-beta.2
```
