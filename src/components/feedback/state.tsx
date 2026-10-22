import Link from "next/link";
/** `id` names the root; its actions take `${id}-sign-in` and `${id}-retry`. */
export function State({
  id,
  title,
  message,
  code,
  action,
  retry,
}: {
  id?: string;
  title: string;
  message?: string;
  code?: string;
  /** Backend preventive_action, shown verbatim beside the message. */
  action?: string;
  retry?: () => void;
}) {
  return (
    <div id={id} className="state" role={code ? "alert" : "status"}>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <p className="state-action">{action}</p>}
      {code === "EXPIRED" || code === "UNAUTHENTICATED" ? (
        <Link
          id={id && `${id}-sign-in`}
          className="button primary"
          href="/login"
        >
          Sign in again
        </Link>
      ) : (
        retry && (
          <button id={id && `${id}-retry`} onClick={retry}>
            Retry
          </button>
        )
      )}
    </div>
  );
}
