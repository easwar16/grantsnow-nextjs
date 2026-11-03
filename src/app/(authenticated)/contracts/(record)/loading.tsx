import { DetailSkeleton } from "@/components/feedback/skeleton";
// Above [id]/layout, which a loading.tsx beside it cannot cover (the listing's skeleton showed instead).
export default function Loading() {
  return <DetailSkeleton label="Loading contract" />;
}
