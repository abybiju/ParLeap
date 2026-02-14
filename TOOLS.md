# TOOLS.md - Local Notes

Skills define *how* tools work. This file is for *your* specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:
- Camera names and locations
- SSH hosts and aliases  
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras
- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH
- home-server → 192.168.1.100, user: admin

### TTS
- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## Workspace-Specific Notes

### Git / SSH
- Repo path: `/Users/abybiju/ParLeap-AI`
- **Full setup:** see [SSH_SETUP.md](SSH_SETUP.md) (generate key, add to GitHub, config, remote).
- After setup, remote should be: `origin = git@github.com-parleap:abybiju/ParLeap.git` so normal `git push` uses the right key.
- Key used for this repo:
  - Private: `~/.ssh/id_parleap`
  - Public: `~/.ssh/id_parleap.pub`
  - Fingerprint: `SHA256:...` (ED25519) — verify with `ssh-keygen -l -f ~/.ssh/id_parleap.pub`
- Config snippet: `scripts/ssh-config-snippet.txt` (append to `~/.ssh/config`).