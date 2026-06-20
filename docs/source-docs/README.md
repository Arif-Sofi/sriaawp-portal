# Source documents (synced from OneDrive)

Markdown mirrors of the project's Word source documents, kept here so Claude (and
anyone reading the repo) has the current text without opening OneDrive.

## How the sync works

The documents are shared from a UTM OneDrive with anonymous "anyone with the link"
view access. `scripts/sync-source-docs.py` downloads each one headlessly (the first
request to the share link sets an anonymous `FedAuth` cookie, then the same link
with `?download=1` returns the `.docx`) and converts it to markdown. No login or
manual download is needed.

## Documents

| Markdown file | Source |
| --- | --- |
| [`thesis.md`](./thesis.md) | Thesis - AI Integrated School Management and Communication Portal using RAG for SRIAAWP |
| [`srs.md`](./srs.md) | Software Requirements Specification (SRS), SECJ 3032 FYP1 |

Share links and the slug-to-URL mapping live in the `SOURCES` list at the top of
`scripts/sync-source-docs.py`.

## Refreshing

```bash
python scripts/sync-source-docs.py
```

Then commit the regenerated `*.md`. The generated files are point-in-time snapshots;
re-run before relying on them if the source may have changed. If the script reports a
failure, the share link was likely changed or its access revoked - update the URL in
`scripts/sync-source-docs.py`.
