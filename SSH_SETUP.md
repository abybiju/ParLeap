# SSH setup for ParLeap (GitHub)

Use this so `git push` and `git pull` work with your ParLeap SSH key without typing `GIT_SSH_COMMAND` every time.

## 1. Generate a key (if you don’t have one)

If you don’t already have `~/.ssh/id_parleap`:

```bash
ssh-keygen -t ed25519 -C "parleap-github" -f ~/.ssh/id_parleap
```

Use a passphrase or leave empty. You’ll get:
- Private key: `~/.ssh/id_parleap`
- Public key: `~/.ssh/id_parleap.pub`

## 2. Add the key to GitHub

1. Copy your public key:
   ```bash
   cat ~/.ssh/id_parleap.pub
   ```
2. GitHub → **Settings** → **SSH and GPG keys** → **New SSH key**.
3. Paste the key, give it a name (e.g. “ParLeap Mac”), save.

## 3. SSH config (use ParLeap key only for this repo)

Append this to `~/.ssh/config` (create the file if it doesn’t exist):

```
# ParLeap repo – use dedicated key
Host github.com-parleap
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_parleap
  IdentitiesOnly yes
```

Then set correct permissions:

```bash
chmod 600 ~/.ssh/config
```

## 4. Point the repo at this host

From the project root:

```bash
git remote set-url origin git@github.com-parleap:abybiju/ParLeap.git
```

Check:

```bash
git remote -v
# origin  git@github.com-parleap:abybiju/ParLeap.git (fetch)
# origin  git@github.com-parleap:abybiju/ParLeap.git (push)
```

## 5. Test

```bash
ssh -T github.com-parleap
# Hi abybiju/ParLeap! You've successfully authenticated...
```

Then:

```bash
git fetch
git push
```

After this you can use normal `git push` / `git pull`; the config picks the right key.

## Reference

- Key: `~/.ssh/id_parleap` (private), `~/.ssh/id_parleap.pub` (public)
- Remote: `origin` → `git@github.com-parleap:abybiju/ParLeap.git`
- More local notes: [TOOLS.md](./TOOLS.md)
