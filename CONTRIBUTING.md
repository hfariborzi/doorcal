# Contributing to DoorCal

Thanks for your interest. DoorCal is MIT-licensed and you're welcome to fork it, self-host it and
send improvements back.

## How changes get in

- `main` is protected. Nobody pushes to it directly; every change arrives as a **pull request** and
  is reviewed and merged by the maintainer (@hfariborzi).
- For anything bigger than a small fix, **open an issue first** describing what you want to change
  and why, so we agree on the approach before you spend time on it.
- Pull requests must pass CI: `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.
- Keep pull requests focused: one change per PR, with a short description of what and why.
- Match the existing style of the code around your change. Comments explain *why*, not *what*.

## Running locally

See the **Local development** section of the README. You'll need a Google OAuth client of your own
(and optionally a Microsoft one) and a Postgres database (`docker compose up -d` provides one).

## Security

If you find a security problem, please don't open a public issue. Email the address on the
deployed site's contact link instead, and give us a few days to fix it before disclosing.
