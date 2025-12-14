export interface Governor {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  party: "D" | "R" | "I";
  state: string;
  imageUrl: string | null;
  email: string | null;
  websiteUrl: string | null;
  twitterHandle: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  termStart: string | null;
  termEnd: string | null;
  isCurrent: boolean;
  capitolPhone: string | null;
  capitolAddress: string | null;
}

export function mapGovernor(raw: Record<string, unknown>): Governor {
  return {
    id: raw.id as string,
    name: raw.name as string,
    firstName: raw.first_name as string | null,
    lastName: raw.last_name as string | null,
    party: (raw.party as "D" | "R" | "I") || "I",
    state: raw.state as string,
    imageUrl: raw.image_url as string | null,
    email: raw.email as string | null,
    websiteUrl: raw.website_url as string | null,
    twitterHandle: raw.twitter_handle as string | null,
    facebookUrl: raw.facebook_url as string | null,
    instagramUrl: raw.instagram_url as string | null,
    termStart: raw.term_start as string | null,
    termEnd: raw.term_end as string | null,
    isCurrent: (raw.is_current as boolean) ?? true,
    capitolPhone: raw.capitol_phone as string | null,
    capitolAddress: raw.capitol_address as string | null,
  };
}
