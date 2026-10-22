import { RecordSkeleton } from "@/components/feedback/skeleton";
export default function Loading() {
  return (
    <div id="opportunity-detail-loading" className="record-page-loading">
      <RecordSkeleton label="Loading opportunity" />
    </div>
  );
}
