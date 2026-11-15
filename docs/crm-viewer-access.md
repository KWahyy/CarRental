# Business partner: read-only dashboard

Recipient requested by owner: csadoughi@gmail.com. Access is not activated yet.

Viewer can browse all CRM sections and view owner-level financial reporting,
including Prestige-owned rental income, costs, cash remaining, utilization,
monthly trends and financial transactions. No creation, editing, deletion,
sending quotes, recording payments, uploading files or modifying roles.

Implementation:
- API routes explicitly opt into viewer GET/HEAD; all viewer mutations rejected.
- Quotes do not run their expiration update when accessed by a viewer.
- SQL migration adds SELECT access and restrictive write-denial policies on all
  26 CRM tables and storage. Existing permissive authenticated policies cannot
  override those restrictions. No user is created or assigned by this migration.
- UI uses an allowlist for navigation, filters, reading and PDF downloads; other
  controls are disabled/hidden, including dynamically rendered controls.
- Existing owner functionality is retained.

Validation:
- `node --test tests/*.test.mjs`
- `PGLITE_MODULE=/path/to/pglite/dist/index.js node tests/crm-viewer-rls.mjs`
  runs isolated PostgreSQL checks, with permissive legacy policies deliberately
  present: viewer read, write denial, self-escalation denial, storage denial,
  owner writes and migration idempotence.
- `node scripts/build-static.mjs`

Release order:
1. Confirm action-time authorization for read-only financial/customer access.
2. Apply supabase/dashboard-viewer.sql; inspect production table/policy coverage.
3. Deploy reviewed application changes and verify deployment succeeds.
4. Invite exact email above through Supabase Auth; assign admin_profiles role
   viewer only to that returned auth.users ID. Do not use owner/manager/staff.
5. Partner sets their own password using the invitation. Check their successful
   sign-in and access; never ask for or set their password.

Deployment prerequisite fixed in this change: the product feed had introduced
serverless function 13, exceeding the existing 12-function check. Its handler is
now served by public-page with a rewrite preserving /api/chatgpt-feed.

Unrelated pending FAQ/style changes are excluded from this release.
