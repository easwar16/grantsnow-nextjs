import { FormSkeleton } from "@/components/feedback/skeleton";
export default function Loading() {
  return (
    <div id="eoi-record-loading" className="record-page-loading">
      <FormSkeleton label="Loading application details" />
    </div>
  );
}
