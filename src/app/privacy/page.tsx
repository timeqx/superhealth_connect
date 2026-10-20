import { Card, PageTitle } from "@/shared/ui/components";
export default function Privacy() {
  return (
    <>
      <PageTitle
        eyebrow="DEVELOPMENT NOTICE"
        title="Use synthetic information only"
      />
      <Card>
        <p>
          This capstone is under development. Do not enter real patient
          information or upload a real QC ID. Account details and verification
          documents are intended only for account review and appointment
          operations.
        </p>
        <p>
          Before a live pilot, the center must approve the privacy notice,
          identity alternatives, retention and deletion periods, and staff
          access responsibilities. This development notice is not a finalized
          patient consent policy.
        </p>
        <p>
          This website is an appointment tool, not an emergency intake channel.
        </p>
      </Card>
    </>
  );
}
