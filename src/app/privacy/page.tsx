import { Card, PageTitle } from "@/shared/ui/components";
export default function Privacy() {
  return (
    <>
      <PageTitle eyebrow="YOUR INFORMATION" title="Privacy notice" />
      <Card>
        <h2>Information used for your visits</h2>
        <p>
          Account and contact details support account verification, appointment
          requests, queue updates, and replies to your inquiries. Your QC ID is
          submitted privately for staff to review your account.
        </p>
        <h2>Keep sensitive details private</h2>
        <p>
          Share only the information needed for your request. Do not include
          passwords or unrelated medical documents in inquiries. Sign out when
          using a shared device.
        </p>
        <h2>Questions about your information</h2>
        <p>
          Contact the center about access to your information, corrections,
          retention, or deletion requests.
        </p>
        <p>
          This website is an appointment tool, not an emergency intake channel.
        </p>
      </Card>
    </>
  );
}
