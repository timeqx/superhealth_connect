import { requireActor } from "@/server/session";
import { Card, Badge, PageTitle } from "@/shared/ui/components";
import { Pagination, pageNumber } from "@/shared/ui/pagination";
import { CreateStaffAccountForm, StaffAccountRoleForm } from "@/features/accounts/presentation/staff-management";
import type { StaffAccount } from "@/features/accounts/domain/staff-management";

export default async function Staff({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { client, user } = await requireActor(true);
  const page = pageNumber((await searchParams).page);
  const { data, error } = await client.rpc("list_staff_accounts", { p_offset: (page - 1) * 20, p_limit: 20 });
  if (error || !data) throw new Error("Staff accounts could not be loaded. Please try again.");
  const { accounts, count } = data as { accounts: StaffAccount[]; count: number };

  return <>
    <PageTitle eyebrow="STAFF WORKSPACE" title="Staff">Create staff and admin accounts and manage their portal access.</PageTitle>
    <div className="staff-split">
      <Card>
        <h2>Create an account</h2>
        <p>New accounts can sign in at the staff portal immediately. Email confirmation is not required.</p>
        <CreateStaffAccountForm />
      </Card>
      <section className="stack" aria-labelledby="staff-accounts-heading">
        <h2 id="staff-accounts-heading">Staff and admins</h2>
        <p className="caption">Staff can access Requests, Queue, Inquiries, and Reports. Admins can access every tab and manage staff accounts.</p>
        {accounts.map(account => {
          const name = `${account.first_name} ${account.last_name}`.trim();
          return <Card key={`${account.id}:${account.provisioned_at}`}>
            <div className="row">
              <div className="record-summary">
                <h3>{name || account.email || "Staff account"}{account.id === user.id ? " (you)" : ""}</h3>
                {name && account.email && <p>{account.email}</p>}
                {account.employee_id && <p className="caption">Employee ID: {account.employee_id}</p>}
              </div>
              <Badge>{account.role === "admin" ? "Admin" : "Staff"}</Badge>
            </div>
            {account.disabled_at ? <p className="notice">This account is disabled. Portal access is unavailable.</p> : <StaffAccountRoleForm account={account} currentUserId={user.id} />}
          </Card>;
        })}
        {!accounts.length && <Card><p>No staff accounts on this page.</p></Card>}
        <Pagination page={page} count={count} />
      </section>
    </div>
  </>;
}
