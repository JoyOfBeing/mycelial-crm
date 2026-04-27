@AGENTS.md

## MycelialCRM

Relationship manager for Jumpsuit. NOT a sales CRM — no deals, no pipeline.

### Stack
- Next.js 16 + React 19, vanilla CSS (no Tailwind)
- Supabase (shared instance knpcrdgvziltgzhwdoey), all tables prefixed `crm_`
- Font: Cooper Black BT (public/fonts/CooperBlackBT.ttf)

### Brand Colors
- Dark: #2c3c40
- Gold: #deab39
- Orange: #fa6729
- Rust: #d24b4a
- Blue: #0c46d1
- Teal: #48a29d
- Light Blue: #447cf1
- Purple: #c47ef1

### Auth
Email allowlist in components/AuthProvider.js. Magic link login via Supabase.
