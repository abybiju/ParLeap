# Rollback: Live Matching Latency Optimization

**Checkpoint commit (before any latency changes):** `db7f7872c46b63b1e203bf25803096b44ca51809`

To undo all latency optimization work and return to this state:

```bash
git reset --hard db7f7872c46b63b1e203bf25803096b44ca51809
```

To revert only the last phase (keeps history):

```bash
git revert HEAD --no-edit
```

Each phase is committed separately so you can revert individual commits:

- Phase 1: Instrumentation
- Phase 2a: Projector setTimeout removal
- Phase 2b: Audio buffer 1024
- Phase 3a: Fast/background path split
- Phase 3b: Pre-normalize lyrics
- Phase 3c: Memoize similarity
- Phase 3d: Skip base64 re-encode
- Phase 3e: Cap rolling buffer
- Phase 4a: CSS transitions
