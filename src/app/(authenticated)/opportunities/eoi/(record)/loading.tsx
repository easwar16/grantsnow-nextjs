import { DetailSkeleton } from "@/components/feedback/skeleton";
// Above [id]/layout, which a loading.tsx beside it cannot cover.
export default function Loading() {
  return (
    <div id="eoi-record-loading" className="record-page-loading">
      <DetailSkeleton label="Loading application details" />
    </div>
  );
}
