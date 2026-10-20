export type Service = {
  id: string;
  slug: string;
  name: string;
  description: string;
  requirements: string;
  is_bookable: boolean;
  is_published: boolean;
  arrival_minutes: number;
};
// Display-only fallback. Never passed to booking RPCs or represented as live availability.
export const sampleCatalog = [
  [
    "maternal-child-care",
    "Maternal & Child Care",
    "Support for mothers and growing families.",
  ],
  [
    "family-planning",
    "Family Planning",
    "Plan a visit to discuss family planning services.",
  ],
  [
    "animal-bite-treatment",
    "Animal Bite Treatment",
    "Ask about available treatment services.",
  ],
  [
    "mental-health-support",
    "Mental Health Support",
    "Connect with available mental health support.",
  ],
  [
    "immunizations",
    "Immunizations",
    "Plan your visit for available vaccinations.",
  ],
  ["tb-dots", "TB DOTS", "Ask about the center’s TB DOTS services."],
  [
    "screening-services",
    "Screening Services",
    "Learn about available health screening services.",
  ],
].map(([slug, name, description]) => ({
  id: slug,
  slug,
  name,
  description,
  requirements: "Requirements awaiting center confirmation.",
  is_bookable: false,
  is_published: false,
  arrival_minutes: 30,
}));
