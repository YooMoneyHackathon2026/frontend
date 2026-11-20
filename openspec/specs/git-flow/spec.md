# Git Flow

## Purpose
Publish each completed task step through a retained branch with an annotated tag and a cumulative pull request.

## Requirements

### Requirement: Task publication
Each changed prompt MUST produce a validated English commit, a matching package version and annotated tag, and an updated PR.

#### Scenario: First task step
- **WHEN** the first task change is ready
- **THEN** the agent publishes a stable bump and opens a PR into develop (hotfix into main)

#### Scenario: Follow-up
- **WHEN** work continues on the same open task
- **THEN** the next rc tag updates the cumulative PR notes and the branch survives merge

#### Scenario: Release
- **WHEN** a minor or major tag is published
- **THEN** GitHub Release notes list changes since the previous Release
