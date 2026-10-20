import { ButtonLink, PageTitle } from "@/shared/ui/components";
export default function Denied() {
  return (
    <>
      <PageTitle
        eyebrow="ACCESS"
        title="This workspace is for authorized staff"
      >
        Your account does not have staff access.
      </PageTitle>
      <ButtonLink href="/patient">Return to your account</ButtonLink>
    </>
  );
}
