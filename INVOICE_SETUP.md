# Prestige Luxor Invoice Setup

The CRM invoice workspace is available at `/admin` after deployment.

## 1. Apply the database migration

Run `supabase/invoices.sql` once in the Supabase SQL Editor. The migration:

- creates invoice numbers in the `PL-YYYY-####` format;
- creates owner, manager, and staff roles;
- assigns the oldest existing Supabase user as the initial owner;
- creates invoice, payment, event, and deposit-hold fields; and
- locks finalized invoices against further editing.

## 2. Configure Vercel

Keep the existing Supabase server variables and add:

- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_RESTRICTED_KEY` with only the permissions needed to read/cancel PaymentIntents

Use `STRIPE_SECRET_KEY` only as a temporary fallback if a restricted key is unavailable. Never expose either value in browser code.

## 3. Configure Stripe webhook events

Point Stripe to:

`https://www.prestigeluxor.com/api/stripe-webhook`

Subscribe to:

- `payment_intent.succeeded`
- `payment_intent.amount_capturable_updated`
- `payment_intent.canceled`
- `charge.refunded`

For automatic CRM matching, include either `invoice_id` or `invoice_number` in the Stripe object's metadata. Verified webhook signatures are required.

## 4. Employee roles

The initial owner can assign another authenticated user with:

```sql
insert into public.admin_profiles (user_id, display_name, role)
values ('SUPABASE_AUTH_USER_ID', 'Employee name', 'staff')
on conflict (user_id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    updated_at = now();
```

Allowed roles are `owner`, `manager`, and `staff`.

## Invoice workflow

1. Create from a quote, booking, or manual entry.
2. Save and revise the draft.
3. Finalize and permanently lock it.
4. Download the Prestige Luxor PDF.
5. Send it to the customer manually.
6. Record a Stripe payment or let a linked Stripe webhook update the status.
7. Release an authorization hold manually after vehicle inspection.
