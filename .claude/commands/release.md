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
2. **Update package.json** version to the specified version
3. **Commit** the version bump
4. **Push** the commit to origin/main
5. **Create and push tag** `v{version}` to trigger the release workflow

GitHub Actions will then:
- Build the package
- Generate a changelog from commits since the last tag
- Create a GitHub Release with the .tgz artifact and changelog

## Version Format

- **Beta releases:** `X.Y.Z-beta.N` (e.g., `0.1.0-beta.2`) - marked as prerelease
- **Alpha releases:** `X.Y.Z-alpha.N` (e.g., `0.1.0-alpha.1`) - marked as prerelease
- **Stable releases:** `X.Y.Z` (e.g., `1.0.0`) - full release

## Example

```
/project:release 0.1.0-beta.2
```

## Release Notes

The GitHub Actions workflow automatically generates release notes from commit messages between tags. To have good release notes:

- Use descriptive commit messages
- The changelog will include all commits since the previous tag
- Commits with "Co-Authored-By" lines are filtered from the changelog

## Post-Release

After the workflow completes (~1-2 min), verify the release at:
https://github.com/kyancey/n8n-nodes-canvas/releases

## Manual Release (if needed)

If you need to release manually:
```bash
# 1. Update version in package.json
# 2. Commit the change
git add package.json
git commit -m "chore: release v0.1.0-beta.2"

# 3. Create and push tag
git tag v0.1.0-beta.2
git push origin main
git push origin v0.1.0-beta.2
```
