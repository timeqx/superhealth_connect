export type Service = {
  id: string;
  slug: string;
  name: string;
  description: string;
  requirements: string;
  is_bookable: boolean;
  is_published: boolean;
  arrival_minutes: number;
  opening_time: string;
  closing_time: string;
  weekdays: number[];
};
