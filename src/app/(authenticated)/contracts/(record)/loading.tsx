import { RecordSkeleton } from "@/components/feedback/skeleton";
// Above [id]/layout, which a loading.tsx beside it cannot cover (the listing's skeleton showed instead).
export default function Loading() {
  return <RecordSkeleton label="Loading contract" />;
}
