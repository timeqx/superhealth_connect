import { requireActor } from "@/server/session";
import { ProfileForm } from "@/features/accounts/presentation/profile-form";
import { Badge, Card, PageTitle } from "@/shared/ui/components";
import { VerificationUpload } from "@/features/accounts/presentation/verification-upload";
export default async function ProfilePage() {
  const { profile, role } = await requireActor();
  if (role === "admin")
    return (
      <Card>
        <h1>Staff account</h1>
        <p>
          Your staff access is managed by the project operator. Patient
          verification is not required for this role.
        </p>
      </Card>
    );
  return (
    <div className="narrow stack">
      <PageTitle eyebrow="YOUR ACCOUNT" title="Profile and verification" />
      <ol
        className="verification-progress"
        aria-label="Account verification progress"
      >
        <li
          aria-current={
            profile.review_status === "incomplete" ||
            profile.review_status === "rejected"
              ? "step"
              : undefined
          }
        >
          1. Profile & document
        </li>
        <li
          aria-current={
            profile.review_status === "pending" ? "step" : undefined
          }
        >
          2. Staff review
        </li>
        <li
          aria-current={
            profile.review_status === "approved" ? "step" : undefined
          }
        >
          3. Ready to book
        </li>
      </ol>
      <Badge>{profile.review_status.toUpperCase()}</Badge>
      {profile.review_status === "rejected" && (
        <p className="notice">
          Please correct your submission: {profile.rejection_reason}
        </p>
      )}
      {["incomplete", "rejected"].includes(profile.review_status) ? (
        <>
          <ProfileForm profile={profile} />
          <Card>
            <VerificationUpload
              configured={Boolean(process.env.SUPABASE_SECRET_KEY)}
            />
          </Card>
        </>
      ) : (
        <Card>
          <h2>
            {profile.first_name} {profile.last_name}
          </h2>
          <p>
            {profile.review_status === "pending"
              ? "Your submission is awaiting staff review."
              : "Your account has been approved."}
          </p>
        </Card>
      )}
    </div>
  );
}
