import { ButtonLink } from "@/shared/ui/components";
export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>This page may have moved.</p>
      <ButtonLink href="/">Back to home</ButtonLink>
    </>
  );
}
