import { DetailSkeleton } from "@/components/feedback/skeleton";
export default function Loading() {
  return (
    <div id="opportunity-detail-loading" className="record-page-loading">
      <DetailSkeleton label="Loading opportunity" />
    </div>
  );
}
