# Task

Use Bun Loop Patch Mode to correct `parseList` without changing its public export.
The parser must retain ordinary comma-separated behavior, accept `\,` as a literal
comma, interpret `\\` as a literal backslash, and reject a dangling escape. Modify
only `src/parse-list.js`. The executable oracle is `npm test`.
