# BDD Web Dashboard

Next.js 15 (App Router) + TypeScript + Tailwind v4 + framer-motion.

```bash
npm install
npm run dev        # http://localhost:3000, proxies /api/backend -> localhost:8000
BACKEND_ORIGIN=http://elsewhere:8000 npm run build && BACKEND_ORIGIN=... npm start
```

Pages:

- `/` forensic dashboard (stats, severity mix, latest findings, seed button)
- `/datasets` drag-drop ingest with live job-step progress + artifact list
- `/datasets/[id]` manifest, fitness score, column profiler, quality flags, lineage graph
- `/findings` filterable queue · `/findings/[id]` case view + reviewer decision
- `/compare` comparability gates → reconciliation → drift
- `/ask` Ask Detective chat with citation chips and refusal handling

Design contract: dark forensic theme; severity is never conveyed by colour
alone (always a text label); reduced-motion respected via CSS.
