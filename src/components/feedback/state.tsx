import Link from "next/link";
export function State({
  title,
  message,
  code,
  action,
  retry,
}: {
  title: string;
  message?: string;
  code?: string;
  /** Backend preventive_action, shown verbatim beside the message. */
  action?: string;
  retry?: () => void;
}) {
  return (
    <div className="state" role={code ? "alert" : "status"}>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <p className="state-action">{action}</p>}
      {code === "EXPIRED" || code === "UNAUTHENTICATED" ? (
        <Link className="button primary" href="/login">
          Sign in again
        </Link>
      ) : (
        retry && <button onClick={retry}>Retry</button>
      )}
    </div>
  );
}
