/* PTL-024 Phase 10B — Distribution serializers index.
   Pure modules. Each serializer returns a {format, mediaType, body, issues}
   triple. The body is a string (JSON/XML). Validation issues surface
   blockers per platform; the serializer never throws on missing fields. */
export * from "./kdp";
export * from "./apple-books";
export * from "./kobo";
export * from "./draft2digital";
export * from "./google-play";
export * from "./onix";

import type { PublicationMetadata, AdapterIssue, DistributionTarget } from "../metadata";
import { kdpSerializer } from "./kdp";
import { appleBooksSerializer } from "./apple-books";
import { koboSerializer } from "./kobo";
import { d2dSerializer } from "./draft2digital";
import { googlePlaySerializer } from "./google-play";

export interface SerializedPayload {
  target: DistributionTarget;
  format: "json" | "xml";
  mediaType: string;
  filename: string;
  body: string;
  issues: AdapterIssue[];
}

export type Serializer = (meta: PublicationMetadata, slug: string) => SerializedPayload;

export const SERIALIZERS: Record<DistributionTarget, Serializer> = {
  "kdp": kdpSerializer,
  "apple-books": appleBooksSerializer,
  "kobo": koboSerializer,
  "draft2digital": d2dSerializer,
  "google-play-books": googlePlaySerializer,
};

export function serializeAll(meta: PublicationMetadata, slug: string): SerializedPayload[] {
  return (Object.keys(SERIALIZERS) as DistributionTarget[]).map((t) =>
    SERIALIZERS[t](meta, slug),
  );
}
