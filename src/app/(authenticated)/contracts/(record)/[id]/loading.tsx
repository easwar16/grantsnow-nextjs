import { Skeleton } from "@/components/feedback/skeleton";
export default function Loading() {
  return <Skeleton kind="table" count={5} label="Loading Contract section" />;
}
