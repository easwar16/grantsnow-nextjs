import { DetailSkeleton } from "@/components/feedback/skeleton";
// Above [id]/layout, which a loading.tsx beside it cannot cover.
export default function Loading() {
  return <DetailSkeleton label="Loading award" />;
}
