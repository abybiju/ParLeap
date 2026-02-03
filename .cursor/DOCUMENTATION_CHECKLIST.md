# Documentation Update Checklist

**Purpose**: Ensure all project documentation stays synchronized whenever changes are made.

---

## 📋 Files to Update (Always Update All Three)

When making any significant changes to the project, update these three files:

1. **[PROJECT_STATUS_COMPLETE.md](../PROJECT_STATUS_COMPLETE.md)** - Master status file
2. **[PROJECT_PLAN.md](../PROJECT_PLAN.md)** - Roadmap and phase tracking
3. **[README.md](../README.md)** - Quick reference

---

## ✅ Update Checklist

### When Adding New Features

- [ ] Update `PROJECT_STATUS_COMPLETE.md`:
  - [ ] Add feature to "Completed Features" section
  - [ ] Update "Recent Updates" section with date
  - [ ] Update architecture diagram if needed
  - [ ] Add any new environment variables
  - [ ] Update verified tests list

- [ ] Update `PROJECT_PLAN.md`:
  - [ ] Add entry to "Recent Updates" section
  - [ ] Mark phase/feature as complete (change `[ ]` to `[x]`)
  - [ ] Update "Last Updated" date at bottom

- [ ] Update `README.md`:
  - [ ] Update "Current Status" section
  - [ ] Update "What's Working Now" list
  - [ ] Update "Project Status" section
  - [ ] Update deployment URLs if changed

### When Fixing Bugs or Making Improvements

- [ ] Update `PROJECT_STATUS_COMPLETE.md`:
  - [ ] Add to "Recent Updates" section
  - [ ] Update "Known Issues" if bug was fixed
  - [ ] Update verified tests if applicable

- [ ] Update `PROJECT_PLAN.md`:
  - [ ] Add to "Recent Updates" section
  - [ ] Update "Last Updated" date

- [ ] Update `README.md`:
  - [ ] Update "Current Status" if significant
  - [ ] Update "What's Working Now" if applicable

### When Deploying or Changing Infrastructure

- [ ] Update `PROJECT_STATUS_COMPLETE.md`:
  - [ ] Update "Live Deployment URLs"
  - [ ] Update "Deployment Status" section
  - [ ] Update environment variables if changed

- [ ] Update `PROJECT_PLAN.md`:
  - [ ] Update deployment section (6.2)
  - [ ] Add to "Recent Updates"

- [ ] Update `README.md`:
  - [ ] Update "Quick Deploy" section
  - [ ] Update "Current Status" URLs

---

## 📝 What to Document

### For New Features
- **What**: Brief description of the feature
- **When**: Date completed
- **Where**: File paths changed
- **Why**: Brief rationale if significant
- **Status**: ✅ Complete or ⏭️ Pending

### For Bug Fixes
- **What**: Issue description
- **Fix**: Solution applied
- **Files**: Files modified
- **Date**: When fixed

### For Infrastructure Changes
- **What**: Service/platform changed
- **URLs**: New URLs or endpoints
- **Config**: Environment variables added/changed
- **Status**: Deployment status

---

## 🎯 Quick Reference

### Master Status File
**File**: `PROJECT_STATUS_COMPLETE.md`
- Complete feature list
- Deployment status
- Architecture overview
- Environment variables
- Recent updates

### Roadmap File
**File**: `PROJECT_PLAN.md`
- Phase tracking
- Implementation details
- Recent updates timeline
- Next steps

### Quick Reference
**File**: `README.md`
- Current status summary
- Quick links
- Getting started
- Project status overview

---

## ⚠️ Important Notes

1. **Always update all three files** - They should stay synchronized
2. **Use consistent formatting** - Follow existing patterns
3. **Include dates** - Always date your updates
4. **Link between files** - Cross-reference when helpful
5. **Keep it concise** - Don't duplicate information unnecessarily

---

## 📅 Last Documentation Sync

**Date**: February 3, 2026
**Status**: All documentation files synchronized ✅
**Updates**: 
- Added Profile Settings + Avatar System documentation
- Updated PROJECT_STATUS_COMPLETE.md, PROJECT_PLAN.md, README.md
- Captured Supabase migration + schema cache reload guidance (see `AVATAR_MIGRATION_SETUP.md`)

---

**Remember**: When in doubt, update all three files. It's better to have slightly redundant information than outdated documentation!
