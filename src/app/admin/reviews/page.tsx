import { requireActor } from "@/server/session";
import { Card, PageTitle } from "@/shared/ui/components";
import { Button } from "@/shared/ui/button";
import { ReviewPanel } from "@/features/accounts/presentation/review-panel";
import { AdminRequestPanel } from "@/shared/ui/admin-request-panel";
export default async function Reviews() {
  const { client } = await requireActor(true);
  const { data, error } = await client
    .from("profiles")
    .select(
      "id,first_name,middle_name,last_name,barangay_code,other_barangay,current_document_id,submitted_at,review_version",
    )
    .eq("review_status", "pending")
    .order("submitted_at")
    .limit(50);
  if (error) throw error;
  return (
    <>
      <PageTitle eyebrow="STAFF WORKSPACE" title="Account reviews">
        Review the submitted version before making a decision. Oldest
        submissions appear first.
      </PageTitle>
      <div className="review-list">
        {data.map((p) => (
          <Card key={p.id}>
            <div className="review-identity">
              <h2>
                {p.first_name} {p.middle_name} {p.last_name}
              </h2>
              <p>
                {p.barangay_code === "Others"
                  ? p.other_barangay
                  : p.barangay_code}
              </p>
            </div>
            <p className="caption">Submission version {p.review_version}</p>
            {p.current_document_id ? (
              <AdminRequestPanel
                title={`${p.first_name} ${p.last_name}`}
                description={`Private verification · Submission version ${p.review_version}`}
              >
                <Button asChild variant="outline">
                  <a href={`/admin/reviews/document/${p.current_document_id}`}>
                    Open private document
                  </a>
                </Button>
                <ReviewPanel user={p.id} document={p.current_document_id} />
              </AdminRequestPanel>
            ) : (
              <p className="notice">
                No reviewable document. This account cannot be approved here.
              </p>
            )}
          </Card>
        ))}
      </div>
      {!data.length && (
        <Card>
          <h2>No accounts awaiting review</h2>
          <p>New verification submissions will appear here.</p>
        </Card>
      )}
    </>
  );
}
