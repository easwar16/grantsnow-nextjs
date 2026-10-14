import { RecordSkeleton } from "@/components/feedback/skeleton";
export default function Loading() {
  return (
    <div className="record-page-loading">
      <RecordSkeleton label="Loading application details" />
    </div>
  );
}
