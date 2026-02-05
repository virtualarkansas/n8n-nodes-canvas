# Release Command

Create and push a new release for the n8n-nodes-canvas package.

## Usage

```
/project:release [version]
```

**Arguments:**
- `version` - The version to release (e.g., `0.1.0-beta.2`, `0.2.0`, `1.0.0`)

## Process

1. **Update package.json** version to the specified version
2. **Commit** the version bump with message: `chore: bump version to {version}`
3. **Push** the commit to origin/main
4. **Create tag** `v{version}`
5. **Push tag** to trigger GitHub Actions release workflow

## Version Format

- **Beta releases:** `X.Y.Z-beta.N` (e.g., `0.1.0-beta.2`)
- **Alpha releases:** `X.Y.Z-alpha.N` (e.g., `0.1.0-alpha.1`)
- **Stable releases:** `X.Y.Z` (e.g., `1.0.0`)

Beta and alpha releases are automatically marked as prereleases on GitHub.

## Example

```
/project:release 0.1.0-beta.2
```

This will:
1. Update package.json to version `0.1.0-beta.2`
2. Commit: `chore: bump version to 0.1.0-beta.2`
3. Push commit to main
4. Create and push tag `v0.1.0-beta.2`
5. GitHub Actions will build and create the release with the .tgz artifact

## Post-Release

After the workflow completes, verify the release at:
https://github.com/kyancey/n8n-nodes-canvas/releases
