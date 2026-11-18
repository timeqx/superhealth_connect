import { ButtonLink, PageTitle } from "@/shared/ui/components";
export default function Denied() {
  return (
    <>
      <PageTitle
        eyebrow="ACCESS"
        title="You do not have access to this page"
      >
        This page is not available for your account role.
      </PageTitle>
      <ButtonLink href="/patient">Return to your account</ButtonLink>
    </>
  );
}
