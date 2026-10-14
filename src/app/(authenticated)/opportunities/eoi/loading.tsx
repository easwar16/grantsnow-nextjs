import { TableSkeleton } from "@/components/feedback/skeleton";
export default function Loading() {
  return (
    <div className="record-page-loading">
      <TableSkeleton label="Loading applications of interest" />
    </div>
  );
}
